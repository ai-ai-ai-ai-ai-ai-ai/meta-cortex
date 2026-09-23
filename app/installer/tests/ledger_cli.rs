use anyhow::{Context, bail};
use serde::Deserialize;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tempfile::TempDir;

// An independent consumer of the CLI's versioned YAML response.
#[derive(Debug, Deserialize)]
struct Response {
    version: u32,
    result: Outcome,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "status", content = "data", rename_all = "snake_case")]
enum Outcome {
    Success(Reply),
    Error(Failure),
}
#[derive(Debug, Deserialize)]
struct Failure {
    code: String,
    message: String,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
enum Reply {
    Ledger(LedgerInfo),
    Features(Vec<LedgerInfo>),
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
struct InfoPaths {
    project: PathBuf,
    framework: PathBuf,
}
#[derive(Debug, Deserialize)]
struct LedgerInfo {
    path: PathBuf,
    storage_version: u32,
}
#[derive(Debug, Deserialize)]
struct Task {
    id: String,
    revision: u32,
    attempt: u32,
    state: State,
    last_update: u64,
    last_progress: u64,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum State {
    Queued,
    Active,
    Ready,
    Integrated,
    Cancelled,
}
#[derive(Debug, Deserialize)]
struct TaskView {
    task: Task,
    lease: String,
}
#[derive(Debug, Deserialize)]
struct Event {
    kind: String,
    task: Task,
}

struct Scenario {
    directory: TempDir,
}
impl Scenario {
    fn create() -> anyhow::Result<Self> {
        let scenario = Self {
            directory: tempfile::tempdir()?,
        };
        scenario.git(&["init", "-b", "codex/feature"])?;
        scenario.git(&["config", "user.name", "Ledger Test"])?;
        scenario.git(&["config", "user.email", "ledger@example.invalid"])?;
        scenario.git(&["commit", "--allow-empty", "-m", "initial"])?;
        Ok(scenario)
    }
    fn git(&self, args: &[&str]) -> anyhow::Result<String> {
        let result = Command::new("git")
            .arg("-C")
            .arg(self.directory.path())
            .args(args)
            .output()?;
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        Ok(String::from_utf8(result.stdout)?.trim().to_owned())
    }
    fn start(&self, operation: &str) -> anyhow::Result<Child> {
        let project = serde_saphyr::to_string(&self.directory.path())?;
        let operation = operation
            .lines()
            .map(|line| format!("  {line}\n"))
            .collect::<String>();
        let request = format!("version: 1\nproject: {project}operation:\n{operation}");
        let mut child = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .args(["run", "--request", "-"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        child
            .stdin
            .take()
            .context("stdin")?
            .write_all(request.as_bytes())?;
        Ok(child)
    }
    fn collect(child: Child) -> anyhow::Result<Response> {
        let result = child.wait_with_output()?;
        let text = String::from_utf8(result.stdout)?;
        let response: Response = serde_saphyr::from_str(&text).with_context(|| {
            format!(
                "{text}; stderr: {}",
                String::from_utf8_lossy(&result.stderr)
            )
        })?;
        assert_eq!(response.version, 1);
        assert_eq!(
            result.status.success(),
            matches!(&response.result, Outcome::Success(_)),
            "{response:?}"
        );
        Ok(response)
    }
    fn run(&self, operation: &str) -> anyhow::Result<Reply> {
        match Self::collect(self.start(operation)?)?.result {
            Outcome::Success(reply) => Ok(reply),
            Outcome::Error(error) => bail!("{}: {}", error.code, error.message),
        }
    }
    fn failure(&self, operation: &str) -> anyhow::Result<Failure> {
        match Self::collect(self.start(operation)?)?.result {
            Outcome::Success(reply) => bail!("unexpected success: {reply:?}"),
            Outcome::Error(error) => Ok(error),
        }
    }
    fn init(&self, feature: &str) -> anyhow::Result<LedgerInfo> {
        let worktree = serde_saphyr::to_string(&self.directory.path())?;
        let reply = self.run(&format!("name: ledger.init\narguments:\n  feature: {feature}\n  objective: Example feature\n  branch: codex/feature\n  worktree: {worktree}"))?;
        match reply {
            Reply::Ledger(info) => Ok(info),
            other @ (Reply::Features(_)
            | Reply::FrameworkInitialized { .. }
            | Reply::FrameworkInfo { .. }
            | Reply::Task(_)
            | Reply::TaskView(_)
            | Reply::Status { .. }
            | Reply::History(_)) => bail!("{other:?}"),
        }
    }
    fn create_task(&self) -> anyhow::Result<Reply> {
        self.run("name: task.create\narguments:\n  feature: feature\n  task: task\n  actor: gizmo\n  objective: Review code\n  acceptance: [Report findings]\n  dependencies: []\n  workspace: {kind: read_only}\n  progress:\n    summary: Waiting\n    findings: []\n    next_steps: [Review]\n    checks: []\n    extensions: {custom: [one, 2]}")
    }
    fn claim() -> &'static str {
        "name: task.claim\narguments: {feature: feature, task: task, expected_revision: 1, agent: worker, ttl_seconds: 600}"
    }
    fn heartbeat() -> &'static str {
        "name: task.update\narguments: {feature: feature, task: task, expected_revision: 2, agent: worker, attempt: 1, action: {kind: heartbeat, ttl_seconds: 600}}"
    }
    fn status(&self) -> anyhow::Result<Vec<TaskView>> {
        match self.run("name: ledger.status\narguments: {feature: feature}")? {
            Reply::Status { ledger, tasks } => {
                assert_eq!(ledger.storage_version, 2);
                Ok(tasks)
            }
            other @ (Reply::Features(_)
            | Reply::FrameworkInitialized { .. }
            | Reply::FrameworkInfo { .. }
            | Reply::Ledger(_)
            | Reply::Task(_)
            | Reply::TaskView(_)
            | Reply::History(_)) => {
                bail!("{other:?}")
            }
        }
    }
}

#[test]
fn concurrent_claims_history_and_feature_isolation() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let ledger = scenario.init("feature")?;
    assert_eq!(ledger.storage_version, 2);
    assert_eq!(scenario.init("feature")?.path, ledger.path);
    let other = scenario.init("other-feature")?;
    assert_ne!(ledger.path, other.path);
    match scenario.create_task()? {
        Reply::Task(task) => {
            assert_eq!(task.id, "task");
            assert!(matches!(task.state, State::Queued));
        }
        other @ (Reply::Features(_)
        | Reply::FrameworkInitialized { .. }
        | Reply::FrameworkInfo { .. }
        | Reply::Ledger(_)
        | Reply::TaskView(_)
        | Reply::Status { .. }
        | Reply::History(_)) => bail!("{other:?}"),
    }
    let first = scenario.start(Scenario::claim())?;
    let second = scenario.start(Scenario::claim())?;
    let results = [Scenario::collect(first)?, Scenario::collect(second)?];
    assert_eq!(
        results
            .iter()
            .filter(|r| matches!(r.result, Outcome::Success(_)))
            .count(),
        1,
        "{results:?}"
    );
    for result in results {
        match result.result {
            Outcome::Error(error) => assert_eq!(error.code, "conflict"),
            Outcome::Success(Reply::Task(task)) => {
                assert_eq!(task.revision, 2);
                assert_eq!(task.attempt, 1);
            }
            Outcome::Success(other) => bail!("{other:?}"),
        }
    }
    match scenario.run("name: task.get\narguments: {feature: feature, task: task}")? {
        Reply::TaskView(view) => assert_eq!(view.task.revision, 2),
        other @ (Reply::Features(_)
        | Reply::FrameworkInitialized { .. }
        | Reply::FrameworkInfo { .. }
        | Reply::Ledger(_)
        | Reply::Task(_)
        | Reply::Status { .. }
        | Reply::History(_)) => {
            bail!("{other:?}")
        }
    }
    let before = scenario.status()?.remove(0).task;
    scenario.run(Scenario::heartbeat())?;
    let after = scenario.status()?.remove(0);
    assert_eq!(after.task.revision, 3);
    assert_eq!(after.task.last_progress, before.last_progress);
    assert!(after.task.last_update >= before.last_update);
    assert_eq!(after.lease, "current");
    assert_eq!(scenario.failure(Scenario::heartbeat())?.code, "conflict");
    match scenario.run("name: task.history\narguments: {feature: feature, task: task}")? {
        Reply::History(events) => {
            assert_eq!(events.len(), 3);
            assert_eq!(events[0].kind, "created");
            assert_eq!(events[2].task.revision, 3);
        }
        other @ (Reply::Features(_)
        | Reply::FrameworkInitialized { .. }
        | Reply::FrameworkInfo { .. }
        | Reply::Ledger(_)
        | Reply::Task(_)
        | Reply::TaskView(_)
        | Reply::Status { .. }) => {
            bail!("{other:?}")
        }
    }
    assert_eq!(
        scenario
            .failure("name: task.get\narguments: {feature: other-feature, task: task}")?
            .code,
        "not_found"
    );
    assert!(scenario.git(&["status", "--porcelain"])?.is_empty());
    Ok(())
}

#[test]
fn requeue_rejects_old_worker_and_accepts_new_attempt() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    scenario.init("feature")?;
    scenario.create_task()?;
    scenario.run(Scenario::claim())?;
    scenario.run("name: task.coordinate\narguments: {feature: feature, task: task, expected_revision: 2, actor: gizmo, action: {kind: requeue, reason: Worker exited, previous_execution: stopped_or_finished}}")?;
    scenario.run(&Scenario::claim().replace("expected_revision: 1", "expected_revision: 3"))?;
    let stale = Scenario::heartbeat().replace("expected_revision: 2", "expected_revision: 4");
    assert_eq!(scenario.failure(&stale)?.code, "assignment_changed");
    let ready = "name: task.update\narguments:\n  feature: feature\n  task: task\n  expected_revision: 4\n  agent: worker\n  attempt: 2\n  action:\n    kind: ready\n    progress: {summary: Reviewed, findings: [No defects], next_steps: [], checks: []}";
    scenario.run(ready)?;
    let commit = scenario.git(&["rev-parse", "HEAD"])?;
    scenario.run(&format!("name: task.coordinate\narguments: {{feature: feature, task: task, expected_revision: 5, actor: integrator, action: {{kind: integrate, commit: '{commit}'}}}}"))?;
    assert!(matches!(
        scenario.status()?.remove(0).task.state,
        State::Integrated
    ));
    Ok(())
}

#[test]
fn linked_worktrees_share_feature_ledger_and_checkpoints() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let ledger = scenario.init("feature")?;
    let worker_dir = tempfile::tempdir()?;
    scenario.git(&[
        "worktree",
        "add",
        "-b",
        "codex/worker",
        worker_dir.path().to_str().context("path")?,
    ])?;
    let worker = Scenario {
        directory: worker_dir,
    };
    match worker.run("name: ledger.status\narguments: {feature: feature}")? {
        Reply::Status { ledger: found, .. } => assert_eq!(found.path, ledger.path),
        other @ (Reply::Features(_)
        | Reply::FrameworkInitialized { .. }
        | Reply::FrameworkInfo { .. }
        | Reply::Ledger(_)
        | Reply::Task(_)
        | Reply::TaskView(_)
        | Reply::History(_)) => {
            bail!("{other:?}")
        }
    }
    let path = serde_saphyr::to_string(&worker.directory.path())?;
    scenario.run(&format!("name: task.create\narguments:\n  feature: feature\n  task: task\n  actor: gizmo\n  objective: Add a file\n  acceptance: [File exists]\n  dependencies: []\n  workspace:\n    kind: git\n    branch: codex/worker\n    path: {path}  progress: {{summary: Waiting, findings: [], next_steps: [], checks: []}}"))?;
    worker.run(Scenario::claim())?;
    fs::write(worker.directory.path().join("result.txt"), "result\n")?;
    worker.git(&["add", "result.txt"])?;
    worker.git(&["commit", "-m", "checkpoint"])?;
    let commit = worker.git(&["rev-parse", "HEAD"])?;
    worker.run(&format!("name: task.update\narguments:\n  feature: feature\n  task: task\n  expected_revision: 2\n  agent: worker\n  attempt: 1\n  action:\n    kind: checkpoint\n    ttl_seconds: 600\n    commit: '{commit}'\n    progress: {{summary: File added, findings: [], next_steps: [Review], checks: []}}"))?;
    let ready = "name: task.update\narguments:\n  feature: feature\n  task: task\n  expected_revision: 3\n  agent: worker\n  attempt: 1\n  action:\n    kind: ready\n    progress: {summary: Ready, findings: [], next_steps: [], checks: []}";
    fs::write(worker.directory.path().join("unfinished.txt"), "unfinished")?;
    assert_eq!(worker.failure(ready)?.code, "invalid_request");
    fs::remove_file(worker.directory.path().join("unfinished.txt"))?;
    worker.run(ready)?;
    let integrate = format!(
        "name: task.coordinate\narguments: {{feature: feature, task: task, expected_revision: 4, actor: integrator, action: {{kind: integrate, commit: '{commit}'}}}}"
    );
    assert_eq!(scenario.failure(&integrate)?.code, "invalid_request");
    scenario.git(&["merge", "--ff-only", "codex/worker"])?;
    scenario.run(&integrate)?;
    assert_eq!(
        fs::read_to_string(scenario.directory.path().join("result.txt"))?,
        "result\n"
    );
    Ok(())
}

