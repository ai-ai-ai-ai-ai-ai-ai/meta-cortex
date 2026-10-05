use super::PERSISTENT_IO;
use super::catalog::FilePresence;
use super::observation::SequenceProvenance;
use super::relational::{EventTable, FeatureTable, RelationalSchema, TaskTable};
use super::schema::LedgerSchema;
use super::sequence::SequenceSchema;
use super::sql::SqlStatement;
use crate::LedgerError;
use crate::model::{Event, Feature, Task};
use crate::values::{EventSequence, FeatureId};
use crate::versions::StorageVersion;
use sea_query::{Expr, ExprTrait, Iden, Order, Query, SelectStatement, SqliteQueryBuilder, Table};
use std::path::Path;
use turso::{Builder, Connection};

#[derive(Iden)]
pub(super) enum LegacyFeature {
    #[iden = "feature"]
    Table,
    Document,
}
#[derive(Clone, Copy)]
pub(super) enum LegacyLayout {
    FeatureDatabase,
    RepositoryDatabase,
}
#[derive(Clone, Copy)]
pub(super) struct LegacySource<'a> {
    pub connection: &'a Connection,
    pub layout: LegacyLayout,
}

/// Raw document bytes belong to this storage adapter: decoding validates the
/// supported record, while copying preserves its released JSON representation.
struct StoredRecord<T> {
    value: T,
    document: String,
}
struct LegacyEvent {
    sequence: EventSequence,
    provenance: SequenceProvenance,
    record: StoredRecord<Event>,
}
pub(super) struct LegacyRecords {
    features: Vec<StoredRecord<Feature>>,
    tasks: Vec<StoredRecord<Task>>,
    events: Vec<LegacyEvent>,
}
#[derive(Clone, Copy)]
enum RecordSelection<'a> {
    All,
    Feature(&'a FeatureId),
}
struct RecordRead<'a> {
    source: LegacySource<'a>,
    selection: RecordSelection<'a>,
    version: StorageVersion,
}
impl RecordRead<'_> {
    fn tasks(&self) -> SelectStatement {
        let mut query = Query::select();
        query
            .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
            .from(TaskTable::Table);
        if let RecordSelection::Feature(feature) = self.selection
            && let LegacyLayout::RepositoryDatabase = self.source.layout
        {
            query.and_where(Expr::col(TaskTable::FeatureId).eq(feature.to_string()));
        }
        query
    }
    fn events(&self) -> SelectStatement {
        let mut query = Query::select();
        query
            .columns([
                EventTable::TaskId,
                EventTable::Revision,
                EventTable::Document,
                EventTable::RowId,
            ])
            .from(EventTable::Table)
            .order_by(EventTable::RowId, Order::Asc);
        match self.version {
            StorageVersion::SequencedEventsV5 | StorageVersion::FeatureHistoryV6 => {
                query.column(EventTable::Provenance);
            }
            StorageVersion::Empty
            | StorageVersion::DocumentsV1
            | StorageVersion::IndexedV2
            | StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4 => {}
        }
        if let RecordSelection::Feature(feature) = self.selection
            && let LegacyLayout::RepositoryDatabase = self.source.layout
        {
            query.and_where(Expr::col(EventTable::FeatureId).eq(feature.to_string()));
        }
        query
    }
    async fn features(&self) -> Result<Vec<StoredRecord<Feature>>, LedgerError> {
        let mut query = Query::select();
        match self.source.layout {
            LegacyLayout::FeatureDatabase => {
                query
                    .column(LegacyFeature::Document)
                    .from(LegacyFeature::Table);
            }
            LegacyLayout::RepositoryDatabase => {
                query
                    .column(FeatureTable::Document)
                    .from(FeatureTable::Table);
                if let RecordSelection::Feature(feature) = self.selection {
                    query.and_where(Expr::col(FeatureTable::Id).eq(feature.to_string()));
                }
            }
        }
        let mut rows = SqlStatement::build(query)?
            .query(self.source.connection)
            .await?;
        let mut features = Vec::new();
        while let Some(row) = rows.next().await? {
            let document = row.get::<String>(0)?;
            features.push(StoredRecord {
                value: serde_json::from_str(&document)?,
                document,
            });
        }
        Ok(features)
    }
}
impl LegacyRecords {
    pub(super) async fn migrate(source: LegacySource<'_>) -> Result<(), LedgerError> {
        let records = Self::read(RecordRead {
            source,
            selection: RecordSelection::All,
            version: LedgerSchema::version(source.connection).await?,
        })
        .await?;
        Self::replace_tables(source).await?;
        RelationalSchema::create(source.connection).await?;
        SequenceSchema::migrate(source.connection).await?;
        records.write(source.connection).await
    }
    async fn read(request: RecordRead<'_>) -> Result<Self, LedgerError> {
        let connection = request.source.connection;
        let features = request.features().await?;
        let mut tasks = Vec::new();
        let mut rows = SqlStatement::build(request.tasks())?
            .query(connection)
            .await?;
        while let Some(row) = rows.next().await? {
            let document = row.get::<String>(2)?;
            let task: Task = serde_json::from_str(&document)?;
            match (row.get::<String>(0)?, row.get::<i64>(1)?) {
                (id, revision)
                    if id == task.common.id.to_string()
                        && revision == i64::from(task.common.revision) => {}
                _ => {
                    return Err(LedgerError::Invalid(
                        "legacy task keys disagree with document",
                    ));
                }
            }
            tasks.push(StoredRecord {
                value: task,
                document,
            });
        }
        let mut events = Vec::new();
        let mut rows = SqlStatement::build(request.events())?
            .query(connection)
            .await?;
        while let Some(row) = rows.next().await? {
            let document = row.get::<String>(2)?;
            let event: Event = serde_json::from_str(&document)?;
            match (row.get::<String>(0)?, row.get::<i64>(1)?) {
                (id, revision)
                    if id == event.task.common.id.to_string()
                        && revision == i64::from(event.task.common.revision) => {}
                _ => {
                    return Err(LedgerError::Invalid(
                        "legacy event keys disagree with document",
                    ));
                }
            }
            let provenance = match request.version {
                StorageVersion::SequencedEventsV5 | StorageVersion::FeatureHistoryV6 => {
                    SequenceProvenance::try_from(row.get::<i64>(4)?)?
                }
                StorageVersion::Empty
                | StorageVersion::DocumentsV1
                | StorageVersion::IndexedV2
                | StorageVersion::RelationalV3
                | StorageVersion::CommonTasksV4 => SequenceProvenance::LegacyStorageOrder,
            };
            events.push(LegacyEvent {
                sequence: EventSequence::from(row.get::<i64>(3)?),
                provenance,
                record: StoredRecord {
                    value: event,
                    document,
                },
            });
        }
        let records = Self {
            features,
            tasks,
            events,
        };
        records.require_selection(&request)?;
        Ok(records)
    }
    fn require_selection(&self, request: &RecordRead<'_>) -> Result<(), LedgerError> {
        match (request.selection, request.source.layout) {
            (RecordSelection::Feature(feature), _) => self.require_feature(feature),
            (RecordSelection::All, LegacyLayout::RepositoryDatabase) => Ok(()),
            (RecordSelection::All, LegacyLayout::FeatureDatabase) => match self.features.as_slice()
            {
                [feature] => self.require_feature(&feature.value.id),
                [] if self.tasks.is_empty() && self.events.is_empty() => Ok(()),
                _ => Err(LedgerError::Invalid(
                    "legacy records must belong to one feature",
                )),
            },
        }
    }
    fn require_feature(&self, selected: &FeatureId) -> Result<(), LedgerError> {
        match self.features.as_slice() {
            [feature]
                if &feature.value.id == selected
                    && self
                        .tasks
                        .iter()
                        .all(|task| &task.value.common.feature == selected)
                    && self
                        .events
                        .iter()
                        .all(|event| &event.record.value.task.common.feature == selected) =>
            {
                Ok(())
            }
            [] if self.tasks.is_empty() && self.events.is_empty() => Ok(()),
            _ => Err(LedgerError::Invalid(
                "legacy records do not match selected feature",
            )),
        }
    }
    async fn replace_tables(source: LegacySource<'_>) -> Result<(), LedgerError> {
        for table in [
            Table::drop().table(EventTable::Table).to_owned(),
            Table::drop().table(TaskTable::Table).to_owned(),
        ] {
            source
                .connection
                .execute(table.to_string(SqliteQueryBuilder), ())
                .await?;
        }
        let table = match source.layout {
            LegacyLayout::FeatureDatabase => Table::drop().table(LegacyFeature::Table).to_owned(),
            LegacyLayout::RepositoryDatabase => Table::drop().table(FeatureTable::Table).to_owned(),
        };
        source
            .connection
            .execute(table.to_string(SqliteQueryBuilder), ())
            .await?;
        Ok(())
    }
    async fn write(self, connection: &Connection) -> Result<(), LedgerError> {
        for feature in self.features {
            SqlStatement::build(
                Query::insert()
                    .into_table(FeatureTable::Table)
                    .columns([FeatureTable::Id, FeatureTable::Document])
                    .values([feature.value.id.to_string().into(), feature.document.into()])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
        }
        for task in self.tasks {
            SqlStatement::build(
                Query::insert()
                    .into_table(TaskTable::Table)
                    .columns([
                        TaskTable::FeatureId,
                        TaskTable::Id,
                        TaskTable::Revision,
                        TaskTable::Document,
                    ])
                    .values([
                        task.value.common.feature.to_string().into(),
                        task.value.common.id.to_string().into(),
                        i64::from(task.value.common.revision).into(),
                        task.document.into(),
                    ])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
        }
        for event in self.events {
            event.write(connection).await?;
        }
        Ok(())
    }
}
impl LegacyEvent {
    async fn write(self, connection: &Connection) -> Result<(), LedgerError> {
        let mut columns = vec![
            EventTable::FeatureId,
            EventTable::TaskId,
            EventTable::Revision,
            EventTable::Document,
        ];
        let mut values = vec![
            self.record.value.task.common.feature.to_string().into(),
            self.record.value.task.common.id.to_string().into(),
            i64::from(self.record.value.task.common.revision).into(),
            self.record.document.into(),
        ];
        columns.extend([EventTable::Sequence, EventTable::Provenance]);
        values.extend([
            i64::from(self.sequence).into(),
            i64::from(self.provenance).into(),
        ]);
        SqlStatement::build(
            Query::insert()
                .into_table(EventTable::Table)
                .columns(columns)
                .values(values)?
                .to_owned(),
        )?
        .execute(connection)
        .await?;
        Ok(())
    }
}
pub(super) struct LegacyImport<'a> {
    pub connection: &'a Connection,
    pub feature: &'a FeatureId,
}
impl LegacyImport<'_> {
    pub(super) async fn import(&self, path: &Path) -> Result<(), LedgerError> {
        LedgerSchema::require_current(self.connection).await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Id)
                .from(FeatureTable::Table)
                .and_where(Expr::col(FeatureTable::Id).eq(self.feature.to_string()))
                .to_owned(),
        )?
        .query(self.connection)
        .await?;
        match rows.next().await? {
            Some(row) => {
                drop(row);
                return Ok(());
            }
            None => drop(rows),
        }
        let FilePresence::Present = FilePresence::from(path.try_exists()?) else {
            return Ok(());
        };
        let database = Builder::new_local(
            path.to_str()
                .ok_or(LedgerError::Invalid("ledger path must be UTF-8"))?,
        )
        .with_io(PERSISTENT_IO)
        .experimental_multiprocess_wal(true)
        .read_only(true)
        .build()
        .await?;
        let mut source = database.connect()?;
        let snapshot = source.transaction().await?;
        let version = LedgerSchema::version(&snapshot).await?;
        let layout = match version {
            StorageVersion::DocumentsV1 | StorageVersion::IndexedV2 => {
                LegacyLayout::FeatureDatabase
            }
            StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4
            | StorageVersion::SequencedEventsV5
            | StorageVersion::FeatureHistoryV6 => LegacyLayout::RepositoryDatabase,
            StorageVersion::Empty => return Err(LedgerError::Invalid("legacy database is empty")),
        };
        let records = LegacyRecords::read(RecordRead {
            source: LegacySource {
                connection: &snapshot,
                layout,
            },
            selection: RecordSelection::Feature(self.feature),
            version,
        })
        .await?;
        records.write(self.connection).await?;
        snapshot.commit().await?;
        Ok(())
    }
}

