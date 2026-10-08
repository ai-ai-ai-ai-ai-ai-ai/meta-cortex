//! Version-aware SQL projections of released task documents. V1 is flat; V2/V3
//! share common fields. Unknown versions never satisfy relational identity checks.
use super::relational::{EventTable, JsonFunction, TaskTable};
use crate::versions::{RecordVersion, TaskRecordVersion, TaskRecordVersionV2};
use sea_query::{Expr, ExprTrait, Func, Keyword, SimpleExpr};

#[derive(Clone, Copy)]
pub(super) enum TaskDocument {
    CurrentTask,
    HistoricalEvent,
}
#[derive(Clone, Copy)]
pub(super) enum TaskField {
    Id,
    Feature,
    Revision,
    CreatedAt,
    LastUpdate,
    Summary,
    Extensions,
}
impl TaskDocument {
    fn extract(self, path: &'static str) -> SimpleExpr {
        let document = match self {
            Self::CurrentTask => Expr::col(TaskTable::Document),
            Self::HistoricalEvent => Expr::col(EventTable::Document),
        };
        Func::cust(JsonFunction::JsonExtract)
            .args([document, Expr::val(path)])
            .into()
    }
}
impl TaskField {
    pub(super) fn extract(self, document: TaskDocument) -> SimpleExpr {
        let version = document.extract(match document {
            TaskDocument::CurrentTask => "$.version",
            TaskDocument::HistoricalEvent => "$.task.version",
        });
        Expr::case(
            version.clone().eq(i64::from(RecordVersion::V1)),
            document.extract(self.flat(document)),
        )
        .case(
            version.is_in([
                i64::from(TaskRecordVersionV2::V2),
                i64::from(TaskRecordVersion::V3),
            ]),
            document.extract(self.common(document)),
        )
        .finally(Expr::Keyword(Keyword::Null))
        .into()
    }
    fn flat(self, document: TaskDocument) -> &'static str {
        match document {
            TaskDocument::CurrentTask => match self {
                Self::Id => "$.id",
                Self::Feature => "$.feature",
                Self::Revision => "$.revision",
                Self::CreatedAt => "$.created_at",
                Self::LastUpdate => "$.last_update",
                Self::Summary => "$.progress.summary",
                Self::Extensions => "$.progress.extensions",
            },
            TaskDocument::HistoricalEvent => match self {
                Self::Id => "$.task.id",
                Self::Feature => "$.task.feature",
                Self::Revision => "$.task.revision",
                Self::CreatedAt => "$.task.created_at",
                Self::LastUpdate => "$.task.last_update",
                Self::Summary => "$.task.progress.summary",
                Self::Extensions => "$.task.progress.extensions",
            },
        }
    }
    fn common(self, document: TaskDocument) -> &'static str {
        match document {
            TaskDocument::CurrentTask => match self {
                Self::Id => "$.common.id",
                Self::Feature => "$.common.feature",
                Self::Revision => "$.common.revision",
                Self::CreatedAt => "$.common.created_at",
                Self::LastUpdate => "$.common.last_update",
                Self::Summary => "$.common.progress.summary",
                Self::Extensions => "$.common.progress.extensions",
            },
            TaskDocument::HistoricalEvent => match self {
                Self::Id => "$.task.common.id",
                Self::Feature => "$.task.common.feature",
                Self::Revision => "$.task.common.revision",
                Self::CreatedAt => "$.task.common.created_at",
                Self::LastUpdate => "$.task.common.last_update",
                Self::Summary => "$.task.common.progress.summary",
                Self::Extensions => "$.task.common.progress.extensions",
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::agents::AgentId;
    use crate::model::workflow::TaskOwnership;
    use crate::model::{EventKind, TaskCommon, TaskState, Workspace};
    use crate::store::relational::tests::Records;
    use crate::store::relational::{EventTable, RecordWriter, RelationalSchema, TaskTable};
    use crate::store::sql::SqlStatement;
    use crate::values::Note;
    use crate::versions::{RecordVersion, TaskRecordVersionV2};
    use sea_query::Query;
    use serde::Serialize;
    use tokio::runtime::Builder;

    #[derive(Serialize)]
    struct FlatTask {
        version: RecordVersion,
        #[serde(flatten)]
        common: TaskCommon,
        workspace: Workspace,
        state: TaskState,
    }
    #[derive(Serialize)]
    struct CommonTask {
        version: TaskRecordVersionV2,
        common: TaskCommon,
        ownership: TaskOwnership,
        workspace: Workspace,
        state: TaskState,
    }
    #[derive(Serialize)]
    struct HistoricalEvent<'a, TaskRecord> {
        version: RecordVersion,
        kind: EventKind,
        actor: AgentId,
        note: &'a Note,
        task: &'a TaskRecord,
    }
    struct StoredDocuments {
        task: String,
        event: String,
    }
    struct ConstraintFixture {
        records: Records,
    }
    impl ConstraintFixture {
        fn documents<T: Serialize>(&self, task: &T) -> anyhow::Result<StoredDocuments> {
            let event = &self.records.event;
            Ok(StoredDocuments {
                task: serde_json::to_string(task)?,
                event: serde_json::to_string(&HistoricalEvent {
                    version: RecordVersion::V1,
                    kind: event.kind.clone(),
                    actor: event.actor,
                    note: &event.note,
                    task,
                })?,
            })
        }
        async fn verify(&self, documents: StoredDocuments) -> anyhow::Result<()> {
            let database = turso::Builder::new_local(":memory:").build().await?;
            let connection = database.connect()?;
            RelationalSchema::create(&connection).await?;
            RecordWriter {
                connection: &connection,
            }
            .feature(&self.records.feature)
            .await?;
            let task = &self.records.task.common;
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
                        documents.task.into(),
                    ])?
                    .to_owned(),
            )?
            .execute(&connection)
            .await?;
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
                        task.feature.to_string().into(),
                        task.id.to_string().into(),
                        i64::from(task.revision).into(),
                        documents.event.into(),
                    ])?
                    .to_owned(),
            )?
            .execute(&connection)
            .await?;
            for query in [
                Query::update()
                    .table(TaskTable::Table)
                    .value(TaskTable::Id, "wrong")
                    .to_owned(),
                Query::update()
                    .table(TaskTable::Table)
                    .value(TaskTable::FeatureId, "wrong")
                    .to_owned(),
                Query::update()
                    .table(TaskTable::Table)
                    .value(TaskTable::Revision, i64::from(task.revision.advance()?))
                    .to_owned(),
                Query::update()
                    .table(EventTable::Table)
                    .value(EventTable::TaskId, "wrong")
                    .to_owned(),
                Query::update()
                    .table(EventTable::Table)
                    .value(EventTable::FeatureId, "wrong")
                    .to_owned(),
                Query::update()
                    .table(EventTable::Table)
                    .value(EventTable::Revision, i64::from(task.revision.advance()?))
                    .to_owned(),
            ] {
                assert!(
                    SqlStatement::build(query)?
                        .execute(&connection)
                        .await
                        .is_err()
                );
            }
            Ok(())
        }
    }
    #[test]
    fn every_released_record_shape_rejects_mismatched_task_and_event_keys() -> anyhow::Result<()> {
        let fixture = ConstraintFixture {
            records: Records::new()?,
        };
        let task = &fixture.records.task;
        let documents = [
            fixture.documents(&FlatTask {
                version: RecordVersion::V1,
                common: task.common.clone(),
                workspace: task.workspace.clone(),
                state: task.state.clone(),
            })?,
            fixture.documents(&CommonTask {
                version: TaskRecordVersionV2::V2,
                common: task.common.clone(),
                ownership: task.ownership.clone(),
                workspace: task.workspace.clone(),
                state: task.state.clone(),
            })?,
            fixture.documents(task)?,
        ];
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                for document in documents {
                    fixture.verify(document).await?;
                }
                anyhow::Ok(())
            })
    }
}
