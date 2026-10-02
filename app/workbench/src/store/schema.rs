use super::legacy::{LegacyLayout, LegacyRecords, LegacySource};
use super::relational::RelationalSchema;
use super::{LedgerError, StorageVersion};
#[cfg(test)]
use sea_query::{ColumnDef, Expr, ExprTrait, Table, TableCreateStatement};
use sea_query::{Iden, Index, SqliteQueryBuilder};
use turso::Connection;
use turso::transaction::TransactionBehavior;

// These identifiers preserve the existing on-disk schema.
#[derive(Iden)]
#[cfg(test)]
pub(super) enum FeatureTable {
    #[iden = "feature"]
    Table,
    #[cfg(test)]
    Singleton,
    Document,
}

#[derive(Iden)]
#[cfg(test)]
pub(super) enum TaskTable {
    #[iden = "tasks"]
    Table,
    Id,
    Revision,
    Document,
}

#[derive(Iden)]
pub(super) enum EventTable {
    #[iden = "events"]
    Table,
    TaskId,
    Revision,
    #[cfg(test)]
    Document,
}

#[derive(Iden)]
enum EventIndex {
    EventsTaskRevision,
}

#[derive(Iden)]
enum DatabasePragma {
    UserVersion,
    ForeignKeys,
}

pub struct LedgerSchema;

impl LedgerSchema {
    pub(super) async fn version(connection: &Connection) -> Result<StorageVersion, LedgerError> {
        let mut version = Err(LedgerError::Invalid("missing database version"));
        connection
            .pragma_query(&DatabasePragma::UserVersion.to_string(), |row| {
                version = row
                    .get::<i64>(0)
                    .map_err(LedgerError::from)
                    .and_then(|value| StorageVersion::try_from(value).map_err(LedgerError::from));
                Ok(())
            })
            .await?;
        version
    }

    pub async fn migrate(connection: &mut Connection) -> Result<(), LedgerError> {
        connection
            .pragma_update(&DatabasePragma::ForeignKeys.to_string(), 1)
            .await?;
        let tx = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let mut version = Self::version(&tx).await?;
        match version {
            StorageVersion::CommonTasksV4 => {
                tx.commit().await?;
                return Ok(());
            }
            StorageVersion::Empty
            | StorageVersion::DocumentsV1
            | StorageVersion::IndexedV2
            | StorageVersion::RelationalV3 => {}
        }
        loop {
            version = match version {
                StorageVersion::Empty => {
                    RelationalSchema::create(&tx).await?;
                    StorageVersion::CommonTasksV4
                }
                StorageVersion::DocumentsV1 => {
                    let index = Index::create()
                        .name(EventIndex::EventsTaskRevision.to_string())
                        .table(EventTable::Table)
                        .col(EventTable::TaskId)
                        .col(EventTable::Revision)
                        .unique()
                        .to_string(SqliteQueryBuilder);
                    tx.execute(index, ()).await?;
                    StorageVersion::IndexedV2
                }
                StorageVersion::IndexedV2 => {
                    LegacyRecords::migrate(LegacySource {
                        connection: &tx,
                        layout: LegacyLayout::FeatureDatabase,
                    })
                    .await?;
                    StorageVersion::CommonTasksV4
                }
                StorageVersion::RelationalV3 => {
                    LegacyRecords::migrate(LegacySource {
                        connection: &tx,
                        layout: LegacyLayout::RepositoryDatabase,
                    })
                    .await?;
                    StorageVersion::CommonTasksV4
                }
                StorageVersion::CommonTasksV4 => break,
            };
        }
        tx.pragma_update(
            &DatabasePragma::UserVersion.to_string(),
            StorageVersion::CURRENT,
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
}

#[cfg(test)]
impl FeatureTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(
                ColumnDef::new(Self::Singleton)
                    .integer()
                    .primary_key()
                    .check(Expr::col(Self::Singleton).eq(1)),
            )
            .col(ColumnDef::new(Self::Document).text().not_null())
            .to_owned()
    }
}

