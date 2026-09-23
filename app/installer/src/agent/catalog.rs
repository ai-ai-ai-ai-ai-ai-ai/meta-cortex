use super::AgentError;
use super::discovery::{InvocationGuide, TransportGuide};
use super::protocol::{
    AgentHarness, AgentInstructions, EmptyArguments, FrameworkInit, Operation, Request,
};
use derive_more::{Display, From};
use meta_cortex_workbench::LedgerError;
use meta_cortex_workbench::model::{Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature,
    StoppedExecution, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    AgentId, Attempt, BranchNameParse, Extensions, FeatureIdParse, LeaseSeconds, Note, Revision,
    TaskIdParse,
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
        let feature = match FeatureIdParse::from("example".to_owned()) {
            FeatureIdParse::Parsed(value) => value,
            FeatureIdParse::Invalid(error) => {
                return Err(LedgerError::from(error).into());
            }
        };
        let task = match TaskIdParse::from("review".to_owned()) {
            TaskIdParse::Parsed(value) => value,
            TaskIdParse::Invalid(error) => {
                return Err(LedgerError::from(error).into());
            }
        };
        let coordinator = AgentId::Gizmo;
        let worker = AgentId::RustDev;
        let ttl = LeaseSeconds::TEN_MINUTES;
        let claimed_revision = Revision::INITIAL.advance()?;
        let heartbeat_revision = claimed_revision.advance()?;
        let examples = [
            CommandExample {
                description: CommandSummary::from(
                    "Discover existing feature IDs and database paths after a coordinator restart.",
                ),
                operation: Operation::ListFeatures(EmptyArguments {}),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Install the bundled framework without interactive prompts.",
                ),
                operation: Operation::InitializeFramework(FrameworkInit {
                    harness: AgentHarness::None,
                    instructions: AgentInstructions::Skip,
                }),
            },
            CommandExample {
                description: CommandSummary::from("Inspect the installed framework and models."),
                operation: Operation::GetFrameworkInfo(EmptyArguments {}),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Initialize or reopen this feature's isolated ledger after preparing its branch and worktree.",
                ),
                operation: Operation::InitializeFeature(InitFeature {
                    feature: feature.clone(),
                    objective: Note::from("Implement the feature".to_owned()),
                    branch: match BranchNameParse::from("codex/example".to_owned()) {
                        BranchNameParse::Parsed(value) => value,
                        BranchNameParse::Invalid(error) => {
                            return Err(LedgerError::from(error).into());
                        }
                    },
                    worktree: PathBuf::from("/absolute/project"),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read all tasks, current revisions, continuation notes, and lease health for one feature.",
                ),
                operation: Operation::GetFeatureStatus(FeatureQuery {
                    feature: feature.clone(),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Record a bounded assignment before launching its worker. Dependencies must already exist.",
                ),
                operation: Operation::CreateTask(CreateTask {
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
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read a task before changing it. Use the returned revision and attempt.",
                ),
                operation: Operation::GetTask(TaskQuery {
                    feature: feature.clone(),
                    task: task.clone(),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read the append-only task history, including previous attempts.",
                ),
                operation: Operation::GetTaskHistory(TaskQuery {
                    feature: feature.clone(),
                    task: task.clone(),
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Claim a queued task atomically. All dependencies must be integrated.",
                ),
                operation: Operation::ClaimTask(ClaimTask {
                    feature: feature.clone(),
                    task: task.clone(),
                    expected_revision: Revision::INITIAL,
                    agent: worker,
                    ttl_seconds: ttl,
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Worker operation: heartbeat, progress, checkpoint, or ready. The schema below describes each action. Timestamps are Unix milliseconds; TTL is 1–86400 seconds.",
                ),
                operation: Operation::UpdateTask(WorkerUpdate {
                    feature: feature.clone(),
                    task: task.clone(),
                    expected_revision: claimed_revision,
                    agent: worker,
                    attempt: Attempt::UNCLAIMED.advance()?,
                    action: WorkerAction::Heartbeat { ttl_seconds: ttl },
                }),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Coordinator operation: integrate, requeue, or cancel. Requeue only after inspecting/stopping the previous execution.",
                ),
                operation: Operation::CoordinateTask(CoordinatorUpdate {
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
