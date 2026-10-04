//! Read-side workflow projections. Storage stays the shared ledger contract; these
//! views extract only the fields observers need instead of decoding whole snapshots.
mod outcomes;
mod pull_requests;

use super::{LedgerReader, Observation, Page, PageIndex, RecordLimit};
use crate::LedgerError;
use crate::agents::AgentId;
use crate::model::{Feature, LeaseHealth, Phase, TaskState};
use crate::store::relational::{EventTable, FeatureTable, JsonFunction, TaskTable};
use crate::store::sql::SqlStatement;
use crate::values::{Note, TaskId, Timestamp};
pub use outcomes::{FeatureOutcome, LatestDelivery};
pub use pull_requests::PullRequest;
use schemars::JsonSchema;
use sea_query::{Expr, ExprTrait, Func, FunctionCall, Order, Query, SimpleExpr};
use serde::Serialize;

/// One observable workflow state; `Working` and `Blocked` split the active assignment phase.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, JsonSchema)]
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
        let kind = JsonPath::from("$.state.kind").extract();
        let phase = JsonPath::from("$.state.assignment.phase.kind").extract();
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
impl From<&TaskState> for FlowState {
    fn from(state: &TaskState) -> Self {
        match state {
            TaskState::Queued => Self::Queued,
            TaskState::Active { assignment } => match assignment.phase {
                Phase::Working => Self::Working,
                Phase::Blocked { .. } => Self::Blocked,
            },
            TaskState::Ready { .. } => Self::Ready,
            TaskState::Integrated { .. } => Self::Integrated,
            TaskState::Completed { .. } => Self::Completed,
            TaskState::Cancelled { .. } => Self::Cancelled,
        }
    }
}