#[test]
fn discovery_examples_and_strict_input_errors() -> anyhow::Result<()> {
    #[derive(Deserialize)]
    struct Catalog {
        version: u32,
        commands: Vec<CommandDescription>,
    }
    #[derive(Deserialize)]
    struct CommandDescription {
        description: String,
    }
    let output = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
        .arg("list")
        .output()?;
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let catalog: Catalog = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
    assert_eq!(catalog.version, 1);
    assert_eq!(catalog.commands.len(), 11);
    assert!(catalog.commands.iter().all(|c| !c.description.is_empty()));
    let scenario = Scenario::create()?;
    for request in [
        "name: nope\narguments: {}",
        "name: task.claim\narguments: {feature: f, task: t, expected_revision: 0, agent: a, ttl_seconds: 1}",
        "name: ledger.status\narguments: {feature: f, typo: 1}",
        "name: ledger.status\narguments: {feature: f, feature: g}",
    ] {
        assert_eq!(scenario.failure(request)?.code, "invalid_request");
    }
    assert_eq!(
        scenario
            .failure("name: ledger.status\narguments: {feature: missing}")?
            .code,
        "not_found"
    );
    Ok(())
}

#[test]
fn progress_dependencies_cancellation_and_invalid_assignments() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    scenario.init("feature")?;
    scenario.create_task()?;
    assert_eq!(scenario.failure(Scenario::heartbeat())?.code, "conflict");
    scenario.run(Scenario::claim())?;
    let update = "name: task.update\narguments:\n  feature: feature\n  task: task\n  expected_revision: 2\n  agent: worker\n  attempt: 1\n  action:\n    kind: progress\n    ttl_seconds: 600\n    phase: {kind: blocked, reason: Waiting for input}\n    progress:\n      summary: Investigated\n      findings: [Need a decision]\n      next_steps: [Ask Gizmo]\n      checks: [{command: cargo test, outcome: not_run, evidence: Waiting}]\n      extensions: {details: {arbitrary: [1, true, null]}}";
    scenario.run(update)?;
    assert_eq!(
        scenario
            .failure(&Scenario::claim().replace("expected_revision: 1", "expected_revision: 3"))?
            .code,
        "invalid_state"
    );
    let dependent = "name: task.create\narguments:\n  feature: feature\n  task: dependent\n  actor: gizmo\n  objective: Follow up\n  acceptance: [Done]\n  dependencies: [task]\n  workspace: {kind: read_only}\n  progress: {summary: Waiting, findings: [], next_steps: [], checks: []}";
    scenario.run(dependent)?;
    assert_eq!(
        scenario
            .failure(&Scenario::claim().replace("task: task", "task: dependent"))?
            .code,
        "dependency_pending"
    );
    assert_eq!(scenario.failure(dependent)?.code, "conflict");
    assert_eq!(
        scenario
            .failure(
                &dependent
                    .replace("task: dependent", "task: self-reference")
                    .replace("dependencies: [task]", "dependencies: [self-reference]")
            )?
            .code,
        "invalid_request"
    );
    scenario.run("name: task.coordinate\narguments: {feature: feature, task: task, expected_revision: 3, actor: gizmo, action: {kind: cancel, reason: Scope removed}}")?;
    assert!(
        scenario
            .status()?
            .iter()
            .any(|view| matches!(view.task.state, State::Cancelled))
    );
    Ok(())
}

