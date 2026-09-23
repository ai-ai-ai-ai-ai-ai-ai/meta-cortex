use super::AgentError;
use crate::information::InfoReport;
use crate::installation::{InitRequest, Project};
use crate::integration::{Harness, HarnessChoice, InstructionAction, IntegrationOptions};
use meta_cortex_workbench::model::{Event, Task, TaskView};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature, TaskQuery, WorkerUpdate,
};
use meta_cortex_workbench::values::FeatureId;
use meta_cortex_workbench::versions::{ProtocolVersion, ProtocolVersionParse};
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
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum Operation {
    #[serde(rename = "framework.init")]
    FrameworkInit(FrameworkInit),
    #[serde(rename = "framework.info")]
    FrameworkInfo(EmptyArguments),
    #[serde(rename = "ledger.init")]
    Initialize(InitFeature),
    #[serde(rename = "ledger.features")]
    Features(EmptyArguments),
    #[serde(rename = "ledger.status")]
    Status(FeatureQuery),
    #[serde(rename = "task.create")]
    Create(CreateTask),
    #[serde(rename = "task.get")]
    Get(TaskQuery),
    #[serde(rename = "task.history")]
    History(TaskQuery),
    #[serde(rename = "task.claim")]
    Claim(ClaimTask),
    #[serde(rename = "task.update")]
    Update(WorkerUpdate),
    #[serde(rename = "task.coordinate")]
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
        match ProtocolVersionParse::from(header.version) {
            ProtocolVersionParse::Parsed(ProtocolVersion::V1) => Ok(serde_saphyr::from_str(text)?),
            ProtocolVersionParse::Invalid(error) => Err(LedgerError::from(error).into()),
        }
    }

    pub async fn execute(self) -> Result<Reply, AgentError> {
        match self.operation {
            Operation::FrameworkInit(input) => {
                let project = Project::open(self.project)?
                    .prepare()?
                    .install(InitRequest {
                        integration: input.into(),
                    })?;
                Ok(Reply::FrameworkInitialized {
                    project: project.path().to_path_buf(),
                })
            }
            Operation::FrameworkInfo(_) => Ok(Reply::FrameworkInfo(InfoReport::from(
                Project::open(self.project)?.info()?,
            ))),
            Operation::Initialize(input) => {
                let workbench = Workbench::discover(&self.project)?;
                Ok(Reply::Ledger(workbench.initialize(input).await?.info()))
            }
            Operation::Features(_) => {
                let workbench = Workbench::discover(&self.project)?;
                Ok(Reply::Features(workbench.features().await?))
            }
            operation @ (Operation::Status(_)
            | Operation::Create(_)
            | Operation::Get(_)
            | Operation::History(_)
            | Operation::Claim(_)
            | Operation::Update(_)
            | Operation::Coordinate(_)) => {
                let workbench = Workbench::discover(&self.project)?;
                let feature = operation.feature()?.clone();
                let mut ledger = workbench.open(feature).await?;
                operation.execute(&mut ledger).await
            }
        }
    }
}

impl Operation {
    fn feature(&self) -> Result<&FeatureId, AgentError> {
        match self {
            Self::Status(input) => Ok(&input.feature),
            Self::Create(input) => Ok(&input.feature),
            Self::Get(input) | Self::History(input) => Ok(&input.feature),
            Self::Claim(input) => Ok(&input.feature),
            Self::Update(input) => Ok(&input.feature),
            Self::Coordinate(input) => Ok(&input.feature),
            Self::Initialize(_)
            | Self::Features(_)
            | Self::FrameworkInit(_)
            | Self::FrameworkInfo(_) => {
                Err(LedgerError::Invalid("operation does not open an existing ledger").into())
            }
        }
    }

    async fn execute(self, ledger: &mut Ledger) -> Result<Reply, AgentError> {
        match self {
            Self::Status(_) => Ok(Reply::Status {
                ledger: ledger.info(),
                tasks: ledger.status().await?,
            }),
            Self::Create(input) => Ok(Reply::Task(ledger.create(input).await?)),
            Self::Get(input) => Ok(Reply::TaskView(ledger.task(&input.task).await?)),
            Self::History(input) => Ok(Reply::History(ledger.history(&input.task).await?)),
            Self::Claim(input) => Ok(Reply::Task(ledger.claim(input).await?)),
            Self::Update(input) => Ok(Reply::Task(ledger.update(input).await?)),
            Self::Coordinate(input) => Ok(Reply::Task(ledger.coordinate(input).await?)),
            Self::Initialize(_)
            | Self::Features(_)
            | Self::FrameworkInit(_)
            | Self::FrameworkInfo(_) => {
                Err(LedgerError::Invalid("operation cannot run on an open ledger").into())
            }
        }
    }
}
