use super::AgentError;
use super::protocol::Request;
use meta_cortex_workbench::versions::ProtocolVersion;
use schemars::{Schema, schema_for};
use serde::Serialize;

#[derive(Serialize)]
pub struct Catalog {
    version: ProtocolVersion,
    invocation: &'static str,
    transport: &'static str,
    commands: Vec<CommandDescription>,
    request_schema: Schema,
}

#[derive(Serialize)]
struct CommandDescription {
    description: &'static str,
    example: Request,
}

impl Catalog {
    pub fn render() -> Result<String, AgentError> {
        let examples = [
            (
                "Discover existing feature IDs and database paths after a coordinator restart.",
                "name: ledger.features\narguments: {}",
            ),
            (
                "Install the bundled framework without interactive prompts.",
                "name: framework.init\narguments: {harness: none, instructions: skip}",
            ),
            (
                "Inspect the installed framework and models.",
                "name: framework.info\narguments: {}",
            ),
            (
                "Initialize or reopen this feature's isolated ledger after preparing its branch and worktree.",
                "name: ledger.init\narguments:\n  feature: example\n  objective: Implement the feature\n  branch: codex/example\n  worktree: /absolute/project",
            ),
            (
                "Read all tasks, current revisions, continuation notes, and lease health for one feature.",
                "name: ledger.status\narguments: {feature: example}",
            ),
            (
                "Record a bounded assignment before launching its worker. Dependencies must already exist.",
                "name: task.create\narguments:\n  feature: example\n  task: review\n  actor: gizmo\n  objective: Review the feature\n  acceptance: [Report actionable findings]\n  dependencies: []\n  workspace: {kind: read_only}\n  progress:\n    summary: Awaiting assignment\n    findings: []\n    next_steps: [Read the diff]\n    checks: []\n    extensions: {}",
            ),
            (
                "Read a task before changing it. Use the returned revision and attempt.",
                "name: task.get\narguments: {feature: example, task: review}",
            ),
            (
                "Read the append-only task history, including previous attempts.",
                "name: task.history\narguments: {feature: example, task: review}",
            ),
            (
                "Claim a queued task atomically. All dependencies must be integrated.",
                "name: task.claim\narguments: {feature: example, task: review, expected_revision: 1, agent: reviewer, ttl_seconds: 600}",
            ),
            (
                "Worker operation: heartbeat, progress, checkpoint, or ready. The schema below describes each action. Timestamps are Unix milliseconds; TTL is 1–86400 seconds.",
                "name: task.update\narguments:\n  feature: example\n  task: review\n  expected_revision: 2\n  agent: reviewer\n  attempt: 1\n  action: {kind: heartbeat, ttl_seconds: 600}",
            ),
            (
                "Coordinator operation: integrate, requeue, or cancel. Requeue only after inspecting/stopping the previous execution.",
                "name: task.coordinate\narguments:\n  feature: example\n  task: review\n  expected_revision: 3\n  actor: gizmo\n  action:\n    kind: requeue\n    reason: Previous worker exited; resume from its recorded progress\n    previous_execution: stopped_or_finished",
            ),
        ];
        let mut commands = Vec::new();
        for (description, operation) in examples {
            let operation = operation
                .lines()
                .map(|line| format!("  {line}\n"))
                .collect::<String>();
            let example = serde_saphyr::from_str(&format!(
                "version: 1\nproject: /absolute/project\noperation:\n{operation}"
            ))?;
            commands.push(CommandDescription {
                description,
                example,
            });
        }
        let catalog = Self {
            version: ProtocolVersion::CURRENT,
            invocation: "meta-cortex run --request request.yaml (or --request - for stdin)",
            transport: "One YAML request and response per process; local tool discovery/calls, no MCP server or JSON-RPC session. Exit 0: success; exit 2: structured error. Legacy init/info remain available; list/--help discover the CLI.",
            commands,
            request_schema: schema_for!(Request),
        };
        Ok(serde_saphyr::to_string(&catalog)?)
    }
}