#[test]
fn rediscover_features_and_use_installer_through_yaml() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let Reply::Features(empty) = scenario.run("name: ledger.features\narguments: {}")? else {
        bail!("feature list")
    };
    assert!(empty.is_empty());
    let first = scenario.init("feature")?;
    scenario.init("another")?;
    let Reply::Features(features) = scenario.run("name: ledger.features\narguments: {}")? else {
        bail!("feature list")
    };
    assert_eq!(features.len(), 2);
    assert!(features.iter().any(|item| item.path == first.path));
    let Reply::FrameworkInitialized { project } =
        scenario.run("name: framework.init\narguments: {harness: none, instructions: skip}")?
    else {
        bail!("framework initialization")
    };
    assert_eq!(project, scenario.directory.path().canonicalize()?);
    let Reply::FrameworkInfo { paths } = scenario.run("name: framework.info\narguments: {}")?
    else {
        bail!("framework info")
    };
    assert_eq!(paths.project, project);
    assert!(paths.framework.join("AGENTS.md").is_file());
    for harness in ["codex", "claude", "cursor"] {
        scenario.run(&format!(
            "name: framework.init\narguments: {{harness: {harness}, instructions: write}}"
        ))?;
    }
    let request_file = scenario.directory.path().join("request.yaml");
    fs::write(
        &request_file,
        format!(
            "version: 1\nproject: {}operation:\n  name: ledger.status\n  arguments: {{feature: feature}}\n",
            serde_saphyr::to_string(&project)?
        ),
    )?;
    let output = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
        .args(["run", "--request"])
        .arg(&request_file)
        .output()?;
    assert!(output.status.success());
    let response: Response = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
    assert!(matches!(
        response.result,
        Outcome::Success(Reply::Status { .. })
    ));
    fs::write(
        &request_file,
        "version: 99\nproject: .\noperation: {name: framework.info, arguments: {}}",
    )?;
    let output = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
        .args(["run", "--request"])
        .arg(&request_file)
        .output()?;
    assert!(!output.status.success());
    let response: Response = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
    let Outcome::Error(error) = response.result else {
        bail!("version error")
    };
    assert!(error.message.contains("unsupported command version"));
    Ok(())
}
