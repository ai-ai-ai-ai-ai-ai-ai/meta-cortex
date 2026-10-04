use crate::values::WorkerId;
mod task_record;
pub mod worker;
pub mod workflow;

use super::LedgerError;
use super::agents::AgentId;
use super::values::{
    Attempt, BranchName, CommitId, Extensions, FeatureId, LeaseSeconds, Note, TaskId, TaskRevision,
    Timestamp,
};
use super::versions::{RecordVersion, TaskRecordVersion};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use workflow::{TaskAssignment, TaskOwnership};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Feature {
    pub version: RecordVersion,
    pub id: FeatureId,
    pub objective: Note,
    pub branch: BranchName,
    pub worktree: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Workspace {
    ReadOnly,
    /// Operate on the feature's existing worktree, without a worker checkpoint.
    Feature,
    Git {
        branch: BranchName,
        path: PathBuf,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Checkpoint {
    Unrecorded,
    Git { commit: CommitId },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Progress {
    pub summary: Note,
    pub findings: Vec<Note>,
    pub next_steps: Vec<Note>,
    pub checks: Vec<Check>,
    /// Task-specific data only. Coordination never interprets these keys.
    #[serde(default)]
    pub extensions: Extensions,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Check {
    pub command: Note,
    pub outcome: CheckOutcome,
    pub evidence: Note,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CheckOutcome {
    Passed,
    Failed,
    NotRun,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Phase {
    Working,
    Blocked { reason: Note },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Assignment {
    pub agent: AgentId,
    pub attempt: Attempt,
    pub expires_at: Timestamp,
    pub phase: Phase,
}

impl Assignment {
    /// Expiry is an observation at `now`, not proof that the worker stopped.
    pub fn lease(&self, now: Timestamp) -> LeaseHealth {
        match self.expires_at <= now {
            true => LeaseHealth::Expired,
            false => LeaseHealth::Current,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum TaskState {
    Queued,
    Active { assignment: Assignment },
    Ready { agent: AgentId, attempt: Attempt },
    Integrated { commit: CommitId },
    Completed { agent: AgentId, attempt: Attempt },
    Cancelled { reason: Note },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
/// Shared task fields in V2 and later records.
/// Keep this shape stable for retained readers; changed field meanings need a new type.
pub struct TaskCommon {
    pub id: TaskId,
    pub feature: FeatureId,
    pub objective: Note,
    pub acceptance: Vec<Note>,
    pub dependencies: Vec<TaskId>,
    pub revision: TaskRevision,
    pub attempt: Attempt,
    pub created_at: Timestamp,
    pub last_update: Timestamp,
    pub last_progress: Timestamp,
    pub checkpoint: Checkpoint,
    pub progress: Progress,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "task_record::TaskRecord")]
#[schemars(with = "task_record::TaskV3")]
pub struct Task {
    pub worker: worker::WorkerIdentity,
    pub version: TaskRecordVersion,
    pub common: TaskCommon,
    pub ownership: TaskOwnership,
    pub workspace: Workspace,
    pub state: TaskState,
}

pub struct ClaimAt {
    pub worker_id: WorkerId,
    pub agent: AgentId,
    pub ttl: LeaseSeconds,
    pub now: Timestamp,
}

pub struct WorkerAt<'a> {
    pub worker_id: WorkerId,
    pub agent: &'a AgentId,
    pub attempt: Attempt,
    pub now: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    Created,
    Claimed,
    Assigned,
    Heartbeat,
    Progress,
    Checkpoint,
    Ready,
    Integrated,
    Completed,
    Requeued,
    Cancelled,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Event {
    pub version: RecordVersion,
    pub kind: EventKind,
    pub actor: AgentId,
    pub note: Note,
    pub task: Task,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum LeaseHealth {
    Current,
    Expired,
    NotRunning,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TaskView {
    pub task: Task,
    pub lease: LeaseHealth,
}

impl Task {
    #[must_use = "Save the task returned by this transition"]
    pub fn assign(mut self, assignment: TaskAssignment) -> Result<Self, LedgerError> {
        assignment.validate()?;
        match self.state {
            TaskState::Queued => {}
            TaskState::Active { .. }
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => return Err(LedgerError::InvalidTransition),
        }
        self.ownership = TaskOwnership::Assigned { assignment };
        Ok(self)
    }

    pub fn require_revision(&self, expected: TaskRevision) -> Result<(), LedgerError> {
        match self.common.revision == expected {
            true => Ok(()),
            false => Err(LedgerError::Conflict),
        }
    }

    #[must_use = "Save the task returned by this transition"]
    pub fn claim(mut self, input: ClaimAt) -> Result<Self, LedgerError> {
        self.ownership.require_agent(input.agent)?;
        match self.state {
            TaskState::Queued => {}
            TaskState::Active { .. }
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => return Err(LedgerError::InvalidTransition),
        }
        self.common.attempt = self.common.attempt.advance()?;
        self.worker = worker::WorkerIdentity::Recorded {
            worker_id: input.worker_id,
        };
        self.state = TaskState::Active {
            assignment: Assignment {
                agent: input.agent,
                attempt: self.common.attempt,
                expires_at: input.now.expires(input.ttl)?,
                phase: Phase::Working,
            },
        };
        Ok(self)
    }

    pub fn worker(&self, input: WorkerAt<'_>) -> Result<&Assignment, LedgerError> {
        match &self.state {
            TaskState::Active { assignment } => {
                match assignment.agent == *input.agent && assignment.attempt == input.attempt {
                    true => {}
                    false => return Err(LedgerError::AssignmentChanged),
                }
                self.worker.require(input.worker_id)?;
                match assignment.expires_at <= input.now {
                    true => Err(LedgerError::Expired),
                    false => Ok(assignment),
                }
            }
            TaskState::Queued
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => Err(LedgerError::InvalidTransition),
        }
    }

    #[must_use = "Save the task returned by this transition"]
    pub fn ready(mut self, input: WorkerAt<'_>) -> Result<Self, LedgerError> {
        self.worker(WorkerAt {
            worker_id: input.worker_id,
            agent: input.agent,
            attempt: input.attempt,
            now: input.now,
        })?;
        match &self.workspace {
            Workspace::Git { .. } => match self.common.checkpoint {
                Checkpoint::Unrecorded => {
                    return Err(LedgerError::Invalid(
                        "write tasks need a Git checkpoint before readiness",
                    ));
                }
                Checkpoint::Git { .. } => {}
            },
            Workspace::ReadOnly | Workspace::Feature => {}
        }
        self.worker = worker::WorkerIdentity::Recorded {
            worker_id: input.worker_id,
        };
        self.state = TaskState::Ready {
            agent: *input.agent,
            attempt: input.attempt,
        };
        Ok(self)
    }

    #[must_use = "Save the task returned by this transition"]
    pub fn complete(mut self) -> Result<Self, LedgerError> {
        match self.workspace {
            Workspace::ReadOnly | Workspace::Feature => {}
            Workspace::Git { .. } => {
                return Err(LedgerError::Invalid(
                    "write tasks must be integrated rather than completed",
                ));
            }
        }
        match self.state {
            TaskState::Ready { agent, attempt } => {
                self.state = TaskState::Completed { agent, attempt }
            }
            TaskState::Queued
            | TaskState::Active { .. }
            | TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => return Err(LedgerError::InvalidTransition),
        }
        Ok(self)
    }

    #[must_use = "Save the task returned by this transition"]
    pub fn integrate(mut self, commit: CommitId) -> Result<Self, LedgerError> {
        match self.workspace {
            Workspace::Feature => {
                return Err(LedgerError::Invalid(
                    "feature activities complete without a worker merge",
                ));
            }
            Workspace::ReadOnly | Workspace::Git { .. } => {}
        }
        match self.state {
            TaskState::Ready { .. } => self.state = TaskState::Integrated { commit },
            TaskState::Queued
            | TaskState::Active { .. }
            | TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => return Err(LedgerError::InvalidTransition),
        }
        Ok(self)
    }

    #[must_use = "Save the task returned by this transition"]
    pub fn requeue(mut self) -> Result<Self, LedgerError> {
        match self.state {
            TaskState::Active { .. } | TaskState::Ready { .. } => self.state = TaskState::Queued,
            TaskState::Queued
            | TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => return Err(LedgerError::InvalidTransition),
        }
        self.worker = worker::WorkerIdentity::Unrecorded;
        Ok(self)
    }

    #[must_use = "Save the task returned by this transition"]
    pub fn cancel(mut self, reason: Note) -> Result<Self, LedgerError> {
        match self.state {
            TaskState::Queued | TaskState::Active { .. } | TaskState::Ready { .. } => {
                self.state = TaskState::Cancelled { reason }
            }
            TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => return Err(LedgerError::InvalidTransition),
        }
        Ok(self)
    }

    pub fn require_dependency(&self) -> Result<(), LedgerError> {
        match self.state {
            TaskState::Integrated { .. } | TaskState::Completed { .. } => Ok(()),
            TaskState::Queued
            | TaskState::Active { .. }
            | TaskState::Ready { .. }
            | TaskState::Cancelled { .. } => Err(LedgerError::DependencyPending),
        }
    }

    pub fn view(self, now: Timestamp) -> TaskView {
        let lease = match &self.state {
            TaskState::Active { assignment } => assignment.lease(now),
            TaskState::Queued
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. }
            | TaskState::Completed { .. }
            | TaskState::Cancelled { .. } => LeaseHealth::NotRunning,
        };
        TaskView { task: self, lease }
    }
}

#[cfg(test)]
pub mod tests {
    use super::workflow::{TaskAssignment, TaskOwnership};
    use super::{
        Checkpoint, ClaimAt, LeaseHealth, Progress, Task, TaskCommon, TaskState, WorkerAt,
        Workspace,
    };
    use crate::LedgerError;
    use crate::agents::{AgentId, DevelopmentAgent, GizmoAgent};
    use crate::model::worker::WorkerIdentity;
    use crate::values::WorkerId;
    use crate::values::{
        Attempt, BranchName, CommitId, Extensions, FeatureId, LeaseSeconds, Note, TaskId,
        TaskRevision, Timestamp,
    };
    use crate::versions::TaskRecordVersion;
    use std::collections::BTreeMap;
    use std::path::PathBuf;

    struct Scenario;

    impl Scenario {
        fn task() -> anyhow::Result<Task> {
            let id = TaskId::try_from("task".to_owned())?;
            let feature = FeatureId::try_from("feature".to_owned())?;
            let now = Scenario::claim()?.now;
            let mut extensions = BTreeMap::new();
            extensions.insert("custom".to_owned(), serde_json::json!([1, "note"]));
            Ok(Task {
                worker: WorkerIdentity::Unrecorded,
                version: TaskRecordVersion::CURRENT,
                common: TaskCommon {
                    id,
                    feature,
                    objective: Note::from("Review".to_owned()),
                    acceptance: vec![Note::from("Report findings".to_owned())],
                    dependencies: Vec::new(),
                    revision: TaskRevision::INITIAL,
                    attempt: Attempt::UNCLAIMED,
                    created_at: now,
                    last_update: now,
                    last_progress: now,
                    checkpoint: Checkpoint::Unrecorded,
                    progress: Progress {
                        summary: Note::from("Starting".to_owned()),
                        findings: Vec::new(),
                        next_steps: Vec::new(),
                        checks: Vec::new(),
                        extensions: Extensions::from(extensions),
                    },
                },
                ownership: TaskOwnership::Unrecorded,
                workspace: Workspace::ReadOnly,
                state: TaskState::Queued,
            })
        }

        fn claim() -> anyhow::Result<ClaimAt> {
            Ok(ClaimAt {
                worker_id: WorkerId::EXAMPLE,
                agent: AgentId::Development(DevelopmentAgent::RustDev),
                ttl: LeaseSeconds::try_from(10)?,
                now: Timestamp::try_from(1000)?,
            })
        }
    }

    #[test]
    fn worker_instances_are_stable_across_tasks_and_distinct_across_reclaims() -> anyhow::Result<()>
    {
        let original_id = WorkerId::generate();
        let replacement_id = WorkerId::generate();
        let claimed = Scenario::task()?.claim(ClaimAt {
            worker_id: original_id,
            ..Scenario::claim()?
        })?;
        let recorded = WorkerIdentity::Recorded {
            worker_id: original_id,
        };
        assert_eq!(claimed.worker, recorded);
        let mut other_task = Scenario::task()?;
        other_task.common.id = TaskId::try_from("second-task".to_owned())?;
        let other = other_task.claim(ClaimAt {
            worker_id: original_id,
            ..Scenario::claim()?
        })?;
        assert_eq!(other.worker, recorded);
        let agent = Scenario::claim()?.agent;
        assert!(matches!(
            claimed.worker(WorkerAt {
                worker_id: replacement_id,
                agent: &agent,
                attempt: claimed.common.attempt,
                now: Scenario::claim()?.now,
            }),
            Err(LedgerError::AssignmentChanged)
        ));
        let requeued = claimed.clone().requeue()?;
        assert_eq!(requeued.worker, WorkerIdentity::Unrecorded);
        let replacement = requeued.claim(ClaimAt {
            worker_id: replacement_id,
            ..Scenario::claim()?
        })?;
        assert_eq!(
            replacement.worker,
            WorkerIdentity::Recorded {
                worker_id: replacement_id
            }
        );
        assert_eq!(claimed.worker, recorded);
        assert!(matches!(
            replacement.worker(WorkerAt {
                worker_id: original_id,
                agent: &agent,
                attempt: replacement.common.attempt,
                now: Scenario::claim()?.now,
            }),
            Err(LedgerError::AssignmentChanged)
        ));
        let ready = claimed.clone().ready(WorkerAt {
            worker_id: original_id,
            agent: &agent,
            attempt: claimed.common.attempt,
            now: Scenario::claim()?.now,
        })?;
        assert_eq!(ready.worker, recorded);
        assert_eq!(ready.clone().complete()?.worker, recorded);
        assert_eq!(
            ready.integrate(CommitId::try_from("a".repeat(40))?)?.worker,
            recorded
        );
        assert_eq!(claimed.cancel(Note::Empty)?.worker, recorded);
        Ok(())
    }

    #[test]
    fn typed_round_trip_and_lifecycle() -> anyhow::Result<()> {
        let mut task = Scenario::task()?;
        let encoded = serde_json::to_string(&task)?;
        assert_eq!(task, serde_json::from_str::<Task>(&encoded)?);
        assert!(matches!(
            task.require_dependency(),
            Err(LedgerError::DependencyPending)
        ));
        assert!(matches!(
            task.require_revision(task.common.revision.advance()?),
            Err(LedgerError::Conflict)
        ));
        task.require_revision(TaskRevision::INITIAL)?;
        task = task.claim(Scenario::claim()?)?;
        assert!(matches!(
            task.clone().claim(Scenario::claim()?),
            Err(LedgerError::InvalidTransition)
        ));
        let agent = AgentId::Development(DevelopmentAgent::RustDev);
        task = task.ready(WorkerAt {
            worker_id: WorkerId::EXAMPLE,
            agent: &agent,
            attempt: Attempt::UNCLAIMED.advance()?,
            now: Timestamp::try_from(2000)?,
        })?;
        assert!(matches!(task.state, TaskState::Ready { .. }));
        task = task.integrate(CommitId::try_from("a".repeat(40))?)?;
        task.require_dependency()?;
        assert!(matches!(
            task.clone().requeue(),
            Err(LedgerError::InvalidTransition)
        ));
        assert!(matches!(
            task.clone().cancel(Note::from("cancel".to_owned())),
            Err(LedgerError::InvalidTransition)
        ));
        assert_eq!(
            task.view(Timestamp::try_from(50000)?).lease,
            LeaseHealth::NotRunning
        );
        Ok(())
    }

    #[test]
    fn expiry_and_reassignment_reject_stale_attempts() -> anyhow::Result<()> {
        let mut task = Scenario::task()?;
        task = task.claim(Scenario::claim()?)?;
        let agent = AgentId::Development(DevelopmentAgent::RustDev);
        assert_eq!(
            task.clone().view(Timestamp::try_from(10000)?).lease,
            LeaseHealth::Current
        );
        assert_eq!(
            task.clone().view(Timestamp::try_from(11000)?).lease,
            LeaseHealth::Expired
        );
        assert!(matches!(
            task.worker(WorkerAt {
                worker_id: WorkerId::EXAMPLE,
                agent: &agent,
                attempt: Attempt::UNCLAIMED.advance()?,
                now: Timestamp::try_from(11000)?
            }),
            Err(LedgerError::Expired)
        ));
        task = task.requeue()?;
        task = task.claim(Scenario::claim()?)?;
        assert!(matches!(
            task.worker(WorkerAt {
                worker_id: WorkerId::EXAMPLE,
                agent: &agent,
                attempt: Attempt::UNCLAIMED.advance()?,
                now: Timestamp::try_from(2000)?
            }),
            Err(LedgerError::AssignmentChanged)
        ));
        let stranger = AgentId::Development(DevelopmentAgent::TypescriptDev);
        assert!(matches!(
            task.worker(WorkerAt {
                worker_id: WorkerId::EXAMPLE,
                agent: &stranger,
                attempt: Attempt::UNCLAIMED.advance()?.advance()?,
                now: Timestamp::try_from(2000)?
            }),
            Err(LedgerError::AssignmentChanged)
        ));
        task = task.cancel(Note::from("No longer needed".to_owned()))?;
        assert!(matches!(task.state, TaskState::Cancelled { .. }));
        Ok(())
    }

    #[test]
    fn activities_complete_without_losing_ownership_or_requiring_a_merge() -> anyhow::Result<()> {
        let agent = AgentId::Gizmo(GizmoAgent::GizmoPrime);
        for workspace in [Workspace::ReadOnly, Workspace::Feature] {
            let task = Task {
                ownership: TaskOwnership::Assigned {
                    assignment: TaskAssignment::from(agent),
                },
                workspace,
                ..Scenario::task()?
            };
            assert!(matches!(
                task.clone().complete(),
                Err(LedgerError::InvalidTransition)
            ));
            assert!(matches!(
                task.clone().claim(Scenario::claim()?),
                Err(LedgerError::AssignmentChanged)
            ));
            let task = task.claim(ClaimAt {
                worker_id: WorkerId::EXAMPLE,
                agent,
                ..Scenario::claim()?
            })?;
            let attempt = task.common.attempt;
            let task = task.ready(WorkerAt {
                worker_id: WorkerId::EXAMPLE,
                agent: &agent,
                attempt,
                now: Timestamp::try_from(2000)?,
            })?;
            let ownership = task.ownership.clone();
            let task = task.complete()?;
            assert_eq!(task.ownership, ownership);
            assert!(
                matches!(task.state, TaskState::Completed { agent: owner, .. } if owner == agent)
            );
            task.require_dependency()?;
            assert!(matches!(
                task.clone().complete(),
                Err(LedgerError::InvalidTransition)
            ));
            assert!(matches!(
                task.clone().requeue(),
                Err(LedgerError::InvalidTransition)
            ));
            assert!(matches!(
                task.clone().cancel(Note::Empty),
                Err(LedgerError::InvalidTransition)
            ));
            assert_eq!(
                task.view(Timestamp::try_from(50000)?).lease,
                LeaseHealth::NotRunning
            );
        }
        let write = Task {
            workspace: Workspace::Git {
                branch: BranchName::try_from("codex/worker".to_owned())?,
                path: PathBuf::from("/worker"),
            },
            ..Scenario::task()?
        };
        assert!(matches!(write.complete(), Err(LedgerError::Invalid(_))));
        Ok(())
    }

    #[test]
    fn rejects_invalid_known_fields_and_versions() -> anyhow::Result<()> {
        let document = serde_json::to_string(&Scenario::task()?)?;
        for invalid in [
            document.replace("\"version\":3", "\"version\":99"),
            document.replace("\"id\":\"task\"", "\"id\":\"../task\""),
            document.replace("\"kind\":\"queued\"", "\"kind\":\"invented\""),
            document.replace("\"revision\":1", "\"revision\":0"),
        ] {
            assert!(serde_json::from_str::<Task>(&invalid).is_err());
        }
        Ok(())
    }
}