#[cfg(test)]
pub mod tests {
    use super::PERSISTENT_IO;
    use crate::git::Repository;
    use crate::store::schema::LedgerSchema;
    use crate::store::schema::tests::LegacyFixture;
    use crate::values::{EventSequence, Extensions, FeatureId, TaskId};
    use crate::versions::StorageVersion;
    use crate::{DataDirectory, Workbench};
    use sea_query::Iden;
    use std::fs;
    use std::path::Path;
    use tokio::runtime;
    use turso::Builder;

    #[test]
    fn discovery_observes_and_selected_access_imports_old_location_once() -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        let root = directory.path().join("project");
        git2::Repository::init(&root)?;
        let data = directory.path().join("data");
        let workbench =
            Workbench::discover(&root)?.with_data_directory(DataDirectory::from(data.clone()));
        workbench.initialize_repository()?;
        let id = fs::read_to_string(root.join(".meta-cortex/repository-id"))?;
        let legacy = data.join(id.trim()).join("features");
        fs::create_dir_all(&legacy)?;
        let path = legacy.join("feature.db");
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let source =
                    Builder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?)
                        .with_io(PERSISTENT_IO)
                        .experimental_multiprocess_wal(true)
                        .build()
                        .await?;
                let connection = source.connect()?;
                LegacyFixture::create(&connection).await?;
                drop(connection);
                drop(source);
                assert!(workbench.features().await.is_err());
                assert!(
                    !data
                        .join("project")
                        .join(id.trim())
                        .join("features/feature.db")
                        .exists()
                );
                let ledger = workbench
                    .open(FeatureId::try_from("feature".to_owned())?)
                    .await?;
                assert_eq!(
                    ledger.info().path,
                    data.join("project")
                        .join(id.trim())
                        .join("features/feature.db")
                );
                assert_eq!(ledger.status().await?.len(), 1);
                assert_eq!(
                    ledger
                        .history(&TaskId::try_from("task".to_owned())?)
                        .await?
                        .len(),
                    1
                );
                drop(ledger);
                assert_eq!(workbench.features().await?.len(), 1);
                let source =
                    Builder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?)
                        .with_io(PERSISTENT_IO)
                        .experimental_multiprocess_wal(true)
                        .read_only(true)
                        .build()
                        .await?;
                assert_eq!(
                    LedgerSchema::version(&source.connect()?).await?,
                    StorageVersion::DocumentsV1
                );
                anyhow::Ok(())
            })
    }
    #[derive(sea_query::Iden)]
    enum Pragma {
        UserVersion,
    }
    struct ImportScenario {
        directory: tempfile::TempDir,
        repository: Repository,
        workbench: Workbench,
    }
    impl ImportScenario {
        fn new() -> anyhow::Result<Self> {
            let directory = tempfile::tempdir()?;
            let root = directory.path().join("project");
            git2::Repository::init(&root)?;
            let data = DataDirectory::from(directory.path().join("data"));
            let workbench = Workbench::discover(&root)?.with_data_directory(data.clone());
            workbench.initialize_repository()?;
            let repository = Repository::discover(&root)?.with_data_directory(data);
            Ok(Self {
                directory,
                repository,
                workbench,
            })
        }
        async fn database(&self, path: &Path) -> anyhow::Result<turso::Database> {
            fs::create_dir_all(path.parent().ok_or_else(|| anyhow::anyhow!("parent"))?)?;
            Ok(
                Builder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?)
                    .with_io(PERSISTENT_IO)
                    .experimental_multiprocess_wal(true)
                    .build()
                    .await?,
            )
        }
        async fn seed(&self, connection: &turso::Connection) -> anyhow::Result<()> {
            use crate::store::relational::tests::Records;
            use crate::store::relational::{EventTable, RecordWriter, RelationalSchema};
            use crate::store::sequence::SequenceSchema;
            use crate::store::sql::SqlStatement;
            use sea_query::{Expr, ExprTrait, Query};
            RelationalSchema::create(connection).await?;
            SequenceSchema::migrate(connection).await?;
            for feature in ["feature", "other"] {
                let mut records = Records::new()?;
                records.feature.id = FeatureId::try_from(feature.to_owned())?;
                records.feature.worktree = self.directory.path().join("project");
                records.task.common.feature = records.feature.id.clone();
                records.event.task = records.task.clone();
                let writer = RecordWriter { connection };
                writer.feature(&records.feature).await?;
                writer.task(&records.task).await?;
                writer.event(&records.event).await?;
            }
            SqlStatement::build(
                Query::update()
                    .table(EventTable::Table)
                    .value(EventTable::Sequence, 8)
                    .value(
                        EventTable::Provenance,
                        i64::from(super::SequenceProvenance::LegacyStorageOrder),
                    )
                    .and_where(Expr::col(EventTable::FeatureId).eq("feature"))
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
            connection
                .pragma_update(
                    &Pragma::UserVersion.to_string(),
                    StorageVersion::SequencedEventsV5,
                )
                .await?;
            Ok(())
        }
    }
    #[derive(Debug, PartialEq, Eq)]
    struct StoredEvent {
        sequence: EventSequence,
        provenance: super::SequenceProvenance,
        document: String,
    }
    impl StoredEvent {
        async fn read(connection: &turso::Connection) -> anyhow::Result<Vec<Self>> {
            use crate::store::relational::EventTable;
            use crate::store::sql::SqlStatement;
            use sea_query::{Order, Query};
            let mut rows = SqlStatement::build(
                Query::select()
                    .columns([
                        EventTable::Sequence,
                        EventTable::Provenance,
                        EventTable::Document,
                    ])
                    .from(EventTable::Table)
                    .order_by(EventTable::Sequence, Order::Asc)
                    .to_owned(),
            )?
            .query(connection)
            .await?;
            let mut events = Vec::new();
            while let Some(row) = rows.next().await? {
                events.push(Self {
                    sequence: EventSequence::from(row.get::<i64>(0)?),
                    provenance: super::SequenceProvenance::try_from(row.get::<i64>(1)?)?,
                    document: row.get::<String>(2)?,
                });
            }
            Ok(events)
        }
    }
    #[test]
    fn shared_import_preserves_selected_bytes_positions_and_source_and_ignores_other_future_features()
    -> anyhow::Result<()> {
        use crate::agents::{AgentId, GizmoAgent};
        use crate::model::{Progress, Workspace};
        use crate::request::CreateTask;
        use crate::values::Note;
        let scenario = ImportScenario::new()?;
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let shared = scenario.repository.ledger_path()?;
                let source = scenario.database(&shared).await?;
                let source_connection = source.connect()?;
                scenario.seed(&source_connection).await?;
                let original = StoredEvent::read(&source_connection).await?;
                let feature = FeatureId::try_from("feature".to_owned())?;
                let other = FeatureId::try_from("other".to_owned())?;
                let historical = scenario.repository.historical_path(&feature)?;
                let old = scenario.database(&historical).await?;
                LegacyFixture::create(&old.connect()?).await?;
                drop(old);
                // Discovery refuses V5 without migrating it or producing a target.
                let error = scenario
                    .workbench
                    .features()
                    .await
                    .err()
                    .ok_or_else(|| anyhow::anyhow!("expected migration notice"))?;
                assert!(error.to_string().contains("feature"));
                assert!(!scenario.repository.feature_path(&feature)?.exists());
                let mut ledger = scenario.workbench.open(feature.clone()).await?;
                let imported = scenario.database(&ledger.info().path).await?;
                assert_eq!(
                    StoredEvent::read(&imported.connect()?).await?,
                    vec![StoredEvent {
                        sequence: original[1].sequence,
                        provenance: original[1].provenance,
                        document: original[1].document.clone()
                    }]
                );
                assert_eq!(ledger.status().await?.len(), 1);
                ledger
                    .create(CreateTask {
                        feature: feature.clone(),
                        task: TaskId::try_from("new-task".to_owned())?,
                        actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                        objective: Note::from("new".to_owned()),
                        acceptance: vec![Note::from("checked".to_owned())],
                        dependencies: Vec::new(),
                        workspace: Workspace::ReadOnly,
                        progress: Progress {
                            summary: Note::Empty,
                            findings: Vec::new(),
                            next_steps: Vec::new(),
                            checks: Vec::new(),
                            extensions: Extensions::default(),
                        },
                    })
                    .await?;
                let appended = StoredEvent::read(&imported.connect()?).await?;
                assert_eq!(appended[1].sequence, EventSequence::from(9));
                assert_eq!(
                    appended[1].provenance,
                    super::SequenceProvenance::CommittedAppend
                );
                assert_eq!(StoredEvent::read(&source_connection).await?, original);
                assert_eq!(
                    LedgerSchema::version(&source_connection).await?,
                    StorageVersion::SequencedEventsV5
                );
                let other_database = scenario
                    .database(&scenario.repository.feature_path(&other)?)
                    .await?;
                other_database
                    .connect()?
                    .pragma_update(&Pragma::UserVersion.to_string(), 99)
                    .await?;
                // A selected reader/writer never inspects the unrelated future database.
                assert_eq!(
                    scenario
                        .workbench
                        .open(feature.clone())
                        .await?
                        .status()
                        .await?
                        .len(),
                    2
                );
                let observation = scenario.workbench.observe().await?;
                assert_eq!(
                    observation
                        .tasks(crate::TaskPage {
                            feature,
                            page: crate::PageIndex::FIRST
                        })
                        .await?
                        .records
                        .len(),
                    2
                );
                let error = scenario
                    .workbench
                    .features()
                    .await
                    .err()
                    .ok_or_else(|| anyhow::anyhow!("expected future rejection"))?;
                assert!(error.to_string().contains("other"));
                assert!(error.to_string().contains("99"));
                assert_eq!(StoredEvent::read(&source_connection).await?, original);
                anyhow::Ok(())
            })
    }

    #[test]
    fn failed_import_rolls_back_and_retries_without_shadowing_source() -> anyhow::Result<()> {
        use crate::store::relational::EventTable;
        use crate::store::sql::SqlStatement;
        use sea_query::{Expr, ExprTrait, Query};
        let scenario = ImportScenario::new()?;
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let source = scenario
                    .database(&scenario.repository.ledger_path()?)
                    .await?;
                let connection = source.connect()?;
                scenario.seed(&connection).await?;
                let missing = FeatureId::try_from("missing".to_owned())?;
                assert!(matches!(
                    scenario.workbench.open(missing.clone()).await,
                    Err(crate::LedgerError::Uninitialized)
                ));
                let empty = scenario
                    .database(&scenario.repository.feature_path(&missing)?)
                    .await?;
                assert_eq!(
                    LedgerSchema::version(&empty.connect()?).await?,
                    StorageVersion::Empty
                );
                // Deliberately malformed future source is rejected before any target schema can commit.
                connection
                    .pragma_update(&Pragma::UserVersion.to_string(), 99)
                    .await?;
                let feature = FeatureId::try_from("feature".to_owned())?;
                assert!(scenario.workbench.open(feature.clone()).await.is_err());
                let target = scenario
                    .database(&scenario.repository.feature_path(&feature)?)
                    .await?;
                assert_eq!(
                    LedgerSchema::version(&target.connect()?).await?,
                    StorageVersion::Empty
                );
                let error = scenario
                    .workbench
                    .observe()
                    .await?
                    .tasks(crate::TaskPage {
                        feature: feature.clone(),
                        page: crate::PageIndex::FIRST,
                    })
                    .await
                    .err()
                    .ok_or_else(|| anyhow::anyhow!("expected source rejection"))?;
                assert!(error.to_string().contains("99"));
                connection
                    .pragma_update(
                        &Pragma::UserVersion.to_string(),
                        StorageVersion::SequencedEventsV5,
                    )
                    .await?;
                let mut ledger = scenario.workbench.open(feature.clone()).await?;
                assert_eq!(
                    ledger
                        .history(&TaskId::try_from("task".to_owned())?)
                        .await?
                        .len(),
                    1
                );
                // Once imported, even a corrupt retained source is no longer read for this feature.
                connection
                    .pragma_update(&Pragma::UserVersion.to_string(), 99)
                    .await?;
                SqlStatement::build(
                    Query::delete()
                        .from_table(EventTable::Table)
                        .and_where(Expr::col(EventTable::FeatureId).eq(feature.to_string()))
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                ledger = scenario.workbench.open(feature).await?;
                assert_eq!(
                    ledger
                        .history(&TaskId::try_from("task".to_owned())?)
                        .await?
                        .len(),
                    1
                );
                anyhow::Ok(())
            })
    }
    impl ImportScenario {
        async fn retain_selected(&self, connection: &turso::Connection) -> anyhow::Result<()> {
            use crate::store::relational::{EventTable, FeatureTable, TaskTable};
            use crate::store::sql::SqlStatement;
            use sea_query::{Expr, ExprTrait, Query};
            for query in [
                Query::delete()
                    .from_table(EventTable::Table)
                    .and_where(Expr::col(EventTable::FeatureId).ne("feature"))
                    .to_owned(),
                Query::delete()
                    .from_table(TaskTable::Table)
                    .and_where(Expr::col(TaskTable::FeatureId).ne("feature"))
                    .to_owned(),
                Query::delete()
                    .from_table(FeatureTable::Table)
                    .and_where(Expr::col(FeatureTable::Id).ne("feature"))
                    .to_owned(),
            ] {
                SqlStatement::build(query)?.execute(connection).await?;
            }
            Ok(())
        }
        async fn migrate_selected_version(&self, version: StorageVersion) -> anyhow::Result<()> {
            use crate::store::relational::tests::Records;
            use crate::store::relational::{EventTable, RecordWriter, RelationalSchema};
            use crate::store::sql::SqlStatement;
            use sea_query::Query;
            let feature = FeatureId::try_from("feature".to_owned())?;
            let path = self.repository.feature_path(&feature)?;
            let database = self.database(&path).await?;
            let connection = database.connect()?;
            match version {
                StorageVersion::DocumentsV1 | StorageVersion::IndexedV2 => {
                    LegacyFixture::create(&connection).await?
                }
                StorageVersion::RelationalV3 => LegacyFixture::repository(&connection).await?,
                StorageVersion::CommonTasksV4 => {
                    RelationalSchema::create(&connection).await?;
                    let records = Records::new()?;
                    let writer = RecordWriter {
                        connection: &connection,
                    };
                    writer.feature(&records.feature).await?;
                    writer.task(&records.task).await?;
                    writer.event(&records.event).await?;
                }
                StorageVersion::SequencedEventsV5 => self.seed(&connection).await?,
                StorageVersion::Empty | StorageVersion::FeatureHistoryV6 => {
                    return Err(anyhow::anyhow!("expected released old schema"));
                }
            }
            match version {
                StorageVersion::RelationalV3
                | StorageVersion::CommonTasksV4
                | StorageVersion::SequencedEventsV5 => self.retain_selected(&connection).await?,
                StorageVersion::Empty
                | StorageVersion::DocumentsV1
                | StorageVersion::IndexedV2
                | StorageVersion::FeatureHistoryV6 => {}
            }
            connection
                .pragma_update(&Pragma::UserVersion.to_string(), version)
                .await?;
            let mut rows = SqlStatement::build(
                Query::select()
                    .column(EventTable::Document)
                    .from(EventTable::Table)
                    .to_owned(),
            )?
            .query(&connection)
            .await?;
            let mut original = Vec::new();
            while let Some(row) = rows.next().await? {
                original.push(row.get::<String>(0)?);
            }
            drop(rows);
            let unrelated = self
                .repository
                .feature_path(&FeatureId::try_from("future".to_owned())?)?;
            let future = self.database(&unrelated).await?;
            future
                .connect()?
                .pragma_update(&Pragma::UserVersion.to_string(), 99)
                .await?;
            drop(future);
            let unchanged = fs::read(&unrelated)?;
            let ledger = self.workbench.open(feature.clone()).await?;
            assert_eq!(
                ledger.info().storage_version,
                StorageVersion::FeatureHistoryV6
            );
            assert_eq!(
                LedgerSchema::version(&connection).await?,
                StorageVersion::FeatureHistoryV6
            );
            let migrated = StoredEvent::read(&connection).await?;
            assert_eq!(
                migrated
                    .iter()
                    .map(|event| &event.document)
                    .collect::<Vec<_>>(),
                original.iter().collect::<Vec<_>>()
            );
            assert_eq!(fs::read(&unrelated)?, unchanged);
            assert!(!ledger.status().await?.is_empty());
            assert!(
                !self
                    .workbench
                    .observe()
                    .await?
                    .tasks(crate::TaskPage {
                        feature,
                        page: crate::PageIndex::FIRST
                    })
                    .await?
                    .records
                    .is_empty()
            );
            Ok(())
        }
    }
    #[test]
    fn each_released_schema_migrates_only_the_selected_feature_file() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                for version in [
                    StorageVersion::DocumentsV1,
                    StorageVersion::IndexedV2,
                    StorageVersion::RelationalV3,
                    StorageVersion::CommonTasksV4,
                    StorageVersion::SequencedEventsV5,
                ] {
                    ImportScenario::new()?
                        .migrate_selected_version(version)
                        .await?;
                }
                anyhow::Ok(())
            })
    }
}