#[cfg(test)]
impl TaskTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(ColumnDef::new(Self::Id).text().primary_key())
            .col(
                ColumnDef::new(Self::Revision)
                    .integer()
                    .not_null()
                    .check(Expr::col(Self::Revision).gt(0)),
            )
            .col(ColumnDef::new(Self::Document).text().not_null())
            .to_owned()
    }
}

#[cfg(test)]
impl EventTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(ColumnDef::new(Self::TaskId).text().not_null())
            .col(ColumnDef::new(Self::Revision).integer().not_null())
            .col(ColumnDef::new(Self::Document).text().not_null())
            .to_owned()
    }
}

#[cfg(test)]
pub mod tests {
    use super::{
        DatabasePragma, EventTable, FeatureTable, LedgerSchema, StorageVersion, TaskTable,
    };
    use crate::agents::{AgentId, DevelopmentAgent};
    use crate::model::workflow::TaskOwnership;
    use crate::model::{
        Checkpoint, ClaimAt, Event, EventKind, Feature, Progress, Task, TaskState, Workspace,
    };
    use crate::store::relational::tests::Records;
    use crate::store::relational::{
        EventTable as RepositoryEventTable, FeatureTable as RepositoryFeatureTable, RecordWriter,
        TaskTable as RepositoryTaskTable,
    };
    use crate::store::sql::SqlStatement;
    use crate::values::{Attempt, FeatureId, LeaseSeconds, Note, Revision, TaskId, Timestamp};
    use crate::versions::{RecordVersion, TaskRecordVersion};
    use sea_query::{
        ColumnDef, Expr, ExprTrait, ForeignKey, ForeignKeyAction, Func, Iden, Index, Order, Query,
        SqliteQueryBuilder, Table, TableCreateStatement,
    };
    use serde::{Deserialize, Serialize};
    use tokio::runtime;
    use turso::Connection;

    // Independent released V1 payloads keep migration tests from silently writing V2 fixtures.
    #[derive(Serialize, Deserialize)]
    #[serde(deny_unknown_fields)]
    struct LegacyTask {
        version: RecordVersion,
        id: TaskId,
        feature: FeatureId,
        objective: Note,
        acceptance: Vec<Note>,
        dependencies: Vec<TaskId>,
        workspace: Workspace,
        revision: Revision,
        attempt: Attempt,
        state: TaskState,
        created_at: Timestamp,
        last_update: Timestamp,
        last_progress: Timestamp,
        checkpoint: Checkpoint,
        progress: Progress,
    }
    impl From<Task> for LegacyTask {
        fn from(task: Task) -> Self {
            Self {
                version: RecordVersion::V1,
                id: task.common.id,
                feature: task.common.feature,
                objective: task.common.objective,
                acceptance: task.common.acceptance,
                dependencies: task.common.dependencies,
                workspace: task.workspace,
                revision: task.common.revision,
                attempt: task.common.attempt,
                state: task.state,
                created_at: task.common.created_at,
                last_update: task.common.last_update,
                last_progress: task.common.last_progress,
                checkpoint: task.common.checkpoint,
                progress: task.common.progress,
            }
        }
    }

    #[derive(Serialize, Deserialize)]
    #[serde(deny_unknown_fields)]
    struct LegacyEvent {
        version: RecordVersion,
        kind: EventKind,
        actor: AgentId,
        note: Note,
        task: LegacyTask,
    }
    impl From<Event> for LegacyEvent {
        fn from(event: Event) -> Self {
            Self {
                version: event.version,
                kind: event.kind,
                actor: event.actor,
                note: event.note,
                task: event.task.into(),
            }
        }
    }

