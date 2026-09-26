use super::{LedgerError, sql::SqlStatement};
use crate::model::{Event, Feature, Task};
use sea_query::{
    ColumnDef, Expr, ExprTrait, ForeignKey, ForeignKeyAction, Func, Iden, Index, Query,
    SqliteQueryBuilder, Table, TableCreateStatement,
};
use turso::Connection;

#[derive(Iden)]
pub(super) enum FeatureTable {
    #[iden = "features"]
    Table,
    Id,
    Document,
}
#[derive(Iden)]
pub(super) enum TaskTable {
    #[iden = "tasks"]
    Table,
    FeatureId,
    Id,
    Revision,
    Document,
}
#[derive(Iden)]
pub(super) enum EventTable {
    #[iden = "events"]
    Table,
    FeatureId,
    TaskId,
    Revision,
    Document,
}
#[derive(Iden)]
enum JsonFunction {
    JsonValid,
    JsonExtract,
}

pub(super) struct RelationalSchema;
impl RelationalSchema {
    pub(super) async fn create(connection: &Connection) -> Result<(), LedgerError> {
        for mut table in [
            FeatureTable::create(),
            TaskTable::create(),
            EventTable::create(),
        ] {
            // SeaQuery has no typed SQLite STRICT option.
            table.extra("STRICT");
            connection
                .execute(table.to_string(SqliteQueryBuilder), ())
                .await?;
        }
        Ok(())
    }
}

impl FeatureTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(
                ColumnDef::new(Self::Id)
                    .text()
                    .not_null()
                    .primary_key()
                    .check(Expr::col(Self::Id).ne("")),
            )
            .col(ColumnDef::new(Self::Document).text().not_null())
            .check(Func::cust(JsonFunction::JsonValid).arg(Expr::col(Self::Document)))
            .check(
                Expr::col(Self::Id).is(Func::cust(JsonFunction::JsonExtract)
                    .args([Expr::col(Self::Document), Expr::val("$.id")])),
            )
            .to_owned()
    }
}
impl TaskTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(ColumnDef::new(Self::FeatureId).text().not_null())
            .col(
                ColumnDef::new(Self::Id)
                    .text()
                    .not_null()
                    .check(Expr::col(Self::Id).ne("")),
            )
            .col(
                ColumnDef::new(Self::Revision)
                    .integer()
                    .not_null()
                    .check(Expr::col(Self::Revision).gt(0)),
            )
            .col(ColumnDef::new(Self::Document).text().not_null())
            .check(Func::cust(JsonFunction::JsonValid).arg(Expr::col(Self::Document)))
            .check(
                Expr::col(Self::Id).is(Func::cust(JsonFunction::JsonExtract)
                    .args([Expr::col(Self::Document), Expr::val("$.id")])),
            )
            .check(
                Expr::col(Self::FeatureId).is(Func::cust(JsonFunction::JsonExtract)
                    .args([Expr::col(Self::Document), Expr::val("$.feature")])),
            )
            .check(
                Expr::col(Self::Revision).is(Func::cust(JsonFunction::JsonExtract)
                    .args([Expr::col(Self::Document), Expr::val("$.revision")])),
            )
            // The leading feature column indexes both status reads and the parent FK.
            .primary_key(Index::create().col(Self::FeatureId).col(Self::Id))
            .foreign_key(
                ForeignKey::create()
                    .from(Self::Table, Self::FeatureId)
                    .to(FeatureTable::Table, FeatureTable::Id)
                    .on_delete(ForeignKeyAction::Restrict)
                    .on_update(ForeignKeyAction::Restrict),
            )
            .to_owned()
    }
}
impl EventTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(ColumnDef::new(Self::FeatureId).text().not_null())
            .col(ColumnDef::new(Self::TaskId).text().not_null())
            .col(
                ColumnDef::new(Self::Revision)
                    .integer()
                    .not_null()
                    .check(Expr::col(Self::Revision).gt(0)),
            )
            .col(ColumnDef::new(Self::Document).text().not_null())
            .check(Func::cust(JsonFunction::JsonValid).arg(Expr::col(Self::Document)))
            .check(
                Expr::col(Self::TaskId).is(Func::cust(JsonFunction::JsonExtract)
                    .args([Expr::col(Self::Document), Expr::val("$.task.id")])),
            )
            .check(
                Expr::col(Self::FeatureId).is(Func::cust(JsonFunction::JsonExtract)
                    .args([Expr::col(Self::Document), Expr::val("$.task.feature")])),
            )
            .check(
                Expr::col(Self::Revision).is(Func::cust(JsonFunction::JsonExtract)
                    .args([Expr::col(Self::Document), Expr::val("$.task.revision")])),
            )
            // Covers history ordering and the composite parent FK without redundant indexes.
            .primary_key(
                Index::create()
                    .col(Self::FeatureId)
                    .col(Self::TaskId)
                    .col(Self::Revision),
            )
            .foreign_key(
                ForeignKey::create()
                    .from(Self::Table, (Self::FeatureId, Self::TaskId))
                    .to(TaskTable::Table, (TaskTable::FeatureId, TaskTable::Id))
                    .on_delete(ForeignKeyAction::Restrict)
                    .on_update(ForeignKeyAction::Restrict),
            )
            .to_owned()
    }
}

