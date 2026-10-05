use super::observation::SequenceProvenance;
use super::relational::{EventTable, FeatureTable, RelationalSchema, TaskTable};
use super::schema::LedgerSchema;
use super::sequence::SequenceSchema;
use super::sql::SqlStatement;
use crate::LedgerError;
use crate::model::{Event, Feature, Task};
use crate::values::{EventSequence, FeatureId};
use crate::versions::StorageVersion;
use sea_query::{Iden, Order, Query, SelectStatement, SqliteQueryBuilder, Table};
use turso::Connection;

#[derive(Iden)]
pub(super) enum LegacyFeature {
    #[iden = "feature"]
    Table,
    Document,
}
#[derive(Clone, Copy)]
pub(super) enum LegacyLayout {
    FeatureDatabase,
    RelationalDatabase,
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
struct RecordRead<'a> {
    source: LegacySource<'a>,
    version: StorageVersion,
}
impl RecordRead<'_> {
    fn tasks(&self) -> SelectStatement {
        let mut query = Query::select();
        query
            .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
            .from(TaskTable::Table);
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
            LegacyLayout::RelationalDatabase => {
                query
                    .column(FeatureTable::Document)
                    .from(FeatureTable::Table);
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
        records.require_single_feature()?;
        Ok(records)
    }
    fn require_single_feature(&self) -> Result<(), LedgerError> {
        match self.features.as_slice() {
            [feature] => self.require_feature(&feature.value.id),
            [] => match (self.tasks.as_slice(), self.events.as_slice()) {
                ([], []) => Ok(()),
                ([_, ..], []) | ([], [_, ..]) | ([_, ..], [_, ..]) => Err(LedgerError::Invalid(
                    "legacy records must belong to one feature",
                )),
            },
            [_, _, ..] => Err(LedgerError::Invalid(
                "legacy records must belong to one feature",
            )),
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
            LegacyLayout::RelationalDatabase => Table::drop().table(FeatureTable::Table).to_owned(),
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
#[cfg(test)]
pub mod tests {
    use crate::git::Repository;
    use crate::store::PERSISTENT_IO;
    use crate::store::schema::LedgerSchema;
    use crate::store::schema::tests::LegacyFixture;
    use crate::values::{EventSequence, FeatureId};
    use crate::versions::StorageVersion;
    use crate::{DataDirectory, Workbench};
    use sea_query::Iden;
    use std::fs;
    use std::path::Path;
    use tokio::runtime;
    use turso::Builder;

    #[derive(Iden)]
    enum Pragma {
        UserVersion,
    }
    struct MigrationScenario {
        directory: tempfile::TempDir,
        repository: Repository,
        workbench: Workbench,
    }
    impl MigrationScenario {
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
            for feature in ["feature"] {
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
    impl MigrationScenario {
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
                    MigrationScenario::new()?
                        .migrate_selected_version(version)
                        .await?;
                }
                anyhow::Ok(())
            })
    }
}