/// A JSON path inside the task document column.
struct JsonPath(&'static str);
impl From<&'static str> for JsonPath {
    fn from(path: &'static str) -> Self {
        Self(path)
    }
}
impl JsonPath {
    fn extract(self) -> FunctionCall {
        let Self(path) = self;
        Func::cust(JsonFunction::JsonExtract)
            .args([Expr::col(TaskTable::Document), Expr::val(path)])
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Serialize, JsonSchema)]
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
impl TaskCount {
    #[must_use]
    fn plus(self, other: Self) -> Self {
        let (Self(left), Self(right)) = (self, other);
        Self(left.saturating_add(right))
    }
    #[must_use]
    fn increment(self) -> Self {
        self.plus(Self(1))
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct FlowCount {
    pub state: FlowState,
    pub count: TaskCount,
}
/// Per-state counts for any set of tasks, in workflow order with every state present.
#[derive(Clone, Debug, PartialEq, Eq)]
struct StateCounts(Vec<FlowCount>);
impl StateCounts {
    fn of(&self, state: FlowState) -> TaskCount {
        let Self(counts) = self;
        counts
            .iter()
            .filter(|count| count.state == state)
            .fold(TaskCount::default(), |total, count| total.plus(count.count))
    }
    fn total(&self) -> TaskCount {
        FlowState::ALL
            .into_iter()
            .fold(TaskCount::default(), |total, state| {
                total.plus(self.of(state))
            })
    }
    fn completion(&self) -> Completion {
        Completion {
            finished: self
                .of(FlowState::Integrated)
                .plus(self.of(FlowState::Completed)),
            cancelled: self.of(FlowState::Cancelled),
            total: self.total(),
        }
    }
}
/// Finished work over all recorded work; cancelled tasks are closed but not finished.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct Completion {
    pub finished: TaskCount,
    pub cancelled: TaskCount,
    pub total: TaskCount,
}

/// Task activity bounds, not feature lifecycle events (which are not stored).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FeatureActivity {
    Empty,
    Recorded {
        first_task_at: Timestamp,
        last_activity_at: Timestamp,
    },
}
/// The single headline an observer needs first; attention outranks progress.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowCondition {
    Empty,
    Attention,
    Active,
    Waiting,
    Finished,
}
struct ConditionTally {
    total: TaskCount,
    attention: TaskCount,
    active: TaskCount,
    queued: TaskCount,
}
impl From<ConditionTally> for WorkflowCondition {
    fn from(tally: ConditionTally) -> Self {
        match tally {
            ConditionTally {
                total: TaskCount(0),
                ..
            } => Self::Empty,
            ConditionTally {
                attention: TaskCount(1..),
                ..
            } => Self::Attention,
            ConditionTally {
                active: TaskCount(1..),
                ..
            } => Self::Active,
            ConditionTally {
                queued: TaskCount(1..),
                ..
            } => Self::Waiting,
            ConditionTally { .. } => Self::Finished,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct WorkflowTotals {
    pub counts: Vec<FlowCount>,
    pub completion: Completion,
    /// Active tasks whose lease expired before the observation.
    pub stalled: TaskCount,
    pub activity: FeatureActivity,
    pub condition: WorkflowCondition,
}
/// Work currently held by an agent, extracted without loading full task documents.
#[derive(Clone, Debug, PartialEq, Serialize, JsonSchema)]
pub struct ActiveWork {
    pub task: TaskId,
    pub agent: AgentId,
    pub status: FlowState,
    pub lease: LeaseHealth,
    pub blocker: Blocker,
    pub summary: Note,
    pub last_update: Timestamp,
}
/// Why held work cannot proceed, as its worker recorded it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Blocker {
    Unblocked,
    Blocked { reason: Note },
}
#[derive(Clone, Debug, PartialEq, Serialize, JsonSchema)]
pub struct FeatureSummary {
    pub feature: Feature,
    pub totals: WorkflowTotals,
    pub active: Vec<ActiveWork>,
    /// Distinct roles that actually authored saved events.
    pub actors: Vec<AgentId>,
    /// Pull requests recorded in task progress extensions, most often recorded first.
    pub pull_requests: Vec<PullRequest>,
    /// Live tasks no other task depends on, most recently updated first.
    pub outcomes: Vec<FeatureOutcome>,
    pub latest_delivery: LatestDelivery,
}

struct SummaryQuery {
    feature: Feature,
    now: Timestamp,
}
struct ActiveQuery<'feature> {
    feature: &'feature Feature,
    now: Timestamp,
}
impl Observation {
    /// Most recently active features first; features without tasks follow in ID order.
    pub async fn summaries(&self, page: PageIndex) -> Result<Page<FeatureSummary>, LedgerError> {
        let reader = self.reader().await?;
        let now = Timestamp::now()?;
        let features = reader.recent_features(page).await?;
        let mut records = Vec::new();
        for feature in features.records {
            records.push(reader.summary(SummaryQuery { feature, now }).await?);
        }
        Ok(Page {
            records,
            end: features.end,
        })
    }
}
impl LedgerReader {
    /// Latest task update first; features without tasks follow in ID order.
    async fn recent_features(&self, page: PageIndex) -> Result<Page<Feature>, LedgerError> {
        let latest = Func::max(Func::cust(JsonFunction::JsonExtract).args([
            Expr::col((TaskTable::Table, TaskTable::Document)),
            Expr::val("$.common.last_update"),
        ]));
        let mut rows = SqlStatement::build(
            Query::select()
                .column((FeatureTable::Table, FeatureTable::Document))
                .from(FeatureTable::Table)
                .left_join(
                    TaskTable::Table,
                    Expr::col((TaskTable::Table, TaskTable::FeatureId))
                        .equals((FeatureTable::Table, FeatureTable::Id)),
                )
                .group_by_col((FeatureTable::Table, FeatureTable::Id))
                .group_by_col((FeatureTable::Table, FeatureTable::Document))
                .order_by_expr(latest.into(), Order::Desc)
                .order_by((FeatureTable::Table, FeatureTable::Id), Order::Asc)
                .offset(page.offset())
                .limit(RecordLimit::PAGE.probe())
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(RecordLimit::PAGE.bound(records))
    }
    async fn summary(&self, query: SummaryQuery) -> Result<FeatureSummary, LedgerError> {
        let SummaryQuery { feature, now } = query;
        let mut select = Query::select();
        select
            .from(TaskTable::Table)
            .and_where(Expr::col(TaskTable::FeatureId).eq(feature.id.to_string()));
        for state in FlowState::ALL {
            select.expr(Func::count(Expr::case(state.predicate(), Expr::val(1))));
        }
        select.expr(Func::min(JsonPath::from("$.common.created_at").extract()));
        select.expr(Func::max(JsonPath::from("$.common.last_update").extract()));
        let mut rows = SqlStatement::build(select)?.query(&self.connection).await?;
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
        let counts = StateCounts(counts);
        let activity = match counts.total() {
            TaskCount(0) => FeatureActivity::Empty,
            TaskCount(1..) => FeatureActivity::Recorded {
                first_task_at: Timestamp::try_from(row.get::<i64>(7)?)?,
                last_activity_at: Timestamp::try_from(row.get::<i64>(8)?)?,
            },
        };
        let active = self
            .active(ActiveQuery {
                feature: &feature,
                now,
            })
            .await?;
        let stalled = active
            .iter()
            .filter(|work| work.lease == LeaseHealth::Expired)
            .fold(TaskCount::default(), |total, _| total.increment());
        let condition = WorkflowCondition::from(ConditionTally {
            total: counts.total(),
            attention: counts.of(FlowState::Blocked).plus(stalled),
            active: counts
                .of(FlowState::Working)
                .plus(counts.of(FlowState::Ready)),
            queued: counts.of(FlowState::Queued),
        });
        let StateCounts(flow) = counts.clone();
        let pull_requests = self.pull_requests(&feature).await?;
        let shape = self.shape(&feature).await?;
        let actors = self.actors(&feature).await?;
        Ok(FeatureSummary {
            feature,
            totals: WorkflowTotals {
                completion: counts.completion(),
                counts: flow,
                stalled,
                activity,
                condition,
            },
            active,
            actors,
            pull_requests,
            outcomes: shape.outcomes(),
            latest_delivery: shape.latest_delivery(),
        })
    }
    async fn actors(&self, feature: &Feature) -> Result<Vec<AgentId>, LedgerError> {
        let actor = Func::cust(JsonFunction::JsonExtract)
            .args([Expr::col(EventTable::Document), Expr::val("$.actor")]);
        let mut rows = SqlStatement::build(
            Query::select()
                .distinct()
                .expr(actor.clone())
                .from(EventTable::Table)
                .and_where(Expr::col(EventTable::FeatureId).eq(feature.id.to_string()))
                .order_by_expr(actor.into(), Order::Asc)
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut actors = Vec::new();
        while let Some(row) = rows.next().await? {
            actors.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(actors)
    }
    async fn active(&self, query: ActiveQuery<'_>) -> Result<Vec<ActiveWork>, LedgerError> {
        let last_update = JsonPath::from("$.common.last_update").extract();
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Id)
                .expr(JsonPath::from("$.state").extract())
                .expr(JsonPath::from("$.common.progress.summary").extract())
                .expr(last_update.clone())
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(query.feature.id.to_string()))
                .and_where(
                    JsonPath::from("$.state.kind")
                        .extract()
                        .is_in(["active", "ready"]),
                )
                .order_by_expr(last_update.into(), Order::Desc)
                .limit(RecordLimit::PAGE.sql_count())
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut active = Vec::new();
        while let Some(row) = rows.next().await? {
            let state: TaskState = serde_json::from_str(&row.get::<String>(1)?)?;
            let held = match &state {
                TaskState::Active { assignment } => HeldWork::Held {
                    agent: assignment.agent,
                    lease: assignment.lease(query.now),
                    blocker: match &assignment.phase {
                        Phase::Working => Blocker::Unblocked,
                        Phase::Blocked { reason } => Blocker::Blocked {
                            reason: reason.clone(),
                        },
                    },
                },
                TaskState::Ready { agent, .. } => HeldWork::Held {
                    agent: *agent,
                    lease: LeaseHealth::NotRunning,
                    blocker: Blocker::Unblocked,
                },
                TaskState::Queued
                | TaskState::Integrated { .. }
                | TaskState::Completed { .. }
                | TaskState::Cancelled { .. } => HeldWork::Released,
            };
            match held {
                HeldWork::Held {
                    agent,
                    lease,
                    blocker,
                } => active.push(ActiveWork {
                    task: TaskId::try_from(row.get::<String>(0)?)?,
                    agent,
                    status: FlowState::from(&state),
                    lease,
                    blocker,
                    summary: Note::from(row.get::<String>(2)?),
                    last_update: Timestamp::try_from(row.get::<i64>(3)?)?,
                }),
                HeldWork::Released => {}
            }
        }
        Ok(active)
    }
}
enum HeldWork {
    Held {
        agent: AgentId,
        lease: LeaseHealth,
        blocker: Blocker,
    },
    Released,
}

#[cfg(test)]
mod tests {
    use super::{ConditionTally, FlowCount, FlowState, StateCounts, TaskCount, WorkflowCondition};
    use crate::agents::{AgentId, GizmoAgent};
    use crate::model::{Assignment, Phase, TaskState};
    use crate::values::{Attempt, Note, Timestamp};

