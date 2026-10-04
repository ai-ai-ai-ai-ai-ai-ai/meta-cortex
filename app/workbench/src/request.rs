use super::agents::AgentId;
use super::model::workflow::TaskAssignment;
use super::model::{Phase, Progress, Workspace};
use super::values::{
    Attempt, BranchName, CommitId, FeatureId, LeaseSeconds, Note, TaskId, TaskRevision,
};
use crate::values::WorkerId;
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

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
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
pub struct AssignTask {
    pub feature: FeatureId,
    pub task: TaskId,
    pub expected_revision: TaskRevision,
    pub actor: AgentId,
    pub assignment: TaskAssignment,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ClaimTask {
    pub worker_id: WorkerId,
    pub feature: FeatureId,
    pub task: TaskId,
    pub expected_revision: TaskRevision,
    pub agent: AgentId,
    pub ttl_seconds: LeaseSeconds,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct WorkerUpdate {
    pub worker_id: WorkerId,
    pub feature: FeatureId,
    pub task: TaskId,
    pub expected_revision: TaskRevision,
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
    pub expected_revision: TaskRevision,
    pub actor: AgentId,
    pub action: CoordinatorAction,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum CoordinatorAction {
    Complete,
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

#[cfg(test)]
mod tests {
    use super::ClaimTask;
    use crate::agents::{AgentId, DevelopmentAgent};
    use crate::values::WorkerId;
    use crate::values::{FeatureId, LeaseSeconds, TaskId, TaskRevision};

    #[test]
    fn claim_contract_records_the_worker_instance() -> anyhow::Result<()> {
        let claim = ClaimTask {
            worker_id: WorkerId::EXAMPLE,
            feature: FeatureId::try_from("feature".to_owned())?,
            task: TaskId::try_from("task".to_owned())?,
            expected_revision: TaskRevision::INITIAL,
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
        };
        let encoded = serde_json::to_value(claim)?;
        assert!(encoded.get("worker_id").is_some());
        let decoded: ClaimTask = serde_json::from_value(encoded.clone())?;
        assert_eq!(decoded.worker_id, WorkerId::EXAMPLE);
        let serde_json::Value::Object(mut fields) = encoded else {
            anyhow::bail!("claim must serialize as an object");
        };
        assert!(fields.remove("worker_id").is_some());
        assert!(serde_json::from_value::<ClaimTask>(serde_json::Value::Object(fields)).is_err());
        Ok(())
    }
}