pub(super) struct RecordWriter<'a> {
    pub connection: &'a Connection,
}
impl RecordWriter<'_> {
    pub(super) async fn feature(&self, feature: &Feature) -> Result<(), LedgerError> {
        SqlStatement::build(
            Query::insert()
                .into_table(FeatureTable::Table)
                .columns([FeatureTable::Id, FeatureTable::Document])
                .values([
                    feature.id.to_string().into(),
                    serde_json::to_string(feature)?.into(),
                ])?
                .to_owned(),
        )?
        .execute(self.connection)
        .await?;
        Ok(())
    }
    pub(super) async fn task(&self, task: &Task) -> Result<(), LedgerError> {
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
                    task.feature.to_string().into(),
                    task.id.to_string().into(),
                    i64::from(task.revision).into(),
                    serde_json::to_string(task)?.into(),
                ])?
                .to_owned(),
        )?
        .execute(self.connection)
        .await?;
        Ok(())
    }
    pub(super) async fn event(&self, event: &Event) -> Result<(), LedgerError> {
        SqlStatement::build(
            Query::insert()
                .into_table(EventTable::Table)
                .columns([
                    EventTable::FeatureId,
                    EventTable::TaskId,
                    EventTable::Revision,
                    EventTable::Document,
                ])
                .values([
                    event.task.feature.to_string().into(),
                    event.task.id.to_string().into(),
                    i64::from(event.task.revision).into(),
                    serde_json::to_string(event)?.into(),
                ])?
                .to_owned(),
        )?
        .execute(self.connection)
        .await?;
        Ok(())
    }
}

#[cfg(test)]
pub mod tests {
    use super::{EventTable, FeatureTable, RecordWriter, TaskTable};
    use crate::agents::{AgentId, GizmoAgent};
    use crate::model::{
        Checkpoint, Event, EventKind, Feature, Progress, Task, TaskState, Workspace,
    };
    use crate::store::schema::LedgerSchema;
    use crate::store::sql::SqlStatement;
    use crate::values::{
        Attempt, BranchName, Extensions, FeatureId, Note, Revision, TaskId, Timestamp,
    };
    use crate::versions::RecordVersion;
    use sea_query::{Expr, ExprTrait, Query};
    use std::path::PathBuf;
    use tokio::runtime;
    use turso::Builder;

    pub(crate) struct Records {
        pub feature: Feature,
        pub task: Task,
        pub event: Event,
    }
    impl Records {
        pub(crate) fn new() -> anyhow::Result<Self> {
            let feature = Feature {
                version: RecordVersion::V1,
                id: FeatureId::try_from("feature".to_owned())?,
                objective: Note::from("O'Brien\n🦀 '; DROP TABLE tasks; --".to_owned()),
                branch: BranchName::try_from("codex/feature".to_owned())?,
                worktree: PathBuf::from("/tmp/feature"),
            };
            let now = Timestamp::now()?;
            let task = Task {
                version: RecordVersion::V1,
                id: TaskId::try_from("task".to_owned())?,
                feature: feature.id.clone(),
                objective: feature.objective.clone(),
                acceptance: vec![Note::from("Checked".to_owned())],
                dependencies: Vec::new(),
                workspace: Workspace::ReadOnly,
                revision: Revision::INITIAL,
                attempt: Attempt::UNCLAIMED,
                state: TaskState::Queued,
                created_at: now,
                last_update: now,
                last_progress: now,
                checkpoint: Checkpoint::Unrecorded,
                progress: Progress {
                    summary: feature.objective.clone(),
                    findings: Vec::new(),
                    next_steps: Vec::new(),
                    checks: Vec::new(),
                    extensions: Extensions::default(),
                },
            };
            let event = Event {
                version: RecordVersion::V1,
                kind: EventKind::Created,
                actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                note: feature.objective.clone(),
                task: task.clone(),
            };
            Ok(Self {
                feature,
                task,
                event,
            })
        }
    }