    #[test]
    fn condition_prefers_attention_then_activity_then_waiting() {
        let cases = [
            ([0, 0, 0, 0], WorkflowCondition::Empty),
            ([3, 1, 1, 1], WorkflowCondition::Attention),
            ([3, 0, 1, 1], WorkflowCondition::Active),
            ([3, 0, 0, 1], WorkflowCondition::Waiting),
            ([3, 0, 0, 0], WorkflowCondition::Finished),
        ];
        for ([total, attention, active, queued], condition) in cases {
            let tally = ConditionTally {
                total: TaskCount(total),
                attention: TaskCount(attention),
                active: TaskCount(active),
                queued: TaskCount(queued),
            };
            assert_eq!(WorkflowCondition::from(tally), condition);
        }
    }
    #[test]
    fn state_counts_complete_every_state_and_split_finished_from_cancelled() {
        let counts = StateCounts(
            [
                FlowState::Completed,
                FlowState::Integrated,
                FlowState::Cancelled,
                FlowState::Working,
            ]
            .into_iter()
            .map(|state| FlowCount {
                state,
                count: TaskCount(1),
            })
            .collect(),
        );
        assert_eq!(counts.total(), TaskCount(4));
        let completion = counts.completion();
        assert_eq!(completion.finished, TaskCount(2));
        assert_eq!(completion.cancelled, TaskCount(1));
        assert!(TaskCount::try_from(-1).is_err());
    }
    #[test]
    fn active_phases_split_into_working_and_blocked() -> anyhow::Result<()> {
        let working = Assignment {
            agent: AgentId::Gizmo(GizmoAgent::Gizmo),
            attempt: Attempt::UNCLAIMED,
            expires_at: Timestamp::try_from(10)?,
            phase: Phase::Working,
        };
        let blocked = Assignment {
            phase: Phase::Blocked {
                reason: Note::from(String::from("waiting")),
            },
            ..working.clone()
        };
        assert_eq!(
            FlowState::from(&TaskState::Active {
                assignment: working
            }),
            FlowState::Working
        );
        assert_eq!(
            FlowState::from(&TaskState::Active {
                assignment: blocked
            }),
            FlowState::Blocked
        );
        Ok(())
    }
}
