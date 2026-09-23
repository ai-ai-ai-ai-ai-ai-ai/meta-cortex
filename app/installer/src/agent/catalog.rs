use super::AgentError;
use super::protocol::Request;
use derive_more::{Display, From};
use meta_cortex_workbench::versions::ProtocolVersion;
use schemars::{Schema, schema_for};
use serde::Serialize;

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
struct InvocationGuide(&'static str);

impl InvocationGuide {
    const YAML_REQUEST: Self =
        Self("meta-cortex run --request request.yaml (or --request - for stdin)");
}

#[derive(Serialize, From)]
#[serde(transparent)]
struct TransportGuide(&'static str);

impl TransportGuide {
    const LOCAL_YAML: Self = Self(
        "One YAML request and response per process; local tool discovery/calls, no MCP server or JSON-RPC session. Exit 0: success; exit 2: structured error. Legacy init/info remain available; list/--help discover the CLI.",
    );
}

#[derive(Serialize, From)]
#[serde(transparent)]
struct CommandSummary(&'static str);

#[derive(From)]
struct ExampleOperationYaml(&'static str);

struct CommandExample {
    description: CommandSummary,
    operation: ExampleOperationYaml,
}

#[derive(Display, From)]
pub struct CatalogYaml(String);

impl TryFrom<ExampleOperationYaml> for Request {
    type Error = AgentError;

    fn try_from(value: ExampleOperationYaml) -> Result<Self, Self::Error> {
        let operation = value
            .0
            .lines()
            .map(|line| format!("  {line}\n"))
            .collect::<String>();
        Ok(serde_saphyr::from_str(&format!(
            "version: 1\nproject: /absolute/project\noperation:\n{operation}"
        ))?)
    }
}

impl Catalog {
    pub fn discover() -> Result<Self, AgentError> {
        let examples = [
            CommandExample {
                description: CommandSummary::from(
                    "Discover existing feature IDs and database paths after a coordinator restart.",
                ),
                operation: ExampleOperationYaml::from("name: ledger.features\narguments: {}"),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Install the bundled framework without interactive prompts.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: framework.init\narguments: {harness: none, instructions: skip}",
                ),
            },
            CommandExample {
                description: CommandSummary::from("Inspect the installed framework and models."),
                operation: ExampleOperationYaml::from("name: framework.info\narguments: {}"),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Initialize or reopen this feature's isolated ledger after preparing its branch and worktree.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: ledger.init\narguments:\n  feature: example\n  objective: Implement the feature\n  branch: codex/example\n  worktree: /absolute/project",
                ),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read all tasks, current revisions, continuation notes, and lease health for one feature.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: ledger.status\narguments: {feature: example}",
                ),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Record a bounded assignment before launching its worker. Dependencies must already exist.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: task.create\narguments:\n  feature: example\n  task: review\n  actor: gizmo\n  objective: Review the feature\n  acceptance: [Report actionable findings]\n  dependencies: []\n  workspace: {kind: read_only}\n  progress:\n    summary: Awaiting assignment\n    findings: []\n    next_steps: [Read the diff]\n    checks: []\n    extensions: {}",
                ),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read a task before changing it. Use the returned revision and attempt.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: task.get\narguments: {feature: example, task: review}",
                ),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Read the append-only task history, including previous attempts.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: task.history\narguments: {feature: example, task: review}",
                ),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Claim a queued task atomically. All dependencies must be integrated.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: task.claim\narguments: {feature: example, task: review, expected_revision: 1, agent: reviewer, ttl_seconds: 600}",
                ),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Worker operation: heartbeat, progress, checkpoint, or ready. The schema below describes each action. Timestamps are Unix milliseconds; TTL is 1–86400 seconds.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: task.update\narguments:\n  feature: example\n  task: review\n  expected_revision: 2\n  agent: reviewer\n  attempt: 1\n  action: {kind: heartbeat, ttl_seconds: 600}",
                ),
            },
            CommandExample {
                description: CommandSummary::from(
                    "Coordinator operation: integrate, requeue, or cancel. Requeue only after inspecting/stopping the previous execution.",
                ),
                operation: ExampleOperationYaml::from(
                    "name: task.coordinate\narguments:\n  feature: example\n  task: review\n  expected_revision: 3\n  actor: gizmo\n  action:\n    kind: requeue\n    reason: Previous worker exited; resume from its recorded progress\n    previous_execution: stopped_or_finished",
                ),
            },
        ];
        let mut commands = Vec::new();
        for example in examples {
            commands.push(CommandDescription {
                description: example.description,
                example: Request::try_from(example.operation)?,
            });
        }
        Ok(Self {
            version: ProtocolVersion::CURRENT,
            invocation: InvocationGuide::YAML_REQUEST,
            transport: TransportGuide::LOCAL_YAML,
            commands,
            request_schema: schema_for!(Request),
        })
    }

    pub fn render(&self) -> Result<CatalogYaml, AgentError> {
        Ok(CatalogYaml::from(serde_saphyr::to_string(self)?))
    }
}
