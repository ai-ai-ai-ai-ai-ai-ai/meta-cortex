use super::agents::AgentId;
use super::model::{Phase, Progress, Workspace};
use super::values::{
    Attempt, BranchName, CommitId, FeatureId, LeaseSeconds, Note, Revision, TaskId,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct InitFeature {
    pub feature: FeatureId,
    pub objective: Note,
    pub branch: BranchName,
    pub worktree: PathBuf,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FeatureQuery {
    pub feature: FeatureId,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TaskQuery {
    pub feature: FeatureId,
    pub task: TaskId,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateTask {
    pub feature: FeatureId,
    pub task: TaskId,
    pub actor: AgentId,
    pub objective: Note,
    pub acceptance: Vec<Note>,
    pub dependencies: Vec<TaskId>,
    pub workspace: Workspace,
    pub progress: Progress,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ClaimTask {
    pub feature: FeatureId,
    pub task: TaskId,
    pub expected_revision: Revision,
    pub agent: AgentId,
    pub ttl_seconds: LeaseSeconds,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct WorkerUpdate {
    pub feature: FeatureId,
    pub task: TaskId,
    pub expected_revision: Revision,
    pub agent: AgentId,
    pub attempt: Attempt,
    pub action: WorkerAction,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum WorkerAction {
    Heartbeat {
        ttl_seconds: LeaseSeconds,
    },
    Progress {
        ttl_seconds: LeaseSeconds,
        phase: Phase,
        progress: Progress,
    },
    Checkpoint {
        ttl_seconds: LeaseSeconds,
        commit: CommitId,
        progress: Progress,
    },
    Ready {
        progress: Progress,
    },
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CoordinatorUpdate {
    pub feature: FeatureId,
    pub task: TaskId,
    pub expected_revision: Revision,
    pub actor: AgentId,
    pub action: CoordinatorAction,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum CoordinatorAction {
    Integrate {
        commit: CommitId,
    },
    Requeue {
        reason: Note,
        previous_execution: StoppedExecution,
    },
    Cancel {
        reason: Note,
    },
}

/// Coordinator acknowledgement after inspecting/stopping the previous host execution.
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum StoppedExecution {
    StoppedOrFinished,
}
