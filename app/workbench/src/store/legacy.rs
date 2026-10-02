use super::relational::{EventTable, FeatureTable, RecordWriter, RelationalSchema, TaskTable};
use super::schema::LedgerSchema;
use super::sql::SqlStatement;
use crate::LedgerError;
use crate::model::{Event, Feature, Task};
use crate::values::FeatureId;
use crate::versions::StorageVersion;
use sea_query::{Expr, ExprTrait, Iden, Query, SqliteQueryBuilder, Table};
use std::path::Path;
use turso::transaction::TransactionBehavior;
use turso::{Builder, Connection};

#[derive(Iden)]
enum LegacyFeature {
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

/// Supported historical records, loaded before replacing their physical schema.
pub(super) struct LegacyRecords {
    features: Vec<Feature>,
    tasks: Vec<Task>,
    events: Vec<Event>,
}
impl LegacyRecords {
    pub(super) async fn migrate(source: LegacySource<'_>) -> Result<(), LedgerError> {
        let records = Self::read(source).await?;
        Self::replace_tables(source).await?;
        RelationalSchema::create(source.connection).await?;
        records.write(source.connection).await
    }

    pub(super) async fn read(source: LegacySource<'_>) -> Result<Self, LedgerError> {
        let connection = source.connection;
        let mut features: Vec<Feature> = Vec::new();
        let mut query = Query::select();
        match source.layout {
            LegacyLayout::FeatureDatabase => {
                query
                    .column(LegacyFeature::Document)
                    .from(LegacyFeature::Table);
            }
            LegacyLayout::RepositoryDatabase => {
                query
                    .column(FeatureTable::Document)
                    .from(FeatureTable::Table);
            }
        }
        let mut rows = SqlStatement::build(query)?.query(connection).await?;
        while let Some(row) = rows.next().await? {
            features.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        let mut tasks = Vec::new();
        let mut rows = SqlStatement::build(
            Query::select()
                .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                .from(TaskTable::Table)
                .to_owned(),
        )?
        .query(connection)
        .await?;
        while let Some(row) = rows.next().await? {
            let task: Task = serde_json::from_str(&row.get::<String>(2)?)?;
            match (row.get::<String>(0)?, row.get::<i64>(1)?) {
                (id, revision)
                    if id == task.common.id.to_string()
                        && revision == i64::from(task.common.revision) =>
                {
                    tasks.push(task)
                }
                _ => {
                    return Err(LedgerError::Invalid(
                        "legacy task keys disagree with document",
                    ));
                }
            }
        }
        let mut events = Vec::new();
        let mut rows = SqlStatement::build(
            Query::select()
                .columns([
                    EventTable::TaskId,
                    EventTable::Revision,
                    EventTable::Document,
                ])
                .from(EventTable::Table)
                .to_owned(),
        )?
        .query(connection)
        .await?;
        while let Some(row) = rows.next().await? {
            let event: Event = serde_json::from_str(&row.get::<String>(2)?)?;
            match (row.get::<String>(0)?, row.get::<i64>(1)?) {
                (id, revision)
                    if id == event.task.common.id.to_string()
                        && revision == i64::from(event.task.common.revision) =>
                {
                    events.push(event)
                }
                _ => {
                    return Err(LedgerError::Invalid(
                        "legacy event keys disagree with document",
                    ));
                }
            }
        }
        match source.layout {
            LegacyLayout::FeatureDatabase => match features.as_slice() {
                [] if tasks.is_empty() && events.is_empty() => {}
                [feature]
                    if tasks.iter().all(|task| task.common.feature == feature.id)
                        && events
                            .iter()
                            .all(|event| event.task.common.feature == feature.id) => {}
                _ => {
                    return Err(LedgerError::Invalid(
                        "legacy records must belong to their feature",
                    ));
                }
            },
            // The rebuilt schema checks all repository feature/task relationships on write.
            LegacyLayout::RepositoryDatabase => {}
        }
        Ok(Self {
            features,
            tasks,
            events,
        })
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

    pub(super) async fn write(self, connection: &Connection) -> Result<(), LedgerError> {
        for feature in self.features {
            RecordWriter { connection }.feature(&feature).await?;
        }
        for task in self.tasks {
            RecordWriter { connection }.task(&task).await?;
        }
        for event in self.events {
            RecordWriter { connection }.event(&event).await?;
        }
        Ok(())
    }
}

pub(super) struct LegacyImport<'a> {
    pub connection: &'a mut Connection,
}
impl LegacyImport<'_> {
    pub(super) async fn import(self, path: &Path) -> Result<(), LedgerError> {
        let feature = FeatureId::try_from(
            path.file_stem()
                .and_then(|stem| stem.to_str())
                .ok_or(LedgerError::Invalid("invalid legacy filename"))?
                .to_owned(),
        )?;
        // Serialize imports with feature creation. An imported source is a backup,
        // so subsequent reads never overwrite new progress or depend on its contents.
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Id)
                .from(FeatureTable::Table)
                .and_where(Expr::col(FeatureTable::Id).eq(feature.to_string()))
                .to_owned(),
        )?
        .query(&tx)
        .await?;
        match rows.next().await? {
            Some(_) => {
                drop(rows);
                tx.commit().await?;
                return Ok(());
            }
            None => drop(rows),
        }
        let database = Builder::new_local(
            path.to_str()
                .ok_or(LedgerError::Invalid("ledger path must be UTF-8"))?,
        )
        .experimental_multiprocess_wal(true)
        .read_only(true)
        .build()
        .await?;
        let mut source = database.connect()?;
        let snapshot = source.transaction().await?;
        match LedgerSchema::version(&snapshot).await? {
            StorageVersion::DocumentsV1 | StorageVersion::IndexedV2 => {}
            StorageVersion::Empty
            | StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4 => {
                return Err(LedgerError::Invalid("expected a V1/V2 feature database"));
            }
        }
        let records = LegacyRecords::read(LegacySource {
            connection: &snapshot,
            layout: LegacyLayout::FeatureDatabase,
        })
        .await?;
        match records.features.as_slice() {
            [stored] if stored.id == feature => {}
            _ => {
                return Err(LedgerError::Invalid(
                    "legacy feature does not match its filename",
                ));
            }
        }
        records.write(&tx).await?;
        snapshot.commit().await?;
        tx.commit().await?;
        Ok(())
    }
}

#[cfg(test)]
pub mod tests {
    use crate::store::schema::LedgerSchema;
    use crate::store::schema::tests::LegacyFixture;
    use crate::values::{FeatureId, TaskId};
    use crate::versions::StorageVersion;
    use crate::{DataDirectory, Workbench};
    use std::fs;
    use tokio::runtime;
    use turso::Builder;

    #[test]
    fn discovery_imports_old_location_once_and_preserves_the_source() -> anyhow::Result<()> {
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
                        .experimental_multiprocess_wal(true)
                        .build()
                        .await?;
                let connection = source.connect()?;
                LegacyFixture::create(&connection).await?;
                drop(connection);
                drop(source);
                let features = workbench.features().await?;
                assert_eq!(features.len(), 1);
                assert_eq!(
                    features[0].path,
                    data.join("project").join(id.trim()).join("workbench.db")
                );
                let ledger = workbench
                    .open(FeatureId::try_from("feature".to_owned())?)
                    .await?;
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
}
