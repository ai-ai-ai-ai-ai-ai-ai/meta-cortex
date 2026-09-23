use super::LedgerError;
use super::values::{
    AgentId, Attempt, BranchName, CommitId, Extensions, FeatureId, LeaseSeconds, Note, Revision,
    TaskId, Timestamp,
};
use super::versions::RecordVersion;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
    Git { branch: BranchName, path: PathBuf },
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

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum TaskState {
    Queued,
    Active { assignment: Assignment },
    Ready { agent: AgentId, attempt: Attempt },
    Integrated { commit: CommitId },
    Cancelled { reason: Note },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Task {
    pub version: RecordVersion,
    pub id: TaskId,
    pub feature: FeatureId,
    pub objective: Note,
    pub acceptance: Vec<Note>,
    pub dependencies: Vec<TaskId>,
    pub workspace: Workspace,
    pub revision: Revision,
    pub attempt: Attempt,
    pub state: TaskState,
    pub created_at: Timestamp,
    pub last_update: Timestamp,
    pub last_progress: Timestamp,
    pub checkpoint: Checkpoint,
    pub progress: Progress,
}

pub struct ClaimAt {
    pub agent: AgentId,
    pub ttl: LeaseSeconds,
    pub now: Timestamp,
}

pub struct WorkerAt<'a> {
    pub agent: &'a AgentId,
    pub attempt: Attempt,
    pub now: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    Created,
    Claimed,
    Heartbeat,
    Progress,
    Checkpoint,
    Ready,
    Integrated,
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
    pub fn require_revision(&self, expected: Revision) -> Result<(), LedgerError> {
        if self.revision != expected {
            return Err(LedgerError::Conflict);
        }
        Ok(())
    }

    pub fn claim(&mut self, input: ClaimAt) -> Result<(), LedgerError> {
        match self.state {
            TaskState::Queued => {}
            TaskState::Active { .. }
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. }
            | TaskState::Cancelled { .. } => return Err(LedgerError::InvalidTransition),
        }
        self.attempt = self.attempt.advance()?;
        self.state = TaskState::Active {
            assignment: Assignment {
                agent: input.agent,
                attempt: self.attempt,
                expires_at: input.now.expires(input.ttl)?,
                phase: Phase::Working,
            },
        };
        Ok(())
    }

    pub fn worker(&mut self, input: WorkerAt<'_>) -> Result<&mut Assignment, LedgerError> {
        match &mut self.state {
            TaskState::Active { assignment } => {
                if &assignment.agent != input.agent || assignment.attempt != input.attempt {
                    return Err(LedgerError::AssignmentChanged);
                }
                if assignment.expires_at <= input.now {
                    return Err(LedgerError::Expired);
                }
                Ok(assignment)
            }
            TaskState::Queued
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. }
            | TaskState::Cancelled { .. } => Err(LedgerError::InvalidTransition),
        }
    }

    pub fn ready(&mut self, input: WorkerAt<'_>) -> Result<(), LedgerError> {
        self.worker(WorkerAt {
            agent: input.agent,
            attempt: input.attempt,
            now: input.now,
        })?;
        if matches!(self.workspace, Workspace::Git { .. })
            && matches!(self.checkpoint, Checkpoint::Unrecorded)
        {
            return Err(LedgerError::Invalid(
                "write tasks need a Git checkpoint before readiness",
            ));
        }
        self.state = TaskState::Ready {
            agent: *input.agent,
            attempt: input.attempt,
        };
        Ok(())
    }

    pub fn integrate(&mut self, commit: CommitId) -> Result<(), LedgerError> {
        match self.state {
            TaskState::Ready { .. } => {
                self.state = TaskState::Integrated { commit };
                Ok(())
            }
            TaskState::Queued
            | TaskState::Active { .. }
            | TaskState::Integrated { .. }
            | TaskState::Cancelled { .. } => Err(LedgerError::InvalidTransition),
        }
    }

    pub fn requeue(&mut self) -> Result<(), LedgerError> {
        match self.state {
            TaskState::Active { .. } | TaskState::Ready { .. } => {
                self.state = TaskState::Queued;
                Ok(())
            }
            TaskState::Queued | TaskState::Integrated { .. } | TaskState::Cancelled { .. } => {
                Err(LedgerError::InvalidTransition)
            }
        }
    }

    pub fn cancel(&mut self, reason: Note) -> Result<(), LedgerError> {
        match self.state {
            TaskState::Queued | TaskState::Active { .. } | TaskState::Ready { .. } => {
                self.state = TaskState::Cancelled { reason };
                Ok(())
            }
            TaskState::Integrated { .. } | TaskState::Cancelled { .. } => {
                Err(LedgerError::InvalidTransition)
            }
        }
    }

    pub fn require_dependency(&self) -> Result<(), LedgerError> {
        match self.state {
            TaskState::Integrated { .. } => Ok(()),
            TaskState::Queued
            | TaskState::Active { .. }
            | TaskState::Ready { .. }
            | TaskState::Cancelled { .. } => Err(LedgerError::DependencyPending),
        }
    }

    pub fn view(self, now: Timestamp) -> TaskView {
        let lease = match &self.state {
            TaskState::Active { assignment } if assignment.expires_at <= now => {
                LeaseHealth::Expired
            }
            TaskState::Active { .. } => LeaseHealth::Current,
            TaskState::Queued
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. }
            | TaskState::Cancelled { .. } => LeaseHealth::NotRunning,
        };
        TaskView { task: self, lease }
    }
}

