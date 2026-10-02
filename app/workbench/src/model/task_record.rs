//! Typed task readers: V1 never recorded workflow ownership; V2 requires it.
use super::workflow::TaskOwnership;
use super::{Assignment, Checkpoint, Progress, Task, TaskCommon, TaskState, Workspace};
use crate::LedgerError;
use crate::agents::AgentId;
use crate::values::{Attempt, BranchName, CommitId, FeatureId, Note, Revision, TaskId, Timestamp};
use crate::versions::{RecordVersion, TaskRecordVersion};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Deserialize)]
#[serde(untagged)]
pub(super) enum TaskRecord {
    V2(TaskV2),
    V1(TaskV1),
}

#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub(super) struct TaskV2 {
    pub version: TaskRecordVersion,
    pub common: TaskCommon,
    pub ownership: TaskOwnership,
    pub workspace: Workspace,
    pub state: TaskState,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct TaskV1 {
    pub version: RecordVersion,
    pub id: TaskId,
    pub feature: FeatureId,
    pub objective: Note,
    pub acceptance: Vec<Note>,
    pub dependencies: Vec<TaskId>,
    pub workspace: WorkspaceV1,
    pub revision: Revision,
    pub attempt: Attempt,
    pub state: TaskStateV1,
    pub created_at: Timestamp,
    pub last_update: Timestamp,
    pub last_progress: Timestamp,
    pub checkpoint: Checkpoint,
    pub progress: Progress,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum WorkspaceV1 {
    ReadOnly,
    Git { branch: BranchName, path: PathBuf },
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum TaskStateV1 {
    Queued,
    Active { assignment: Assignment },
    Ready { agent: AgentId, attempt: Attempt },
    Integrated { commit: CommitId },
    Cancelled { reason: Note },
}

impl From<WorkspaceV1> for Workspace {
    fn from(workspace: WorkspaceV1) -> Self {
        match workspace {
            WorkspaceV1::ReadOnly => Self::ReadOnly,
            WorkspaceV1::Git { branch, path } => Self::Git { branch, path },
        }
    }
}
impl From<TaskStateV1> for TaskState {
    fn from(state: TaskStateV1) -> Self {
        match state {
            TaskStateV1::Queued => Self::Queued,
            TaskStateV1::Active { assignment } => Self::Active { assignment },
            TaskStateV1::Ready { agent, attempt } => Self::Ready { agent, attempt },
            TaskStateV1::Integrated { commit } => Self::Integrated { commit },
            TaskStateV1::Cancelled { reason } => Self::Cancelled { reason },
        }
    }
}

impl TryFrom<TaskRecord> for Task {
    type Error = LedgerError;

    fn try_from(record: TaskRecord) -> Result<Self, Self::Error> {
        let record = match record {
            TaskRecord::V2(record) => record,
            TaskRecord::V1(record) => record.into(),
        };
        let task = Self::from(record);
        if let TaskOwnership::Assigned { assignment } = &task.ownership {
            assignment.validate()?;
        }
        match &task.state {
            TaskState::Active { assignment } => task.ownership.require_agent(assignment.agent)?,
            TaskState::Ready { agent, .. } | TaskState::Completed { agent, .. } => {
                task.ownership.require_agent(*agent)?;
            }
            TaskState::Queued | TaskState::Integrated { .. } | TaskState::Cancelled { .. } => {}
        }
        Ok(task)
    }
}

impl From<TaskV1> for TaskV2 {
    fn from(record: TaskV1) -> Self {
        Self {
            version: TaskRecordVersion::V2,
            common: TaskCommon {
                id: record.id,
                feature: record.feature,
                objective: record.objective,
                acceptance: record.acceptance,
                dependencies: record.dependencies,
                revision: record.revision,
                attempt: record.attempt,
                created_at: record.created_at,
                last_update: record.last_update,
                last_progress: record.last_progress,
                checkpoint: record.checkpoint,
                progress: record.progress,
            },
            ownership: TaskOwnership::Unrecorded,
            workspace: record.workspace.into(),
            state: record.state.into(),
        }
    }
}

impl From<TaskV2> for Task {
    fn from(record: TaskV2) -> Self {
        Self {
            version: record.version,
            common: record.common,
            ownership: record.ownership,
            workspace: record.workspace,
            state: record.state,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{TaskRecord, TaskStateV1, TaskV1, TaskV2, WorkspaceV1};
    use crate::agents::{AgentId, DevelopmentAgent, GizmoAgent};
    use crate::model::workflow::{TaskAssignment, TaskOwnership};
    use crate::model::{Assignment, Checkpoint, Phase, Progress, Task, TaskState};
    use crate::values::{
        Attempt, BranchName, CommitId, Extensions, FeatureId, Note, Revision, TaskId, Timestamp,
    };
    use crate::versions::{RecordVersion, TaskRecordVersion};
    use std::path::PathBuf;

    struct Scenario;
    impl Scenario {
        fn legacy() -> anyhow::Result<TaskV1> {
            let now = Timestamp::try_from(1000)?;
            Ok(TaskV1 {
                version: RecordVersion::V1,
                id: TaskId::try_from("task".to_owned())?,
                feature: FeatureId::try_from("feature".to_owned())?,
                objective: Note::from(" Preserve history ".to_owned()),
                acceptance: vec![Note::Empty],
                dependencies: vec![],
                workspace: WorkspaceV1::ReadOnly,
                revision: Revision::INITIAL,
                attempt: Attempt::UNCLAIMED.advance()?,
                state: TaskStateV1::Ready {
                    agent: AgentId::Development(DevelopmentAgent::RustDev),
                    attempt: Attempt::UNCLAIMED.advance()?,
                },
                created_at: now,
                last_update: now,
                last_progress: now,
                checkpoint: Checkpoint::Unrecorded,
                progress: Progress {
                    summary: Note::from("Reviewed".to_owned()),
                    findings: vec![],
                    next_steps: vec![],
                    checks: vec![],
                    extensions: Extensions::default(),
                },
            })
        }
    }

    #[test]
    fn native_readers_keep_v1_flat_and_require_strict_v2_common() -> anyhow::Result<()> {
        let legacy = serde_json::to_string(&Scenario::legacy()?)?;
        assert!(matches!(
            serde_json::from_str::<TaskRecord>(&legacy)?,
            TaskRecord::V1(_)
        ));
        let task: Task = serde_json::from_str(&legacy)?;
        let current = serde_json::to_string(&task)?;
        assert!(matches!(
            serde_json::from_str::<TaskRecord>(&current)?,
            TaskRecord::V2(_)
        ));
        let decoded: TaskV2 = serde_json::from_str(&current)?;
        assert_eq!(decoded.common, task.common);
        assert_eq!(decoded.version, TaskRecordVersion::V2);
        assert!(serde_json::from_str::<TaskV1>(&current).is_err());
        for invalid in [
            legacy.replace("\"version\":1", "\"version\":2"),
            legacy.replacen('{', "{\"unexpected\":0,", 1),
            current.replace("\"version\":2", "\"version\":1"),
            current.replacen('{', "{\"unexpected\":0,", 1),
            current.replace("\"common\":{", "\"common\":{\"unexpected\":0,"),
            current.replace("\"common\":", "\"missing_common\":"),
            current.replace("\"id\":\"task\"", "\"id\":\"../task\""),
        ] {
            assert!(serde_json::from_str::<Task>(&invalid).is_err());
        }
        Ok(())
    }

    #[test]
    fn v1_reader_preserves_evidence_without_inventing_a_reporting_line() -> anyhow::Result<()> {
        let encoded = serde_json::to_string(&Scenario::legacy()?)?;
        let task: Task = serde_json::from_str(&encoded)?;
        assert_eq!(task.version, TaskRecordVersion::V2);
        assert_eq!(task.ownership, TaskOwnership::Unrecorded);
        assert_eq!(task.common.objective.to_string(), " Preserve history ");
        assert!(matches!(
            task.state,
            TaskState::Ready {
                agent: AgentId::Development(DevelopmentAgent::RustDev),
                ..
            }
        ));
        assert_eq!(task.common.progress.summary.to_string(), "Reviewed");
        assert_eq!(
            serde_json::from_str::<Task>(&serde_json::to_string(&task)?)?,
            task
        );
        for invalid in [
            encoded.replace("\"version\":1", "\"version\":99"),
            encoded.replace("\"kind\":\"read_only\"", "\"kind\":\"feature\""),
            encoded.replace("\"kind\":\"ready\"", "\"kind\":\"completed\""),
        ] {
            assert!(serde_json::from_str::<Task>(&invalid).is_err());
        }
        Ok(())
    }

    #[test]
    fn v2_requires_ownership_and_rejects_invalid_hierarchy() -> anyhow::Result<()> {
        let mut task = Task::try_from(TaskRecord::V1(Scenario::legacy()?))?;
        let encoded = serde_json::to_string(&task)?;
        assert!(
            serde_json::from_str::<Task>(
                &encoded.replace("\"ownership\":{\"kind\":\"Unrecorded\"},", "")
            )
            .is_err()
        );
        assert!(
            serde_json::from_str::<Task>(&encoded.replace("\"version\":2", "\"version\":1"))
                .is_err()
        );
        task.ownership = TaskOwnership::Assigned {
            assignment: TaskAssignment::from(AgentId::Development(DevelopmentAgent::RustDev)),
        };
        let encoded = serde_json::to_string(&task)?;
        assert_eq!(serde_json::from_str::<Task>(&encoded)?, task);
        let invalid = Task {
            state: TaskState::Ready {
                agent: AgentId::Gizmo(GizmoAgent::GizmoPrime),
                attempt: task.common.attempt,
            },
            ..task
        };
        assert!(serde_json::from_str::<Task>(&serde_json::to_string(&invalid)?).is_err());
        assert!(
            serde_json::from_str::<Task>(&encoded.replace(
                "\"coordinator\":\"Gizmo\"",
                "\"coordinator\":\"GizmoPrime\""
            ))
            .is_err()
        );
        Ok(())
    }

    #[test]
    fn v1_git_history_preserves_states_leases_and_checkpoints() -> anyhow::Result<()> {
        let agent = AgentId::Development(DevelopmentAgent::RustDev);
        let attempt = Attempt::UNCLAIMED.advance()?;
        let commit = CommitId::try_from("a".repeat(40))?;
        for state in [
            TaskStateV1::Queued,
            TaskStateV1::Active {
                assignment: Assignment {
                    agent,
                    attempt,
                    expires_at: Timestamp::try_from(2000)?,
                    phase: Phase::Blocked {
                        reason: Note::from("Waiting for review".to_owned()),
                    },
                },
            },
            TaskStateV1::Ready { agent, attempt },
            TaskStateV1::Integrated {
                commit: commit.clone(),
            },
            TaskStateV1::Cancelled {
                reason: Note::from("Scope changed".to_owned()),
            },
        ] {
            let legacy = TaskV1 {
                workspace: WorkspaceV1::Git {
                    branch: BranchName::try_from("codex/worker".to_owned())?,
                    path: PathBuf::from("/worker"),
                },
                state,
                checkpoint: Checkpoint::Git {
                    commit: commit.clone(),
                },
                ..Scenario::legacy()?
            };
            let task: Task = serde_json::from_str(&serde_json::to_string(&legacy)?)?;
            assert_eq!(task.ownership, TaskOwnership::Unrecorded);
            assert_eq!(
                serde_json::to_string(&task.state)?,
                serde_json::to_string(&legacy.state)?
            );
            assert_eq!(
                serde_json::to_string(&task.workspace)?,
                serde_json::to_string(&legacy.workspace)?
            );
            assert_eq!(task.common.checkpoint, legacy.checkpoint);
            assert_eq!(task.common.revision, legacy.revision);
            assert_eq!(task.common.attempt, legacy.attempt);
            assert_eq!(task.common.last_update, legacy.last_update);
            assert_eq!(task.common.progress, legacy.progress);
        }
        Ok(())
    }
}
