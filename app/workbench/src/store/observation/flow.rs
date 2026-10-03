use super::{Observation, Page, PageEnd, PageIndex, TaskPage};
use crate::agents::AgentId;
use crate::model::workflow::TaskOwnership;
use crate::model::{Checkpoint, Event, EventKind, Feature, Task, TaskState};
mod attempts;
use crate::request::TaskQuery;
use crate::store::relational::{EventTable, FeatureTable, JsonFunction, TaskTable};
use crate::store::sql::SqlStatement;
use crate::values::{Attempt, CommitId, FeatureId, Note, Revision, Timestamp};
use crate::{HistoryPage, LedgerError};
pub use attempts::{AttemptFlow, AttemptProgress, AttemptStart};
use schemars::JsonSchema;
use sea_query::{Expr, ExprTrait, Func, Order, Query, SimpleExpr};
use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum FlowState {
    Queued,
    Working,
    Blocked,
    Ready,
    Integrated,
    Completed,
    Cancelled,
}
impl FlowState {
    const ALL: [Self; 7] = [
        Self::Queued,
        Self::Working,
        Self::Blocked,
        Self::Ready,
        Self::Integrated,
        Self::Completed,
        Self::Cancelled,
    ];
    fn predicate(self) -> SimpleExpr {
        let kind = Func::cust(JsonFunction::JsonExtract)
            .args([Expr::col(TaskTable::Document), Expr::val("$.state.kind")]);
        let phase = Func::cust(JsonFunction::JsonExtract).args([
            Expr::col(TaskTable::Document),
            Expr::val("$.state.assignment.phase.kind"),
        ]);
        match self {
            Self::Queued => kind.eq("queued"),
            Self::Working => kind.eq("active").and(phase.eq("working")),
            Self::Blocked => kind.eq("active").and(phase.eq("blocked")),
            Self::Ready => kind.eq("ready"),
            Self::Integrated => kind.eq("integrated"),
            Self::Completed => kind.eq("completed"),
            Self::Cancelled => kind.eq("cancelled"),
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(transparent)]
pub struct TaskCount(u64);
impl TryFrom<i64> for TaskCount {
    type Error = LedgerError;
    fn try_from(value: i64) -> Result<Self, Self::Error> {
        Ok(Self(u64::try_from(value).map_err(|_| {
            LedgerError::Invalid("negative task count")
        })?))
    }
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct FlowCount {
    pub state: FlowState,
    pub count: TaskCount,
}
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RecordedActor {
    Unrecorded,
    Recorded { agent: AgentId },
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct RecordedCommit {
    pub commit: CommitId,
    pub actor: AgentId,
    pub at: Timestamp,
    pub revision: Revision,
    pub attempt: Attempt,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct Milestone {
    pub kind: EventKind,
    pub actor: AgentId,
    pub at: Timestamp,
    pub revision: Revision,
    pub attempt: Attempt,
    pub note: Note,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct TaskFlow {
    pub task: Task,
    pub created_by: RecordedActor,
    pub worker: RecordedActor,
    pub checkpoints: Vec<RecordedCommit>,
    pub integrations: Vec<RecordedCommit>,
    pub milestones: Vec<Milestone>,
    pub attempts: Vec<AttemptFlow>,
    pub history_end: PageEnd,
}
/// Task activity bounds, not feature lifecycle events (which are not stored).
#[derive(Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FeatureActivity {
    Empty,
    Recorded {
        first_task_at: Timestamp,
        last_activity_at: Timestamp,
    },
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct FeatureFlow {
    pub feature: Feature,
    pub counts: Vec<FlowCount>,
    pub activity: FeatureActivity,
    pub tasks: Page<TaskFlow>,
    pub observed_at: Timestamp,
}
impl Observation {
    async fn flow_totals(
        &self,
        feature: FeatureId,
    ) -> Result<(Vec<FlowCount>, FeatureActivity), LedgerError> {
        let connection = self.connect().await?;
        let mut query = Query::select();
        query
            .from(TaskTable::Table)
            .and_where(Expr::col(TaskTable::FeatureId).eq(feature.to_string()));
        for state in FlowState::ALL {
            query.expr(Func::count(Expr::case(state.predicate(), Expr::val(1))));
        }
        query.expr(Func::min(Func::cust(JsonFunction::JsonExtract).args([
            Expr::col(TaskTable::Document),
            Expr::val("$.common.created_at"),
        ])));
        query.expr(Func::max(Func::cust(JsonFunction::JsonExtract).args([
            Expr::col(TaskTable::Document),
            Expr::val("$.common.last_update"),
        ])));
        let mut rows = SqlStatement::build(query)?.query(&connection).await?;
        let row = rows
            .next()
            .await?
            .ok_or(LedgerError::Invalid("missing workflow counts"))?;
        let mut counts = Vec::new();
        for (index, state) in FlowState::ALL.into_iter().enumerate() {
            counts.push(FlowCount {
                state,
                count: TaskCount::try_from(row.get::<i64>(index)?)?,
            });
        }
        let activity = match counts.iter().any(|count| count.count.0 > 0) {
            true => FeatureActivity::Recorded {
                first_task_at: Timestamp::try_from(row.get::<i64>(7)?)?,
                last_activity_at: Timestamp::try_from(row.get::<i64>(8)?)?,
            },
            false => FeatureActivity::Empty,
        };
        Ok((counts, activity))
    }
    pub async fn flow(&self, request: TaskPage) -> Result<FeatureFlow, LedgerError> {
        let feature = self.flow_feature(request.feature.clone()).await?;
        let (counts, activity) = self.flow_totals(request.feature.clone()).await?;
        let page = self.tasks(request).await?;
        let mut records = Vec::new();
        for task in page.records {
            records.push(self.task_flow(task).await?);
        }
        Ok(FeatureFlow {
            feature,
            counts,
            activity,
            tasks: Page {
                records,
                end: page.end,
            },
            observed_at: Timestamp::now()?,
        })
    }
    async fn flow_feature(&self, feature: FeatureId) -> Result<Feature, LedgerError> {
        let connection = self.connect().await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Document)
                .from(FeatureTable::Table)
                .and_where(Expr::col(FeatureTable::Id).eq(feature.to_string()))
                .limit(1)
                .to_owned(),
        )?
        .query(&connection)
        .await?;
        let row = rows.next().await?.ok_or(LedgerError::NotFound)?;
        Ok(serde_json::from_str(&row.get::<String>(0)?)?)
    }
    async fn task_flow(&self, task: Task) -> Result<TaskFlow, LedgerError> {
        let history = self
            .history(HistoryPage {
                feature: task.common.feature.clone(),
                task: task.common.id.clone(),
                page: PageIndex::FIRST,
            })
            .await?;
        let created_by = self
            .task_creator(TaskQuery {
                feature: task.common.feature.clone(),
                task: task.common.id.clone(),
            })
            .await?;
        let flow = TaskFlow {
            worker: RecordedActor::worker(&task),
            task,
            created_by,
            checkpoints: Vec::new(),
            integrations: Vec::new(),
            milestones: Vec::new(),
            attempts: Vec::new(),
            history_end: history.end,
        };
        Ok(history.records.into_iter().fold(flow, TaskFlow::recording))
    }
    async fn task_creator(&self, request: TaskQuery) -> Result<RecordedActor, LedgerError> {
        let connection = self.connect().await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(EventTable::Document)
                .from(EventTable::Table)
                .and_where(Expr::col(EventTable::FeatureId).eq(request.feature.to_string()))
                .and_where(Expr::col(EventTable::TaskId).eq(request.task.to_string()))
                .order_by(EventTable::Revision, Order::Asc)
                .limit(1)
                .to_owned(),
        )?
        .query(&connection)
        .await?;
        match rows.next().await? {
            Some(row) => Ok(RecordedActor::creator(serde_json::from_str(
                &row.get::<String>(0)?,
            )?)),
            None => Ok(RecordedActor::Unrecorded),
        }
    }
}
impl RecordedActor {
    fn worker(task: &Task) -> Self {
        match &task.ownership {
            TaskOwnership::Assigned { assignment } => Self::Recorded {
                agent: assignment.agent,
            },
            TaskOwnership::Unrecorded => Self::from_state(&task.state),
        }
    }
    fn from_state(state: &TaskState) -> Self {
        match state {
            TaskState::Active { assignment } => Self::Recorded {
                agent: assignment.agent,
            },
            TaskState::Ready { agent, .. } | TaskState::Completed { agent, .. } => {
                Self::Recorded { agent: *agent }
            }
            TaskState::Queued | TaskState::Integrated { .. } | TaskState::Cancelled { .. } => {
                Self::Unrecorded
            }
        }
    }
    #[must_use]
    fn observing(self, state: &TaskState) -> Self {
        match self {
            actor @ Self::Recorded { .. } => actor,
            Self::Unrecorded => Self::from_state(state),
        }
    }
    fn creator(event: Event) -> Self {
        match event.kind {
            EventKind::Created => Self::Recorded { agent: event.actor },
            EventKind::Claimed
            | EventKind::Assigned
            | EventKind::Heartbeat
            | EventKind::Progress
            | EventKind::Checkpoint
            | EventKind::Ready
            | EventKind::Integrated
            | EventKind::Completed
            | EventKind::Requeued
            | EventKind::Cancelled => Self::Unrecorded,
        }
    }
}
impl TaskFlow {
    #[must_use]
    fn recording(mut self, event: Event) -> Self {
        self = self.recording_attempt(&event);
        match &self.task.ownership {
            TaskOwnership::Assigned { .. } => {}
            TaskOwnership::Unrecorded => self.worker = self.worker.observing(&event.task.state),
        }
        match event.kind {
            EventKind::Checkpoint => match &event.task.common.checkpoint {
                Checkpoint::Git { commit } => self.checkpoints.push(RecordedCommit {
                    commit: commit.clone(),
                    actor: event.actor,
                    at: event.task.common.last_update,
                    revision: event.task.common.revision,
                    attempt: event.task.common.attempt,
                }),
                Checkpoint::Unrecorded => {}
            },
            EventKind::Integrated => match &event.task.state {
                TaskState::Integrated { commit } => self.integrations.push(RecordedCommit {
                    commit: commit.clone(),
                    actor: event.actor,
                    at: event.task.common.last_update,
                    revision: event.task.common.revision,
                    attempt: event.task.common.attempt,
                }),
                TaskState::Queued
                | TaskState::Active { .. }
                | TaskState::Ready { .. }
                | TaskState::Completed { .. }
                | TaskState::Cancelled { .. } => {}
            },
            EventKind::Created
            | EventKind::Claimed
            | EventKind::Assigned
            | EventKind::Completed
            | EventKind::Heartbeat
            | EventKind::Progress
            | EventKind::Ready
            | EventKind::Requeued
            | EventKind::Cancelled => {}
        }
        match event.kind {
            EventKind::Heartbeat | EventKind::Progress => {}
            kind @ (EventKind::Created
            | EventKind::Claimed
            | EventKind::Assigned
            | EventKind::Checkpoint
            | EventKind::Ready
            | EventKind::Integrated
            | EventKind::Completed
            | EventKind::Requeued
            | EventKind::Cancelled) => self.milestones.push(Milestone {
                kind,
                actor: event.actor,
                at: event.task.common.last_update,
                revision: event.task.common.revision,
                attempt: event.task.common.attempt,
                note: event.note,
            }),
        }
        self
    }
}