#[cfg(test)]
mod tests {
    use super::{Checkpoint, ClaimAt, LeaseHealth, Progress, Task, TaskState, WorkerAt, Workspace};
    use crate::LedgerError;
    use crate::values::{
        AgentId, Attempt, CommitIdParse, Extensions, FeatureIdParse, LeaseSecondsParse, Note,
        Revision, TaskIdParse, TimestampParse,
    };
    use crate::versions::RecordVersion;
    use std::collections::BTreeMap;

    struct Scenario;

    impl Scenario {
        fn task() -> anyhow::Result<Task> {
            let id = match TaskIdParse::from("task".to_owned()) {
                TaskIdParse::Parsed(id) => id,
                TaskIdParse::Invalid(error) => return Err(error.into()),
            };
            let feature = match FeatureIdParse::from("feature".to_owned()) {
                FeatureIdParse::Parsed(id) => id,
                FeatureIdParse::Invalid(error) => return Err(error.into()),
            };
            let now = Scenario::claim()?.now;
            let mut extensions = BTreeMap::new();
            extensions.insert("custom".to_owned(), serde_json::json!([1, "note"]));
            Ok(Task {
                version: RecordVersion::V1,
                id,
                feature,
                objective: Note::from("Review".to_owned()),
                acceptance: vec![Note::from("Report findings".to_owned())],
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
                    summary: Note::from("Starting".to_owned()),
                    findings: Vec::new(),
                    next_steps: Vec::new(),
                    checks: Vec::new(),
                    extensions: Extensions::from(extensions),
                },
            })
        }

