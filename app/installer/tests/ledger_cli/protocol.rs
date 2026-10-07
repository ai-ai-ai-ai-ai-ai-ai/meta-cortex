use derive_more::From;
use meta_cortex_workbench::agents::AgentId;
use meta_cortex_workbench::model::{Assignment, EventKind, LeaseHealth, Progress};
use meta_cortex_workbench::request::{
    AssignTask, ClaimTask, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature, TaskQuery,
    WorkerUpdate,
};
use meta_cortex_workbench::values::{Attempt, Note, TaskId, TaskRevision, Timestamp};
use meta_cortex_workbench::versions::{ProtocolVersion, StorageVersion};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// Independent CLI envelope; Workbench owns the shared domain arguments.
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Request {
    pub(super) version: ProtocolVersion,
    pub(super) project: PathBuf,
    pub(super) operation: Operation,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "group", content = "command", deny_unknown_fields)]
pub(super) enum Operation {
    Framework(FrameworkOperation),
    Feature(FeatureOperation),
    Task(TaskOperation),
    Workbench(WorkbenchOperation),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub(super) enum WorkbenchOperation {
    Dashboard(meta_cortex_visualization::DashboardRequest),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub(super) enum FrameworkOperation {
    Initialize(FrameworkInit),
    Info(EmptyArguments),
    Wrapper(WrapperArguments),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct WrapperArguments {
    pub(super) release: WrapperRelease,
}
// The catalog example selects a known release; independent consumers name that fixture identity.
#[derive(Debug, Serialize, Deserialize)]
pub(super) enum WrapperRelease {
    #[serde(rename = "0.15.0")]
    V0_15_0,
    #[serde(rename = "0.16.0")]
    V0_16_0,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub(super) enum FeatureOperation {
    Initialize(InitFeature),
    List(EmptyArguments),
    Status(FeatureQuery),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub(super) enum TaskOperation {
    Create(CreateTask),
    Assign(AssignTask),
    Get(TaskQuery),
    History(TaskQuery),
    Claim(ClaimTask),
    Update(WorkerUpdate),
    Coordinate(CoordinatorUpdate),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct EmptyArguments {}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct FrameworkInit {
    pub(super) harness: Harness,
    pub(super) instructions: Instructions,
    pub(super) mise: ToolSetup,
    pub(super) bun: ToolSetup,
    pub(super) vale: ToolSetup,
}
#[derive(Debug, Serialize, Deserialize)]
pub(super) enum ToolSetup {
    InstallMissing,
    RequireExisting,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum Harness {
    None,
    Codex,
    Claude,
    Cursor,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum Instructions {
    Skip,
    Write,
}

#[derive(From)]
pub(super) struct RequestYaml(pub(super) String);

// An independent consumer of the CLI's versioned YAML response.
#[derive(Debug, Deserialize)]
pub(super) struct Response {
    pub(super) version: ProtocolVersion,
    pub(super) result: Outcome,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "status", content = "data", rename_all = "snake_case")]
pub(super) enum Outcome {
    Success(Reply),
    Error(Failure),
}
#[derive(Debug, Deserialize)]
pub(super) struct Failure {
    pub(super) code: String,
    pub(super) message: String,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub(super) enum Reply {
    Ledger(LedgerInfo),
    Features(FeatureCatalog),
    FrameworkInitialized {
        project: PathBuf,
    },
    FrameworkInfo {
        paths: InfoPaths,
    },
    Task(Task),
    TaskView(TaskView),
    Status {
        ledger: LedgerInfo,
        tasks: Vec<TaskView>,
    },
    History(Vec<Event>),
}
#[derive(Debug, Deserialize)]
pub(super) struct InfoPaths {
    pub(super) project: PathBuf,
    pub(super) framework: PathBuf,
}
#[derive(Debug, Deserialize)]
pub(super) struct FeatureCatalog {
    pub(super) features: Vec<CatalogFeature>,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub(super) enum CatalogFeature {
    Current { ledger: LedgerInfo },
    UpgradeRequired { ledger: LedgerInfo },
    Unavailable { feature: FeatureId },
}
impl CatalogFeature {
    pub(super) fn ledger(&self) -> anyhow::Result<&LedgerInfo> {
        match self {
            Self::Current { ledger } | Self::UpgradeRequired { ledger } => Ok(ledger),
            Self::Unavailable { feature } => anyhow::bail!("feature {feature} unavailable"),
        }
    }
}
#[derive(Debug, Deserialize)]
pub(super) struct LedgerInfo {
    pub(super) path: PathBuf,
    pub(super) storage_version: StorageVersion,
}
#[derive(Debug, Deserialize)]
pub(super) struct Task {
    pub(super) common: TaskCommon,
    pub(super) state: State,
}
#[derive(Debug, Deserialize)]
pub(super) struct TaskCommon {
    pub(super) id: TaskId,
    pub(super) revision: TaskRevision,
    pub(super) attempt: Attempt,
    pub(super) last_update: Timestamp,
    pub(super) last_progress: Timestamp,
    pub(super) progress: Progress,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub(super) enum State {
    Queued,
    Active { assignment: Assignment },
    Ready,
    Integrated,
    Cancelled,
}
#[derive(Debug, Deserialize)]
pub(super) struct TaskView {
    pub(super) task: Task,
    pub(super) lease: LeaseHealth,
}
#[derive(Debug, Deserialize)]
pub(super) struct Event {
    pub(super) actor: AgentId,
    pub(super) kind: EventKind,
    pub(super) note: Note,
    pub(super) task: Task,
}
use meta_cortex_workbench::values::FeatureId;
