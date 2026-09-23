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
    InitializeFramework(FrameworkInit),
    GetFrameworkInfo(EmptyArguments),
    InitializeFeature(InitFeature),
    ListFeatures(EmptyArguments),
    GetFeatureStatus(FeatureQuery),
    CreateTask(CreateTask),
    GetTask(TaskQuery),
    GetTaskHistory(TaskQuery),
    ClaimTask(ClaimTask),
    UpdateTask(WorkerUpdate),
    CoordinateTask(CoordinatorUpdate),
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
            Operation::InitializeFramework(input) => {
                let project = Project::open(self.project)?
                    .prepare()?
                    .install(InitRequest {
                        integration: input.into(),
                    })?;
                Ok(Reply::FrameworkInitialized {
                    project: project.path().to_path_buf(),
                })
            }
            Operation::GetFrameworkInfo(_) => Ok(Reply::FrameworkInfo(InfoReport::from(
                Project::open(self.project)?.info()?,
            ))),
            Operation::InitializeFeature(input) => {
                let workbench = Workbench::discover(&self.project)?;
                Ok(Reply::Ledger(workbench.initialize(input).await?.info()))
            }
            Operation::ListFeatures(_) => {
                let workbench = Workbench::discover(&self.project)?;
                Ok(Reply::Features(workbench.features().await?))
            }
            operation @ (Operation::GetFeatureStatus(_)
            | Operation::CreateTask(_)
            | Operation::GetTask(_)
            | Operation::GetTaskHistory(_)
            | Operation::ClaimTask(_)
            | Operation::UpdateTask(_)
            | Operation::CoordinateTask(_)) => {
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
            Self::GetFeatureStatus(input) => Ok(&input.feature),
            Self::CreateTask(input) => Ok(&input.feature),
            Self::GetTask(input) | Self::GetTaskHistory(input) => Ok(&input.feature),
            Self::ClaimTask(input) => Ok(&input.feature),
            Self::UpdateTask(input) => Ok(&input.feature),
            Self::CoordinateTask(input) => Ok(&input.feature),
            Self::InitializeFeature(_)
            | Self::ListFeatures(_)
            | Self::InitializeFramework(_)
            | Self::GetFrameworkInfo(_) => {
                Err(LedgerError::Invalid("operation does not open an existing ledger").into())
            }
        }
    }

    async fn execute(self, ledger: &mut Ledger) -> Result<Reply, AgentError> {
        match self {
            Self::GetFeatureStatus(_) => Ok(Reply::Status {
                ledger: ledger.info(),
                tasks: ledger.status().await?,
            }),
            Self::CreateTask(input) => Ok(Reply::Task(ledger.create(input).await?)),
            Self::GetTask(input) => Ok(Reply::TaskView(ledger.task(&input.task).await?)),
            Self::GetTaskHistory(input) => Ok(Reply::History(ledger.history(&input.task).await?)),
            Self::ClaimTask(input) => Ok(Reply::Task(ledger.claim(input).await?)),
            Self::UpdateTask(input) => Ok(Reply::Task(ledger.update(input).await?)),
            Self::CoordinateTask(input) => Ok(Reply::Task(ledger.coordinate(input).await?)),
            Self::InitializeFeature(_)
            | Self::ListFeatures(_)
            | Self::InitializeFramework(_)
            | Self::GetFrameworkInfo(_) => {
                Err(LedgerError::Invalid("operation cannot run on an open ledger").into())
            }
        }
    }
}
