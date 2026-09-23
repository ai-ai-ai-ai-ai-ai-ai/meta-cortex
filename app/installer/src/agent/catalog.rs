use super::AgentError;
use super::discovery::{InvocationGuide, TransportGuide};
use super::protocol::{
    AgentHarness, AgentInstructions, EmptyArguments, FrameworkInit, Operation, Request,
};
use derive_more::{Display, From};
use meta_cortex_workbench::model::{Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature,
    StoppedExecution, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    AgentId, Attempt, BranchName, Extensions, FeatureId, LeaseSeconds, Note, Revision, TaskId,
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
    commands: Vec<CommandDescription>,
    request_schema: Schema,
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
        let feature = FeatureId::try_from("example".to_owned())?;
        let task = TaskId::try_from("review".to_owned())?;
        let coordinator = AgentId::try_from("gizmo".to_owned())?;
        let worker = AgentId::try_from("reviewer".to_owned())?;
        let ttl = LeaseSeconds::try_from(600)?;
        let examples = [
            CommandExample {
                description: CommandSummary::from(
                    "Discover existing feature IDs and database paths after a coordinator restart.",
                ),
                operation: Operation::Features(EmptyArguments {}),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Install the bundled framework without interactive prompts.",
                ),
                operation: Operation::FrameworkInit(FrameworkInit {
                    harness: AgentHarness::None,
                    instructions: AgentInstructions::Skip,
                }),
            },
            CommandExample {
                description: CommandSummary::from("Inspect the installed framework and models."),
                operation: Operation::FrameworkInfo(EmptyArguments {}),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Initialize or reopen this feature's isolated ledger after preparing its branch and worktree.",
                ),
                operation: Operation::Initialize(InitFeature {
                    feature: feature.clone(),
                    objective: Note::try_from("Implement the feature".to_owned())?,
                    branch: BranchName::try_from("codex/example".to_owned())?,
                    worktree: PathBuf::from("/absolute/project"),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read all tasks, current revisions, continuation notes, and lease health for one feature.",
                ),
                operation: Operation::Status(FeatureQuery {
                    feature: feature.clone(),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Record a bounded assignment before launching its worker. Dependencies must already exist.",
                ),
                operation: Operation::Create(CreateTask {
                    feature: feature.clone(),
                    task: task.clone(),
                    actor: coordinator.clone(),
                    objective: Note::try_from("Review the feature".to_owned())?,
                    acceptance: vec![Note::try_from("Report actionable findings".to_owned())?],
                    dependencies: Vec::new(),
                    workspace: Workspace::ReadOnly,
                    progress: Progress {
                        summary: Note::try_from("Awaiting assignment".to_owned())?,
                        findings: Vec::new(),
                        next_steps: vec![Note::try_from("Read the diff".to_owned())?],
                        checks: Vec::new(),
                        extensions: Extensions::default(),
                    },
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read a task before changing it. Use the returned revision and attempt.",
                ),
                operation: Operation::Get(TaskQuery {
                    feature: feature.clone(),
                    task: task.clone(),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read the append-only task history, including previous attempts.",
                ),
                operation: Operation::History(TaskQuery {
                    feature: feature.clone(),
                    task: task.clone(),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Claim a queued task atomically. All dependencies must be integrated.",
                ),
                operation: Operation::Claim(ClaimTask {
                    feature: feature.clone(),
                    task: task.clone(),
                    expected_revision: Revision::INITIAL,
                    agent: worker.clone(),
                    ttl_seconds: ttl,
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Worker operation: heartbeat, progress, checkpoint, or ready. The schema below describes each action. Timestamps are Unix milliseconds; TTL is 1–86400 seconds.",
                ),
                operation: Operation::Update(WorkerUpdate {
                    feature: feature.clone(),
                    task: task.clone(),
                    expected_revision: Revision::try_from(2)?,
                    agent: worker,
                    attempt: Attempt::try_from(1)?,
                    action: WorkerAction::Heartbeat { ttl_seconds: ttl },
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Coordinator operation: integrate, requeue, or cancel. Requeue only after inspecting/stopping the previous execution.",
                ),
                operation: Operation::Coordinate(CoordinatorUpdate {
                    feature,
                    task,
                    expected_revision: Revision::try_from(3)?,
                    actor: coordinator,
                    action: CoordinatorAction::Requeue {
                        reason: Note::try_from(
                            "Previous worker exited; resume from its recorded progress".to_owned(),
                        )?,
                        previous_execution: StoppedExecution::StoppedOrFinished,
                    },
                }),
            },
        ];
        let mut commands = Vec::new();
        for example in examples {
            commands.push(CommandDescription {
                description: example.description,
                example: Request {
                    version: ProtocolVersion::CURRENT,
                    project: PathBuf::from("/absolute/project"),
                    operation: example.operation,
                },
            });
        }
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