    pub(crate) struct LegacyFixture;
    impl LegacyFixture {
        pub(crate) async fn create(connection: &Connection) -> anyhow::Result<()> {
            for mut table in [
                FeatureTable::create(),
                TaskTable::create(),
                EventTable::create(),
            ] {
                table.extra("STRICT");
                connection
                    .execute(table.to_string(SqliteQueryBuilder), ())
                    .await?;
            }
            let records = Records::new()?;
            SqlStatement::build(
                Query::insert()
                    .into_table(FeatureTable::Table)
                    .columns([FeatureTable::Singleton, FeatureTable::Document])
                    .values([1.into(), serde_json::to_string(&records.feature)?.into()])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
            SqlStatement::build(
                Query::insert()
                    .into_table(TaskTable::Table)
                    .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                    .values([
                        records.task.common.id.to_string().into(),
                        i64::from(records.task.common.revision).into(),
                        serde_json::to_string(&LegacyTask::from(records.task.clone()))?.into(),
                    ])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
            SqlStatement::build(
                Query::insert()
                    .into_table(EventTable::Table)
                    .columns([
                        EventTable::TaskId,
                        EventTable::Revision,
                        EventTable::Document,
                    ])
                    .values([
                        records.task.common.id.to_string().into(),
                        i64::from(records.task.common.revision).into(),
                        serde_json::to_string(&LegacyEvent::from(records.event))?.into(),
                    ])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
            connection
                .pragma_update(
                    &DatabasePragma::UserVersion.to_string(),
                    StorageVersion::DocumentsV1,
                )
                .await?;
            Ok(())
        }
    }

    #[derive(Iden)]
    enum JsonFunction {
        JsonValid,
        JsonExtract,
    }

    impl LegacyFixture {
        // Frozen V3 table definitions keep the old flat JSON constraints independent of V4.
        fn v3_tables() -> [TableCreateStatement; 3] {
            let features = Table::create()
                .table(RepositoryFeatureTable::Table)
                .col(
                    ColumnDef::new(RepositoryFeatureTable::Id)
                        .text()
                        .not_null()
                        .primary_key()
                        .check(Expr::col(RepositoryFeatureTable::Id).ne("")),
                )
                .col(
                    ColumnDef::new(RepositoryFeatureTable::Document)
                        .text()
                        .not_null(),
                )
                .check(
                    Func::cust(JsonFunction::JsonValid)
                        .arg(Expr::col(RepositoryFeatureTable::Document)),
                )
                .check(Expr::col(RepositoryFeatureTable::Id).is(
                    Func::cust(JsonFunction::JsonExtract).args([
                        Expr::col(RepositoryFeatureTable::Document),
                        Expr::val("$.id"),
                    ]),
                ))
                .to_owned();
            let tasks = Table::create()
                .table(RepositoryTaskTable::Table)
                .col(
                    ColumnDef::new(RepositoryTaskTable::FeatureId)
                        .text()
                        .not_null(),
                )
                .col(
                    ColumnDef::new(RepositoryTaskTable::Id)
                        .text()
                        .not_null()
                        .check(Expr::col(RepositoryTaskTable::Id).ne("")),
                )
                .col(
                    ColumnDef::new(RepositoryTaskTable::Revision)
                        .integer()
                        .not_null()
                        .check(Expr::col(RepositoryTaskTable::Revision).gt(0)),
                )
                .col(
                    ColumnDef::new(RepositoryTaskTable::Document)
                        .text()
                        .not_null(),
                )
                .check(
                    Func::cust(JsonFunction::JsonValid)
                        .arg(Expr::col(RepositoryTaskTable::Document)),
                )
                .check(
                    Expr::col(RepositoryTaskTable::Id).is(Func::cust(JsonFunction::JsonExtract)
                        .args([Expr::col(RepositoryTaskTable::Document), Expr::val("$.id")])),
                )
                .check(Expr::col(RepositoryTaskTable::FeatureId).is(
                    Func::cust(JsonFunction::JsonExtract).args([
                        Expr::col(RepositoryTaskTable::Document),
                        Expr::val("$.feature"),
                    ]),
                ))
                .check(Expr::col(RepositoryTaskTable::Revision).is(
                    Func::cust(JsonFunction::JsonExtract).args([
                        Expr::col(RepositoryTaskTable::Document),
                        Expr::val("$.revision"),
                    ]),
                ))
                // The leading feature column indexes both status reads and the parent FK.
                .primary_key(
                    Index::create()
                        .col(RepositoryTaskTable::FeatureId)
                        .col(RepositoryTaskTable::Id),
                )
                .foreign_key(
                    ForeignKey::create()
                        .from(RepositoryTaskTable::Table, RepositoryTaskTable::FeatureId)
                        .to(RepositoryFeatureTable::Table, RepositoryFeatureTable::Id)
                        .on_delete(ForeignKeyAction::Restrict)
                        .on_update(ForeignKeyAction::Restrict),
                )
                .to_owned();
            let events = Table::create()
                .table(RepositoryEventTable::Table)
                .col(
                    ColumnDef::new(RepositoryEventTable::FeatureId)
                        .text()
                        .not_null(),
                )
                .col(
                    ColumnDef::new(RepositoryEventTable::TaskId)
                        .text()
                        .not_null(),
                )
                .col(
                    ColumnDef::new(RepositoryEventTable::Revision)
                        .integer()
                        .not_null()
                        .check(Expr::col(RepositoryEventTable::Revision).gt(0)),
                )
                .col(
                    ColumnDef::new(RepositoryEventTable::Document)
                        .text()
                        .not_null(),
                )
                .check(
                    Func::cust(JsonFunction::JsonValid)
                        .arg(Expr::col(RepositoryEventTable::Document)),
                )
                .check(Expr::col(RepositoryEventTable::TaskId).is(
                    Func::cust(JsonFunction::JsonExtract).args([
                        Expr::col(RepositoryEventTable::Document),
                        Expr::val("$.task.id"),
                    ]),
                ))
                .check(Expr::col(RepositoryEventTable::FeatureId).is(
                    Func::cust(JsonFunction::JsonExtract).args([
                        Expr::col(RepositoryEventTable::Document),
                        Expr::val("$.task.feature"),
                    ]),
                ))
                .check(Expr::col(RepositoryEventTable::Revision).is(
                    Func::cust(JsonFunction::JsonExtract).args([
                        Expr::col(RepositoryEventTable::Document),
                        Expr::val("$.task.revision"),
                    ]),
                ))
                // Covers history ordering and the composite parent FK without redundant indexes.
                .primary_key(
                    Index::create()
                        .col(RepositoryEventTable::FeatureId)
                        .col(RepositoryEventTable::TaskId)
                        .col(RepositoryEventTable::Revision),
                )
                .foreign_key(
                    ForeignKey::create()
                        .from(
                            RepositoryEventTable::Table,
                            (
                                RepositoryEventTable::FeatureId,
                                RepositoryEventTable::TaskId,
                            ),
                        )
                        .to(
                            RepositoryTaskTable::Table,
                            (RepositoryTaskTable::FeatureId, RepositoryTaskTable::Id),
                        )
                        .on_delete(ForeignKeyAction::Restrict)
                        .on_update(ForeignKeyAction::Restrict),
                )
                .to_owned();
            [features, tasks, events]
        }

        async fn repository(connection: &Connection) -> anyhow::Result<()> {
            connection
                .pragma_update(&DatabasePragma::ForeignKeys.to_string(), 1)
                .await?;
            for mut table in Self::v3_tables() {
                table.extra("STRICT");
                connection
                    .execute(table.to_string(SqliteQueryBuilder), ())
                    .await?;
            }
            let records = Records::new()?;
            let agent = AgentId::Development(DevelopmentAgent::RustDev);
            for id in [
                records.feature.id.clone(),
                FeatureId::try_from("second-feature".to_owned())?,
            ] {
                let feature = Feature {
                    id: id.clone(),
                    ..records.feature.clone()
                };
                RecordWriter { connection }.feature(&feature).await?;
                let mut task = records.task.clone();
                task.common.feature = id;
                let created = Event {
                    task: task.clone(),
                    ..records.event.clone()
                };
                let now = task.common.created_at;
                task = task.claim(ClaimAt {
                    agent,
                    ttl: LeaseSeconds::TEN_MINUTES,
                    now,
                })?;
                task.common.revision = task.common.revision.advance()?;
                task.common.progress.summary = Note::from("Original claim evidence".to_owned());
                let claimed = Event {
                    version: RecordVersion::V1,
                    kind: EventKind::Claimed,
                    actor: agent,
                    note: Note::from("Worker claimed the task".to_owned()),
                    task: task.clone(),
                };
                let legacy = LegacyTask::from(task);
                SqlStatement::build(
                    Query::insert()
                        .into_table(RepositoryTaskTable::Table)
                        .columns([
                            RepositoryTaskTable::FeatureId,
                            RepositoryTaskTable::Id,
                            RepositoryTaskTable::Revision,
                            RepositoryTaskTable::Document,
                        ])
                        .values([
                            legacy.feature.to_string().into(),
                            legacy.id.to_string().into(),
                            i64::from(legacy.revision).into(),
                            serde_json::to_string(&legacy)?.into(),
                        ])?
                        .to_owned(),
                )?
                .execute(connection)
                .await?;
                for event in [created, claimed] {
                    let event = LegacyEvent::from(event);
                    SqlStatement::build(
                        Query::insert()
                            .into_table(RepositoryEventTable::Table)
                            .columns([
                                RepositoryEventTable::FeatureId,
                                RepositoryEventTable::TaskId,
                                RepositoryEventTable::Revision,
                                RepositoryEventTable::Document,
                            ])
                            .values([
                                event.task.feature.to_string().into(),
                                event.task.id.to_string().into(),
                                i64::from(event.task.revision).into(),
                                serde_json::to_string(&event)?.into(),
                            ])?
                            .to_owned(),
                    )?
                    .execute(connection)
                    .await?;
                }
            }
            connection
                .pragma_update(
                    &DatabasePragma::UserVersion.to_string(),
                    StorageVersion::RelationalV3,
                )
                .await?;
            Ok(())
        }
    }

    #[derive(Debug, PartialEq)]
    struct RepositorySnapshot {
        features: Vec<Feature>,
        tasks: Vec<Task>,
        events: Vec<Event>,
    }
    impl RepositorySnapshot {
        async fn read(connection: &Connection) -> anyhow::Result<Self> {
            let mut features = Vec::new();
            let mut rows = SqlStatement::build(
                Query::select()
                    .column(RepositoryFeatureTable::Document)
                    .from(RepositoryFeatureTable::Table)
                    .order_by(RepositoryFeatureTable::Id, Order::Asc)
                    .to_owned(),
            )?
            .query(connection)
            .await?;
            while let Some(row) = rows.next().await? {
                features.push(serde_json::from_str(&row.get::<String>(0)?)?);
            }
            let mut tasks = Vec::new();
            let mut rows = SqlStatement::build(
                Query::select()
                    .column(RepositoryTaskTable::Document)
                    .from(RepositoryTaskTable::Table)
                    .order_by(RepositoryTaskTable::FeatureId, Order::Asc)
                    .order_by(RepositoryTaskTable::Id, Order::Asc)
                    .to_owned(),
            )?
            .query(connection)
            .await?;
            while let Some(row) = rows.next().await? {
                tasks.push(serde_json::from_str(&row.get::<String>(0)?)?);
            }
            let mut events = Vec::new();
            let mut rows = SqlStatement::build(
                Query::select()
                    .column(RepositoryEventTable::Document)
                    .from(RepositoryEventTable::Table)
                    .order_by(RepositoryEventTable::FeatureId, Order::Asc)
                    .order_by(RepositoryEventTable::TaskId, Order::Asc)
                    .order_by(RepositoryEventTable::Revision, Order::Asc)
                    .to_owned(),
            )?
            .query(connection)
            .await?;
            while let Some(row) = rows.next().await? {
                events.push(serde_json::from_str(&row.get::<String>(0)?)?);
            }
            Ok(Self {
                features,
                tasks,
                events,
            })
        }
    }

    #[test]
    fn v3_repository_migration_preserves_every_feature_and_historical_snapshot()
    -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = turso::Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LegacyFixture::repository(&connection).await?;
                let expected = RepositorySnapshot::read(&connection).await?;
                assert_eq!(expected.features.len(), 2);
                assert_eq!(expected.tasks.len(), 2);
                assert_eq!(expected.events.len(), 4);
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::CommonTasksV4
                );
                assert_eq!(RepositorySnapshot::read(&connection).await?, expected);
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(RepositorySnapshot::read(&connection).await?, expected);
                anyhow::Ok(())
            })
    }

    #[test]
    fn invalid_v3_repository_rolls_back_replacement_tables_and_history() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = turso::Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LegacyFixture::repository(&connection).await?;
                let original = RepositorySnapshot::read(&connection).await?;
                let removed = original
                    .tasks
                    .first()
                    .ok_or_else(|| anyhow::anyhow!("missing original task"))?
                    .clone();
                connection
                    .pragma_update(&DatabasePragma::ForeignKeys.to_string(), 0)
                    .await?;
                SqlStatement::build(
                    Query::delete()
                        .from_table(RepositoryTaskTable::Table)
                        .and_where(
                            Expr::col(RepositoryTaskTable::FeatureId)
                                .eq(removed.common.feature.to_string()),
                        )
                        .and_where(
                            Expr::col(RepositoryTaskTable::Id).eq(removed.common.id.to_string()),
                        )
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                let expected = RepositorySnapshot::read(&connection).await?;
                assert!(LedgerSchema::migrate(&mut connection).await.is_err());
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::RelationalV3
                );
                assert_eq!(RepositorySnapshot::read(&connection).await?, expected);
                let legacy = LegacyTask::from(removed);
                SqlStatement::build(
                    Query::insert()
                        .into_table(RepositoryTaskTable::Table)
                        .columns([
                            RepositoryTaskTable::FeatureId,
                            RepositoryTaskTable::Id,
                            RepositoryTaskTable::Revision,
                            RepositoryTaskTable::Document,
                        ])
                        .values([
                            legacy.feature.to_string().into(),
                            legacy.id.to_string().into(),
                            i64::from(legacy.revision).into(),
                            serde_json::to_string(&legacy)?.into(),
                        ])?
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::CommonTasksV4
                );
                assert_eq!(RepositorySnapshot::read(&connection).await?, original);
                anyhow::Ok(())
            })
    }

    #[test]
    fn migrations_preserve_history_and_reject_future_versions() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = turso::Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LegacyFixture::create(&connection).await?;
                let mut source_rows = SqlStatement::build(
                    Query::select()
                        .column(EventTable::Document)
                        .from(EventTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let original = source_rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("missing source history"))?
                    .get::<String>(0)?;
                drop(source_rows);
                let original_record: LegacyEvent = serde_json::from_str(&original)?;
                assert_eq!(original_record.task.version, RecordVersion::V1);
                let expected: Event = serde_json::from_str(&original)?;
                assert_eq!(expected.task.ownership, TaskOwnership::Unrecorded);
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::CommonTasksV4
                );
                LedgerSchema::migrate(&mut connection).await?;
                let mut rows = SqlStatement::build(
                    Query::select()
                        .column(EventTable::Document)
                        .from(EventTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let row = rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("missing history"))?;
                let migrated = row.get::<String>(0)?;
                assert_eq!(migrated, serde_json::to_string(&expected)?);
                assert_eq!(serde_json::from_str::<Event>(&migrated)?, expected);
                assert_eq!(expected.task.version, TaskRecordVersion::V2);
                drop(rows);
                connection
                    .pragma_update(&DatabasePragma::UserVersion.to_string(), 99)
                    .await?;
                assert!(LedgerSchema::migrate(&mut connection).await.is_err());
                anyhow::Ok(())
            })
    }
    #[test]
    fn invalid_legacy_relationship_rolls_back_schema_and_data() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = turso::Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LegacyFixture::create(&connection).await?;
                SqlStatement::build(Query::delete().from_table(TaskTable::Table).to_owned())?
                    .execute(&connection)
                    .await?;
                assert!(LedgerSchema::migrate(&mut connection).await.is_err());
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::DocumentsV1
                );
                let mut rows = SqlStatement::build(
                    Query::select()
                        .column(EventTable::Document)
                        .from(EventTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let row = rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("lost history"))?;
                let event: Event = serde_json::from_str(&row.get::<String>(0)?)?;
                drop(rows);
                SqlStatement::build(
                    Query::insert()
                        .into_table(TaskTable::Table)
                        .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                        .values([
                            event.task.common.id.to_string().into(),
                            i64::from(event.task.common.revision).into(),
                            serde_json::to_string(&event.task)?.into(),
                        ])?
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::CommonTasksV4
                );
                anyhow::Ok(())
            })
    }
}