        fn claim() -> anyhow::Result<ClaimAt> {
            Ok(ClaimAt {
                agent: AgentId::RustDev,
                ttl: match LeaseSecondsParse::from(10) {
                    LeaseSecondsParse::Parsed(value) => value,
                    LeaseSecondsParse::Invalid(error) => return Err(error.into()),
                },
                now: match TimestampParse::from(1000) {
                    TimestampParse::Parsed(value) => value,
                    TimestampParse::Invalid(error) => return Err(error.into()),
                },
            })
        }
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
            task.require_revision(task.revision.advance()?),
            Err(LedgerError::Conflict)
        ));
        task.require_revision(Revision::INITIAL)?;
        task.claim(Scenario::claim()?)?;
        assert!(matches!(
            task.claim(Scenario::claim()?),
            Err(LedgerError::InvalidTransition)
        ));
        let agent = AgentId::RustDev;
        task.ready(WorkerAt {
            agent: &agent,
            attempt: Attempt::UNCLAIMED.advance()?,
            now: match TimestampParse::from(2000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            },
        })?;
        assert!(matches!(task.state, TaskState::Ready { .. }));
        task.integrate(match CommitIdParse::from("a".repeat(40)) {
            CommitIdParse::Parsed(value) => value,
            CommitIdParse::Invalid(error) => return Err(error.into()),
        })?;
        task.require_dependency()?;
        assert!(matches!(
            task.requeue(),
            Err(LedgerError::InvalidTransition)
        ));
        assert!(matches!(
            task.cancel(Note::from("cancel".to_owned())),
            Err(LedgerError::InvalidTransition)
        ));
        assert_eq!(
            task.view(match TimestampParse::from(50000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            })
            .lease,
            LeaseHealth::NotRunning
        );
        Ok(())
    }

    #[test]
    fn expiry_and_reassignment_reject_stale_attempts() -> anyhow::Result<()> {
        let mut task = Scenario::task()?;
        task.claim(Scenario::claim()?)?;
        let agent = AgentId::RustDev;
        assert_eq!(
            task.clone()
                .view(match TimestampParse::from(10000) {
                    TimestampParse::Parsed(value) => value,
                    TimestampParse::Invalid(error) => return Err(error.into()),
                })
                .lease,
            LeaseHealth::Current
        );
        assert_eq!(
            task.clone()
                .view(match TimestampParse::from(11000) {
                    TimestampParse::Parsed(value) => value,
                    TimestampParse::Invalid(error) => return Err(error.into()),
                })
                .lease,
            LeaseHealth::Expired
        );
        assert!(matches!(
            task.worker(WorkerAt {
                agent: &agent,
                attempt: Attempt::UNCLAIMED.advance()?,
                now: match TimestampParse::from(11000) {
                    TimestampParse::Parsed(value) => value,
                    TimestampParse::Invalid(error) => return Err(error.into()),
                }
            }),
            Err(LedgerError::Expired)
        ));
        task.requeue()?;
        task.claim(Scenario::claim()?)?;
        assert!(matches!(
            task.worker(WorkerAt {
                agent: &agent,
                attempt: Attempt::UNCLAIMED.advance()?,
                now: match TimestampParse::from(2000) {
                    TimestampParse::Parsed(value) => value,
                    TimestampParse::Invalid(error) => return Err(error.into()),
                }
            }),
            Err(LedgerError::AssignmentChanged)
        ));
        let stranger = AgentId::TypescriptDev;
        assert!(matches!(
            task.worker(WorkerAt {
                agent: &stranger,
                attempt: Attempt::UNCLAIMED.advance()?.advance()?,
                now: match TimestampParse::from(2000) {
                    TimestampParse::Parsed(value) => value,
                    TimestampParse::Invalid(error) => return Err(error.into()),
                }
            }),
            Err(LedgerError::AssignmentChanged)
        ));
        task.cancel(Note::from("No longer needed".to_owned()))?;
        assert!(matches!(task.state, TaskState::Cancelled { .. }));
        Ok(())
    }

    #[test]
    fn rejects_invalid_known_fields_and_versions() -> anyhow::Result<()> {
        let document = serde_json::to_string(&Scenario::task()?)?;
        for invalid in [
            document.replace("\"version\":1", "\"version\":99"),
            document.replace("\"id\":\"task\"", "\"id\":\"../task\""),
            document.replace("\"kind\":\"queued\"", "\"kind\":\"invented\""),
            document.replace("\"revision\":1", "\"revision\":0"),
        ] {
            assert!(serde_json::from_str::<Task>(&invalid).is_err());
        }
        Ok(())
    }
}
