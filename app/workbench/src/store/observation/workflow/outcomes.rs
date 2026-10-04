use super::{FlowState, JsonPath, LedgerReader, RecordLimit};
use crate::LedgerError;
use crate::agents::AgentId;
use crate::model::workflow::TaskOwnership;
use crate::model::{Feature, Task, TaskState};
use crate::store::relational::TaskTable;
use crate::store::sql::SqlStatement;
use crate::values::{TaskId, Timestamp};
use schemars::JsonSchema;
use sea_query::{Expr, ExprTrait, Order, Query};
use serde::Serialize;
use std::collections::BTreeSet;

/// A task no other recorded task depends on: something the feature delivers.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct FeatureOutcome {
    pub task: TaskId,
    pub status: FlowState,
    pub last_update: Timestamp,
}
/// The task a coordinator most recently integrated or completed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LatestDelivery {
    Nothing,
    Delivered {
        task: TaskId,
        status: FlowState,
        at: Timestamp,
    },
}
/// Gizmo coordinators plan, review, and integrate; specialists produce the deliverables.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TaskRole {
    Coordination,
    Delivery,
}
impl From<&Task> for TaskRole {
    fn from(task: &Task) -> Self {
        let agent = match (&task.ownership, &task.state) {
            (TaskOwnership::Assigned { assignment }, _) => Some(assignment.agent),
            (TaskOwnership::Unrecorded, TaskState::Active { assignment }) => Some(assignment.agent),
            (
                TaskOwnership::Unrecorded,
                TaskState::Ready { agent, .. } | TaskState::Completed { agent, .. },
            ) => Some(*agent),
            (
                TaskOwnership::Unrecorded,
                TaskState::Queued | TaskState::Integrated { .. } | TaskState::Cancelled { .. },
            ) => None,
        };
        match agent {
            Some(AgentId::Gizmo(_)) => Self::Coordination,
            Some(
                AgentId::Development(_)
                | AgentId::Ai(_)
                | AgentId::Security(_)
                | AgentId::Sre(_)
                | AgentId::Delivery(_),
            )
            | None => Self::Delivery,
        }
    }
}
struct TaskShape {
    id: TaskId,
    role: TaskRole,
    status: FlowState,
    dependencies: Vec<TaskId>,
    last_update: Timestamp,
}
impl From<Task> for TaskShape {
    fn from(task: Task) -> Self {
        Self {
            role: TaskRole::from(&task),
            status: FlowState::from(&task.state),
            id: task.common.id,
            dependencies: task.common.dependencies,
            last_update: task.common.last_update,
        }
    }
}
/// Recorded task states and dependencies, most recently updated first.
pub(super) struct FeatureShape(Vec<TaskShape>);
impl FeatureShape {
    /// Cancelled tasks are closed without a result, and coordination is not a deliverable.
    pub fn outcomes(&self) -> Vec<FeatureOutcome> {
        let Self(tasks) = self;
        let depended = tasks
            .iter()
            .flat_map(|task| &task.dependencies)
            .collect::<BTreeSet<_>>();
        tasks
            .iter()
            .filter(|task| !depended.contains(&task.id))
            .filter(|task| task.status != FlowState::Cancelled)
            .filter(|task| task.role == TaskRole::Delivery)
            .map(|task| FeatureOutcome {
                task: task.id.clone(),
                status: task.status,
                last_update: task.last_update,
            })
            .collect()
    }
    pub fn latest_delivery(&self) -> LatestDelivery {
        let Self(tasks) = self;
        tasks
            .iter()
            .find(|task| matches!(task.status, FlowState::Integrated | FlowState::Completed))
            .map_or(LatestDelivery::Nothing, |task| LatestDelivery::Delivered {
                task: task.id.clone(),
                status: task.status,
                at: task.last_update,
            })
    }
}
impl LedgerReader {
    pub(super) async fn shape(&self, feature: &Feature) -> Result<FeatureShape, LedgerError> {
        let last_update = JsonPath::from("$.common.last_update").extract();
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Document)
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(feature.id.to_string()))
                .order_by_expr(last_update.into(), Order::Desc)
                .limit(RecordLimit::FEATURE_TASKS.sql_count())
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut tasks = Vec::new();
        while let Some(row) = rows.next().await? {
            let task: Task = serde_json::from_str(&row.get::<String>(0)?)?;
            tasks.push(TaskShape::from(task));
        }
        Ok(FeatureShape(tasks))
    }
}

#[cfg(test)]
mod tests {
    use super::{FeatureShape, LatestDelivery, TaskRole, TaskShape};
    use crate::store::observation::workflow::FlowState;
    use crate::values::{TaskId, Timestamp};

    struct Shape {
        id: &'static str,
        role: TaskRole,
        status: FlowState,
        dependencies: &'static [&'static str],
        last_update: i64,
    }
    impl TryFrom<Shape> for TaskShape {
        type Error = anyhow::Error;
        fn try_from(shape: Shape) -> Result<Self, Self::Error> {
            Ok(Self {
                id: TaskId::try_from(shape.id.to_owned())?,
                role: shape.role,
                status: shape.status,
                dependencies: shape
                    .dependencies
                    .iter()
                    .map(|id| TaskId::try_from((*id).to_owned()))
                    .collect::<Result<_, _>>()?,
                last_update: Timestamp::try_from(shape.last_update)?,
            })
        }
    }
    #[test]
    fn outcomes_are_live_tasks_nothing_depends_on() -> anyhow::Result<()> {
        let shape = FeatureShape(
            [
                Shape {
                    role: TaskRole::Delivery,
                    id: "release",
                    status: FlowState::Working,
                    dependencies: &["build", "review"],
                    last_update: 40,
                },
                Shape {
                    role: TaskRole::Delivery,
                    id: "dropped",
                    status: FlowState::Cancelled,
                    dependencies: &[],
                    last_update: 30,
                },
                Shape {
                    role: TaskRole::Delivery,
                    id: "review",
                    status: FlowState::Completed,
                    dependencies: &["build"],
                    last_update: 20,
                },
                Shape {
                    role: TaskRole::Delivery,
                    id: "build",
                    status: FlowState::Integrated,
                    dependencies: &[],
                    last_update: 10,
                },
                Shape {
                    role: TaskRole::Coordination,
                    id: "prime",
                    status: FlowState::Working,
                    dependencies: &[],
                    last_update: 5,
                },
            ]
            .into_iter()
            .map(TaskShape::try_from)
            .collect::<Result<_, _>>()?,
        );
        let outcomes = shape
            .outcomes()
            .into_iter()
            .map(|outcome| (outcome.task.to_string(), outcome.status))
            .collect::<Vec<_>>();
        assert_eq!(outcomes, [("release".to_owned(), FlowState::Working)]);
        assert_eq!(
            shape.latest_delivery(),
            LatestDelivery::Delivered {
                task: TaskId::try_from("review".to_owned())?,
                status: FlowState::Completed,
                at: Timestamp::try_from(20)?,
            }
        );
        assert_eq!(
            FeatureShape(vec![]).latest_delivery(),
            LatestDelivery::Nothing
        );
        Ok(())
    }
}
