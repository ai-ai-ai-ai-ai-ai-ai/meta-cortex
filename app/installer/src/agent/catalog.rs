use super::AgentError;
use super::discovery::{InvocationGuide, TransportGuide};
use super::protocol::{
    AgentHarness, AgentInstructions, EmptyArguments, FeatureOperation, FrameworkInit,
    FrameworkOperation, Operation, Request, TaskOperation,
};
use crate::installation::BunSetup;
use derive_more::{Display, From};
use meta_cortex_workbench::LedgerError;
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::{Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature,
    StoppedExecution, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    Attempt, BranchName, Extensions, FeatureId, LeaseSeconds, Note, Revision, TaskId,
};
use meta_cortex_workbench::versions::ProtocolVersion;
use schemars::{Schema, schema_for};
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct Catalog {
    version: ProtocolVersion,
    invocation: InvocationGuide,
    transport: TransportGuide,
    commands: CommandGroups,
    request_schema: Schema,
}

#[derive(Default, Serialize)]
struct CommandGroups {
    framework: Vec<CommandDescription>,
    feature: Vec<CommandDescription>,
    task: Vec<CommandDescription>,
}

impl CommandGroups {
    #[must_use]
    fn insert(mut self, example: CommandExample) -> Self {
        let commands = match &example.operation {
            Operation::Framework(_) => &mut self.framework,
            Operation::Feature(_) => &mut self.feature,
            Operation::Task(_) => &mut self.task,
        };
        commands.push(CommandDescription {
            description: example.description,
            example: Request {
                version: ProtocolVersion::CURRENT,
                project: PathBuf::from("/absolute/project"),
                operation: example.operation,
            },
        });
        self
    }
}

#[derive(Serialize)]
struct CommandDescription {
    description: CommandSummary,
    example: Request,
}

#[derive(Serialize, From)]
#[serde(transparent)]
struct CommandSummary(&'static str);

struct CommandExample {
    description: CommandSummary,
    operation: Operation,
}

#[derive(Display, From)]
pub struct CatalogYaml(String);

impl Catalog {
    pub fn discover() -> Result<Self, AgentError> {
        let feature = FeatureId::try_from("example".to_owned()).map_err(LedgerError::from)?;
        let task = TaskId::try_from("review".to_owned()).map_err(LedgerError::from)?;
        let coordinator = AgentId::Gizmo(GizmoAgent::Gizmo);
        let worker = AgentId::Development(DevelopmentAgent::RustDev);
        let ttl = LeaseSeconds::TEN_MINUTES;
        let claimed_revision = Revision::INITIAL.advance()?;
        let heartbeat_revision = claimed_revision.advance()?;
        let examples = [
            CommandExample {
                description: CommandSummary::from(
                    "Discover existing feature IDs and database paths after a coordinator restart.",
                ),
                operation: Operation::Feature(FeatureOperation::List(EmptyArguments {})),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Install missing Bun and the bundled framework without interactive prompts. Set bun to RequireExisting to disable Bun installation.",
                ),
                operation: Operation::Framework(FrameworkOperation::Initialize(FrameworkInit {
                    harness: AgentHarness::None,
                    instructions: AgentInstructions::Skip,
                    bun: BunSetup::InstallMissing,
                })),
            },
            CommandExample {
                description: CommandSummary::from("Inspect the installed framework and models."),
                operation: Operation::Framework(FrameworkOperation::Info(EmptyArguments {})),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Initialize or reopen this feature's isolated ledger after preparing its branch and worktree.",
                ),
                operation: Operation::Feature(FeatureOperation::Initialize(InitFeature {
                    feature: feature.clone(),
                    objective: Note::from("Implement the feature".to_owned()),
                    branch: BranchName::try_from("codex/example".to_owned())
                        .map_err(LedgerError::from)?,
                    worktree: PathBuf::from("/absolute/project"),
                })),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read all tasks, current revisions, continuation notes, and lease health for one feature.",
                ),
                operation: Operation::Feature(FeatureOperation::Status(FeatureQuery {
                    feature: feature.clone(),
                })),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Record a bounded assignment before launching its worker. Dependencies must already exist.",
                ),
                operation: Operation::Task(TaskOperation::Create(CreateTask {
                    feature: feature.clone(),
                    task: task.clone(),
                    actor: coordinator,
                    objective: Note::from("Review the feature".to_owned()),
                    acceptance: vec![Note::from("Report actionable findings".to_owned())],
                    dependencies: Vec::new(),
                    workspace: Workspace::ReadOnly,
                    progress: Progress {
                        summary: Note::from("Awaiting assignment".to_owned()),
                        findings: Vec::new(),
                        next_steps: vec![Note::from("Read the diff".to_owned())],
                        checks: Vec::new(),
                        extensions: Extensions::default(),
                    },
                })),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read a task before changing it. Use the returned revision and attempt.",
                ),
                operation: Operation::Task(TaskOperation::Get(TaskQuery {
                    feature: feature.clone(),
                    task: task.clone(),
                })),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read the append-only task history, including previous attempts.",
                ),
                operation: Operation::Task(TaskOperation::History(TaskQuery {
                    feature: feature.clone(),
                    task: task.clone(),
                })),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Claim a queued task atomically. All dependencies must be integrated.",
                ),
                operation: Operation::Task(TaskOperation::Claim(ClaimTask {
                    feature: feature.clone(),
                    task: task.clone(),
                    expected_revision: Revision::INITIAL,
                    agent: worker,
                    ttl_seconds: ttl,
                })),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Worker operation: heartbeat, progress, checkpoint, or ready. The schema below describes each action. Timestamps are Unix milliseconds; TTL is 1–86400 seconds.",
                ),
                operation: Operation::Task(TaskOperation::Update(WorkerUpdate {
                    feature: feature.clone(),
                    task: task.clone(),
                    expected_revision: claimed_revision,
                    agent: worker,
                    attempt: Attempt::UNCLAIMED.advance()?,
                    action: WorkerAction::Heartbeat { ttl_seconds: ttl },
                })),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Coordinator operation: integrate, requeue, or cancel. Requeue only after inspecting/stopping the previous execution.",
                ),
                operation: Operation::Task(TaskOperation::Coordinate(CoordinatorUpdate {
                    feature,
                    task,
                    expected_revision: heartbeat_revision,
                    actor: coordinator,
                    action: CoordinatorAction::Requeue {
                        reason: Note::from(
                            "Previous worker exited; resume from its recorded progress".to_owned(),
                        ),
                        previous_execution: StoppedExecution::StoppedOrFinished,
                    },
                })),
            },
        ];
        let commands = examples
            .into_iter()
            .fold(CommandGroups::default(), CommandGroups::insert);
        Ok(Self {
            version: ProtocolVersion::CURRENT,
            invocation: InvocationGuide::example(),
            transport: TransportGuide::LOCAL_YAML,
            commands,
            request_schema: schema_for!(Request),
        })
    }

    pub fn render(&self) -> Result<CatalogYaml, AgentError> {
        Ok(CatalogYaml::from(serde_saphyr::to_string(self)?))
    }
}