    #[test]
    fn relational_constraints_protect_keys_parents_and_documents() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LedgerSchema::migrate(&mut connection).await?;
                let records = Records::new()?;
                assert!(
                    RecordWriter {
                        connection: &connection
                    }
                    .task(&records.task)
                    .await
                    .is_err()
                );
                assert!(
                    RecordWriter {
                        connection: &connection
                    }
                    .event(&records.event)
                    .await
                    .is_err()
                );
                RecordWriter {
                    connection: &connection,
                }
                .feature(&records.feature)
                .await?;
                assert!(
                    RecordWriter {
                        connection: &connection
                    }
                    .feature(&records.feature)
                    .await
                    .is_err()
                );
                RecordWriter {
                    connection: &connection,
                }
                .task(&records.task)
                .await?;
                assert!(
                    RecordWriter {
                        connection: &connection
                    }
                    .task(&records.task)
                    .await
                    .is_err()
                );
                RecordWriter {
                    connection: &connection,
                }
                .event(&records.event)
                .await?;
                assert!(
                    RecordWriter {
                        connection: &connection
                    }
                    .event(&records.event)
                    .await
                    .is_err()
                );
                assert!(
                    SqlStatement::build(Query::delete().from_table(TaskTable::Table).to_owned())?
                        .execute(&connection)
                        .await
                        .is_err()
                );
                assert!(
                    SqlStatement::build(
                        Query::delete().from_table(FeatureTable::Table).to_owned()
                    )?
                    .execute(&connection)
                    .await
                    .is_err()
                );
                let mut other = Records::new()?;
                other.feature.id = FeatureId::try_from("other".to_owned())?;
                other.task.feature = other.feature.id.clone();
                other.event.task = other.task.clone();
                RecordWriter {
                    connection: &connection,
                }
                .feature(&other.feature)
                .await?;
                // A task in the first feature cannot satisfy an event's composite parent key.
                assert!(
                    RecordWriter {
                        connection: &connection
                    }
                    .event(&other.event)
                    .await
                    .is_err()
                );
                RecordWriter {
                    connection: &connection,
                }
                .task(&other.task)
                .await?;
                RecordWriter {
                    connection: &connection,
                }
                .event(&other.event)
                .await?;
                for document in [
                    "not json".to_owned(),
                    serde_json::to_string(&records.feature)?,
                    serde_json::to_string(&other.task)?,
                ] {
                    assert!(
                        SqlStatement::build(
                            Query::update()
                                .table(TaskTable::Table)
                                .value(TaskTable::Document, document)
                                .and_where(
                                    Expr::col(TaskTable::FeatureId)
                                        .eq(records.feature.id.to_string())
                                )
                                .to_owned()
                        )?
                        .execute(&connection)
                        .await
                        .is_err()
                    );
                }
                for revision in [Expr::val(0), Expr::val(-1), Expr::val("text"), Expr::val(2)] {
                    assert!(
                        SqlStatement::build(
                            Query::update()
                                .table(TaskTable::Table)
                                .value(TaskTable::Revision, revision.clone())
                                .to_owned()
                        )?
                        .execute(&connection)
                        .await
                        .is_err()
                    );
                    assert!(
                        SqlStatement::build(
                            Query::update()
                                .table(EventTable::Table)
                                .value(EventTable::Revision, revision)
                                .to_owned()
                        )?
                        .execute(&connection)
                        .await
                        .is_err()
                    );
                }
                assert!(
                    SqlStatement::build(
                        Query::update()
                            .table(EventTable::Table)
                            .value(EventTable::TaskId, "missing")
                            .to_owned()
                    )?
                    .execute(&connection)
                    .await
                    .is_err()
                );
                assert!(
                    SqlStatement::build(
                        Query::update()
                            .table(FeatureTable::Table)
                            .value(FeatureTable::Id, "renamed")
                            .to_owned()
                    )?
                    .execute(&connection)
                    .await
                    .is_err()
                );
                let mut rows = SqlStatement::build(
                    Query::select()
                        .column(TaskTable::Document)
                        .from(TaskTable::Table)
                        .and_where(
                            Expr::col(TaskTable::FeatureId).eq(records.feature.id.to_string()),
                        )
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let row = rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("missing task"))?;
                assert_eq!(row.get::<String>(0)?, serde_json::to_string(&records.task)?);
                drop(rows);
                let mut reopened = database.connect()?;
                LedgerSchema::migrate(&mut reopened).await?;
                assert!(
                    SqlStatement::build(Query::delete().from_table(TaskTable::Table).to_owned())?
                        .execute(&reopened)
                        .await
                        .is_err()
                );
                assert!(
                    SqlStatement::build(
                        Query::insert()
                            .into_table(FeatureTable::Table)
                            .columns([FeatureTable::Document])
                            .values([serde_json::to_string(&records.feature)?.into()])?
                            .to_owned()
                    )?
                    .execute(&reopened)
                    .await
                    .is_err()
                );
                anyhow::Ok(())
            })
    }
}
