use super::{AgentError, Execution};
use crate::information::InfoReport;
use crate::installation::{InitRequest, Project, ToolSetup};
use crate::integration::{Harness, HarnessChoice, InstructionAction, IntegrationOptions};
use crate::wrapper::{ProjectWrapper, WrapperReport, WrapperRequest};
use meta_cortex_visualization::{Dashboard, DashboardReport, DashboardRequest, DesktopLaunch};
use meta_cortex_workbench::model::{Event, Task, TaskView};
use meta_cortex_workbench::request::{
    AssignTask, ClaimTask, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature, TaskQuery,
    WorkerUpdate,
};
use meta_cortex_workbench::values::FeatureId;
use meta_cortex_workbench::versions::ProtocolVersion;
use meta_cortex_workbench::{FeatureCatalog, Ledger, LedgerError, LedgerInfo, Workbench};
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
    Workbench(WorkbenchOperation),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum FrameworkOperation {
    Initialize(FrameworkInit),
    Info(EmptyArguments),
    Wrapper(WrapperRequest),
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
    Assign(AssignTask),
    Get(TaskQuery),
    History(TaskQuery),
    Claim(ClaimTask),
    Update(WorkerUpdate),
    Coordinate(CoordinatorUpdate),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum WorkbenchOperation {
    Dashboard(DashboardRequest),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct EmptyArguments {}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FrameworkInit {
    pub harness: AgentHarness,
    pub instructions: AgentInstructions,
    #[serde(default)]
    pub mise: ToolSetup,
    #[serde(default)]
    pub bun: ToolSetup,
    #[serde(default)]
    pub vale: ToolSetup,
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

impl From<FrameworkInit> for InitRequest {
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
            integration: IntegrationOptions {
                harness,
                instructions,
            },
            mise: input.mise,
            bun: input.bun,
            vale: input.vale,
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
    FrameworkWrapper(WrapperReport),
    Ledger(LedgerInfo),
    Features(FeatureCatalog),
    Task(Task),
    TaskView(TaskView),
    Status {
        ledger: LedgerInfo,
        tasks: Vec<TaskView>,
    },
    History(Vec<Event>),
    Dashboard(DashboardReport),
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

    pub async fn execute(self) -> Result<Execution, AgentError> {
        match self.operation {
            Operation::Workbench(WorkbenchOperation::Dashboard(input)) => match input {
                DashboardRequest::Desktop {} => Ok(Execution::Desktop(DesktopLaunch::discover()?)),
                DashboardRequest::Snapshot { view, page } => {
                    let workbench = Workbench::discover(&self.project)?;
                    Ok(Execution::from(
                        Dashboard::from(workbench)
                            .execute(DashboardRequest::Snapshot { view, page })
                            .await?,
                    ))
                }
            },
            Operation::Framework(operation) => operation.execute(self.project).map(Execution::from),
            Operation::Feature(operation) => operation
                .execute(Workbench::discover(&self.project)?)
                .await
                .map(Execution::from),
            Operation::Task(operation) => {
                let workbench = Workbench::discover(&self.project)?;
                let mut ledger = workbench.open(operation.feature().clone()).await?;
                operation.execute(&mut ledger).await.map(Execution::from)
            }
        }
    }
}

impl FrameworkOperation {
    fn execute(self, project: PathBuf) -> Result<Reply, AgentError> {
        match self {
            Self::Initialize(input) => {
                let project = Project::open(project)?.prepare()?.install(input.into())?;
                Ok(Reply::FrameworkInitialized {
                    project: project.path().to_path_buf(),
                })
            }
            Self::Wrapper(input) => Ok(Reply::FrameworkWrapper(
                ProjectWrapper::open(project)?.generate(input)?,
            )),
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
            Self::Assign(input) => &input.feature,
            Self::Get(input) | Self::History(input) => &input.feature,
            Self::Claim(input) => &input.feature,
            Self::Update(input) => &input.feature,
            Self::Coordinate(input) => &input.feature,
        }
    }

    async fn execute(self, ledger: &mut Ledger) -> Result<Reply, AgentError> {
        match self {
            Self::Create(input) => Ok(Reply::Task(ledger.create(input).await?)),
            Self::Assign(input) => Ok(Reply::Task(ledger.assign(input).await?)),
            Self::Get(input) => Ok(Reply::TaskView(ledger.task(&input.task).await?)),
            Self::History(input) => Ok(Reply::History(ledger.history(&input.task).await?)),
            Self::Claim(input) => Ok(Reply::Task(ledger.claim(input).await?)),
            Self::Update(input) => Ok(Reply::Task(ledger.update(input).await?)),
            Self::Coordinate(input) => Ok(Reply::Task(ledger.coordinate(input).await?)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentHarness, AgentInstructions, FrameworkInit, ToolSetup};
    use serde::Serialize;

    #[derive(Serialize)]
    struct FrameworkDefaults {
        harness: AgentHarness,
        instructions: AgentInstructions,
    }

    #[test]
    fn desktop_preparation_ignores_missing_non_git_project_but_snapshot_is_scoped()
    -> anyhow::Result<()> {
        use super::{Operation, Request, WorkbenchOperation};
        use crate::agent::Execution;
        use meta_cortex_visualization::{DashboardRequest, DashboardView};
        use meta_cortex_workbench::PageIndex;
        use meta_cortex_workbench::versions::ProtocolVersion;
        use tokio::runtime::Builder;
        let directory = tempfile::tempdir()?;
        let missing = directory.path().join("no-checkout");
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let desktop = Request {
                    version: ProtocolVersion::V1,
                    project: missing.clone(),
                    operation: Operation::Workbench(WorkbenchOperation::Dashboard(
                        DashboardRequest::Desktop {},
                    )),
                };
                assert!(matches!(desktop.execute().await?, Execution::Desktop(_)));
                let snapshot = Request {
                    version: ProtocolVersion::V1,
                    project: missing.clone(),
                    operation: Operation::Workbench(WorkbenchOperation::Dashboard(
                        DashboardRequest::Snapshot {
                            view: DashboardView::Features,
                            page: PageIndex::FIRST,
                        },
                    )),
                };
                assert!(snapshot.execute().await.is_err());
                assert!(!missing.exists());
                Ok::<_, anyhow::Error>(())
            })
    }

    #[test]
    fn omitted_tool_policies_install_missing_dependencies() -> anyhow::Result<()> {
        let input = FrameworkDefaults {
            harness: AgentHarness::None,
            instructions: AgentInstructions::Skip,
        };
        let encoded = serde_saphyr::to_string(&input)?;
        let decoded: FrameworkInit = serde_saphyr::from_str(&encoded)?;
        assert!(matches!(decoded.mise, ToolSetup::InstallMissing));
        assert!(matches!(decoded.bun, ToolSetup::InstallMissing));
        assert!(matches!(decoded.vale, ToolSetup::InstallMissing));
        Ok(())
    }
}
