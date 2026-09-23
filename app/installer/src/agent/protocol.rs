use super::AgentError;
use crate::information::InfoReport;
use crate::installation::{InitRequest, Project};
use crate::integration::{Harness, HarnessChoice, InstructionAction, IntegrationOptions};
use meta_cortex_workbench::model::{Event, Task, TaskView};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature, TaskQuery, WorkerUpdate,
};
use meta_cortex_workbench::values::FeatureId;
use meta_cortex_workbench::versions::ProtocolVersion;
use meta_cortex_workbench::{Ledger, LedgerError, LedgerInfo, Workbench};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub version: ProtocolVersion,
    pub project: PathBuf,
    pub operation: Operation,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "group", content = "command", deny_unknown_fields)]
pub enum Operation {
    Framework(FrameworkOperation),
    Feature(FeatureOperation),
    Task(TaskOperation),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum FrameworkOperation {
    Initialize(FrameworkInit),
    Info(EmptyArguments),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum FeatureOperation {
    Initialize(InitFeature),
    List(EmptyArguments),
    Status(FeatureQuery),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum TaskOperation {
    Create(CreateTask),
    Get(TaskQuery),
    History(TaskQuery),
    Claim(ClaimTask),
    Update(WorkerUpdate),
    Coordinate(CoordinatorUpdate),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct EmptyArguments {}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FrameworkInit {
    pub harness: AgentHarness,
    pub instructions: AgentInstructions,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum AgentHarness {
    None,
    Codex,
    Claude,
    Cursor,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum AgentInstructions {
    Write,
    Skip,
}

impl From<FrameworkInit> for IntegrationOptions {
    fn from(input: FrameworkInit) -> Self {
        let harness = match input.harness {
            AgentHarness::None => HarnessChoice::None,
            AgentHarness::Codex => HarnessChoice::Selected(Harness::Codex),
            AgentHarness::Claude => HarnessChoice::Selected(Harness::Claude),
            AgentHarness::Cursor => HarnessChoice::Selected(Harness::Cursor),
        };
        let instructions = match input.instructions {
            AgentInstructions::Write => InstructionAction::Write,
            AgentInstructions::Skip => InstructionAction::Skip,
        };
        Self {
            harness,
            instructions,
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum Reply {
    FrameworkInitialized {
        project: PathBuf,
    },
    FrameworkInfo(InfoReport),
    Ledger(LedgerInfo),
    Features(Vec<LedgerInfo>),
    Task(Task),
    TaskView(TaskView),
    Status {
        ledger: LedgerInfo,
        tasks: Vec<TaskView>,
    },
    History(Vec<Event>),
}

// Read only the version at the transport edge before selecting a supported decoder.
#[derive(Deserialize)]
struct RequestHeader {
    version: i64,
}

impl Request {
    pub fn decode(text: &str) -> Result<Self, AgentError> {
        let header: RequestHeader = serde_saphyr::from_str(text)?;
        match ProtocolVersion::try_from(header.version).map_err(LedgerError::from)? {
            ProtocolVersion::V1 => Ok(serde_saphyr::from_str(text)?),
        }
    }

    pub async fn execute(self) -> Result<Reply, AgentError> {
        match self.operation {
            Operation::Framework(operation) => operation.execute(self.project),
            Operation::Feature(operation) => {
                operation.execute(Workbench::discover(&self.project)?).await
            }
            Operation::Task(operation) => {
                let workbench = Workbench::discover(&self.project)?;
                let mut ledger = workbench.open(operation.feature().clone()).await?;
                operation.execute(&mut ledger).await
            }
        }
    }
}

impl FrameworkOperation {
    fn execute(self, project: PathBuf) -> Result<Reply, AgentError> {
        match self {
            Self::Initialize(input) => {
                let project = Project::open(project)?.prepare()?.install(InitRequest {
                    integration: input.into(),
                })?;
                Ok(Reply::FrameworkInitialized {
                    project: project.path().to_path_buf(),
                })
            }
            Self::Info(_) => Ok(Reply::FrameworkInfo(InfoReport::from(
                Project::open(project)?.info()?,
            ))),
        }
    }
}

impl FeatureOperation {
    async fn execute(self, workbench: Workbench) -> Result<Reply, AgentError> {
        match self {
            Self::Initialize(input) => Ok(Reply::Ledger(workbench.initialize(input).await?.info())),
            Self::List(_) => Ok(Reply::Features(workbench.features().await?)),
            Self::Status(input) => {
                let ledger = workbench.open(input.feature).await?;
                Ok(Reply::Status {
                    ledger: ledger.info(),
                    tasks: ledger.status().await?,
                })
            }
        }
    }
}

impl TaskOperation {
    fn feature(&self) -> &FeatureId {
        match self {
            Self::Create(input) => &input.feature,
            Self::Get(input) | Self::History(input) => &input.feature,
            Self::Claim(input) => &input.feature,
            Self::Update(input) => &input.feature,
            Self::Coordinate(input) => &input.feature,
        }
    }

    async fn execute(self, ledger: &mut Ledger) -> Result<Reply, AgentError> {
        match self {
            Self::Create(input) => Ok(Reply::Task(ledger.create(input).await?)),
            Self::Get(input) => Ok(Reply::TaskView(ledger.task(&input.task).await?)),
            Self::History(input) => Ok(Reply::History(ledger.history(&input.task).await?)),
            Self::Claim(input) => Ok(Reply::Task(ledger.claim(input).await?)),
            Self::Update(input) => Ok(Reply::Task(ledger.update(input).await?)),
            Self::Coordinate(input) => Ok(Reply::Task(ledger.coordinate(input).await?)),
        }
    }
}
