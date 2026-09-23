use anyhow::{Context, bail};
use derive_more::From;
use meta_cortex_workbench::model::{Check, CheckOutcome, Phase, Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature,
    StoppedExecution, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    AgentId, Attempt, BranchName, CommitId, Extensions, FeatureId, LeaseSeconds, Note, Revision,
    TaskId,
};
use meta_cortex_workbench::versions::ProtocolVersion;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tempfile::TempDir;

// Independent CLI envelope; Workbench owns the shared domain arguments.
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    version: ProtocolVersion,
    project: PathBuf,
    operation: Operation,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
enum Operation {
    #[serde(rename = "ledger.features")]
    Features(EmptyArguments),
    #[serde(rename = "framework.init")]
    FrameworkInit(FrameworkInit),
    #[serde(rename = "framework.info")]
    FrameworkInfo(EmptyArguments),
    #[serde(rename = "ledger.init")]
    Initialize(InitFeature),
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
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct EmptyArguments {}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct FrameworkInit {
    harness: Harness,
    instructions: Instructions,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Harness {
    None,
    Codex,
    Claude,
    Cursor,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Instructions {
    Skip,
    Write,
}

#[derive(From)]
struct RequestYaml(String);

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
    progress: Progress,
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
    fn request(&self, operation: Operation) -> Request {
        Request {
            version: ProtocolVersion::CURRENT,
            project: self.directory.path().to_owned(),
            operation,
        }
    }
    fn start(&self, operation: Operation) -> anyhow::Result<Child> {
        Self::start_yaml(RequestYaml::from(serde_saphyr::to_string(
            &self.request(operation),
        )?))
    }
    fn start_yaml(request: RequestYaml) -> anyhow::Result<Child> {
        let RequestYaml(text) = request;
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
            .write_all(text.as_bytes())?;
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
        match &response.result {
            Outcome::Success(_) => assert_eq!(result.status.code(), Some(0), "{response:?}"),
            Outcome::Error(_) => assert_eq!(result.status.code(), Some(2), "{response:?}"),
        }
        Ok(response)
    }
    fn run(&self, operation: Operation) -> anyhow::Result<Reply> {
        match Self::collect(self.start(operation)?)?.result {
            Outcome::Success(reply) => Ok(reply),
            Outcome::Error(error) => bail!("{}: {}", error.code, error.message),
        }
    }
    fn failure(&self, operation: Operation) -> anyhow::Result<Failure> {
        match Self::collect(self.start(operation)?)?.result {
            Outcome::Success(reply) => bail!("unexpected success: {reply:?}"),
            Outcome::Error(error) => Ok(error),
        }
    }
    fn init(&self, feature: FeatureId) -> anyhow::Result<LedgerInfo> {
        let reply = self.run(Operation::Initialize(InitFeature {
            feature,
            objective: Note::try_from("Example feature".to_owned())?,
            branch: BranchName::try_from("codex/feature".to_owned())?,
            worktree: self.directory.path().to_owned(),
        }))?;
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
        self.run(Operation::Create(Self::task()?))
    }
    fn task() -> anyhow::Result<CreateTask> {
        Ok(CreateTask {
            feature: FeatureId::try_from("feature".to_owned())?,
            task: TaskId::try_from("task".to_owned())?,
            actor: AgentId::try_from("gizmo".to_owned())?,
            objective: Note::try_from("Review code".to_owned())?,
            acceptance: vec![Note::try_from("Report findings".to_owned())?],
            dependencies: Vec::new(),
            workspace: Workspace::ReadOnly,
            progress: Self::progress(Note::try_from("Waiting".to_owned())?),
        })
    }
    fn progress(summary: Note) -> Progress {
        Progress {
            summary,
            findings: Vec::new(),
            next_steps: Vec::new(),
            checks: Vec::new(),
            extensions: Extensions::default(),
        }
    }
    fn claim() -> anyhow::Result<ClaimTask> {
        Ok(ClaimTask {
            feature: FeatureId::try_from("feature".to_owned())?,
            task: TaskId::try_from("task".to_owned())?,
            expected_revision: Revision::INITIAL,
            agent: AgentId::try_from("worker".to_owned())?,
            ttl_seconds: LeaseSeconds::try_from(600)?,
        })
    }
    fn heartbeat() -> anyhow::Result<WorkerUpdate> {
        Ok(WorkerUpdate {
            feature: FeatureId::try_from("feature".to_owned())?,
            task: TaskId::try_from("task".to_owned())?,
            expected_revision: Revision::try_from(2)?,
            agent: AgentId::try_from("worker".to_owned())?,
            attempt: Attempt::try_from(1)?,
            action: WorkerAction::Heartbeat {
                ttl_seconds: LeaseSeconds::try_from(600)?,
            },
        })
    }
    fn coordinate(action: CoordinatorAction) -> anyhow::Result<CoordinatorUpdate> {
        Ok(CoordinatorUpdate {
            feature: FeatureId::try_from("feature".to_owned())?,
            task: TaskId::try_from("task".to_owned())?,
            expected_revision: Revision::try_from(2)?,
            actor: AgentId::try_from("gizmo".to_owned())?,
            action,
        })
    }
    fn query() -> anyhow::Result<TaskQuery> {
        Ok(TaskQuery {
            feature: FeatureId::try_from("feature".to_owned())?,
            task: TaskId::try_from("task".to_owned())?,
        })
    }
    fn feature() -> anyhow::Result<FeatureQuery> {
        Ok(FeatureQuery {
            feature: FeatureId::try_from("feature".to_owned())?,
        })
    }
    fn status(&self) -> anyhow::Result<Vec<TaskView>> {
        match self.run(Operation::Status(Self::feature()?))? {
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
    let ledger = scenario.init(FeatureId::try_from("feature".to_owned())?)?;
    assert_eq!(ledger.storage_version, 2);
    assert_eq!(
        scenario
            .init(FeatureId::try_from("feature".to_owned())?)?
            .path,
        ledger.path
    );
    let other = scenario.init(FeatureId::try_from("other-feature".to_owned())?)?;
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
    let first = scenario.start(Operation::Claim(Scenario::claim()?))?;
    let second = scenario.start(Operation::Claim(Scenario::claim()?))?;
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
    match scenario.run(Operation::Get(Scenario::query()?))? {
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
    scenario.run(Operation::Update(Scenario::heartbeat()?))?;
    let after = scenario.status()?.remove(0);
    assert_eq!(after.task.revision, 3);
    assert_eq!(after.task.last_progress, before.last_progress);
    assert!(after.task.last_update >= before.last_update);
    assert_eq!(after.lease, "current");
    assert_eq!(
        scenario
            .failure(Operation::Update(Scenario::heartbeat()?))?
            .code,
        "conflict"
    );
    match scenario.run(Operation::History(Scenario::query()?))? {
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
            .failure(Operation::Get(TaskQuery {
                feature: FeatureId::try_from("other-feature".to_owned())?,
                ..Scenario::query()?
            }))?
            .code,
        "not_found"
    );
    assert!(scenario.git(&["status", "--porcelain"])?.is_empty());
    Ok(())
}

#[test]
fn requeue_rejects_old_worker_and_accepts_new_attempt() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    scenario.init(FeatureId::try_from("feature".to_owned())?)?;
    scenario.create_task()?;
    scenario.run(Operation::Claim(Scenario::claim()?))?;
    scenario.run(Operation::Coordinate(Scenario::coordinate(
        CoordinatorAction::Requeue {
            reason: Note::try_from("Worker exited".to_owned())?,
            previous_execution: StoppedExecution::StoppedOrFinished,
        },
    )?))?;
    scenario.run(Operation::Claim(ClaimTask {
        expected_revision: Revision::try_from(3)?,
        ..Scenario::claim()?
    }))?;
    let stale = WorkerUpdate {
        expected_revision: Revision::try_from(4)?,
        ..Scenario::heartbeat()?
    };
    assert_eq!(
        scenario.failure(Operation::Update(stale))?.code,
        "assignment_changed"
    );
    scenario.run(Operation::Update(WorkerUpdate {
        expected_revision: Revision::try_from(4)?,
        attempt: Attempt::try_from(2)?,
        action: WorkerAction::Ready {
            progress: Scenario::progress(Note::try_from("Reviewed".to_owned())?),
        },
        ..Scenario::heartbeat()?
    }))?;
    let commit = CommitId::try_from(scenario.git(&["rev-parse", "HEAD"])?)?;
    scenario.run(Operation::Coordinate(CoordinatorUpdate {
        expected_revision: Revision::try_from(5)?,
        ..Scenario::coordinate(CoordinatorAction::Integrate { commit })?
    }))?;
    assert!(matches!(
        scenario.status()?.remove(0).task.state,
        State::Integrated
    ));
    Ok(())
}

#[test]
fn linked_worktrees_share_feature_ledger_and_checkpoints() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let ledger = scenario.init(FeatureId::try_from("feature".to_owned())?)?;
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
    match worker.run(Operation::Status(Scenario::feature()?))? {
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
    scenario.run(Operation::Create(CreateTask {
        workspace: Workspace::Git {
            branch: BranchName::try_from("codex/worker".to_owned())?,
            path: worker.directory.path().to_owned(),
        },
        ..Scenario::task()?
    }))?;
    worker.run(Operation::Claim(Scenario::claim()?))?;
    fs::write(worker.directory.path().join("result.txt"), "result\n")?;
    worker.git(&["add", "result.txt"])?;
    worker.git(&["commit", "-m", "checkpoint"])?;
    let commit = CommitId::try_from(worker.git(&["rev-parse", "HEAD"])?)?;
    worker.run(Operation::Update(WorkerUpdate {
        action: WorkerAction::Checkpoint {
            ttl_seconds: LeaseSeconds::try_from(600)?,
            commit: commit.clone(),
            progress: Scenario::progress(Note::try_from("File added".to_owned())?),
        },
        ..Scenario::heartbeat()?
    }))?;
    let ready = || -> anyhow::Result<Operation> {
        Ok(Operation::Update(WorkerUpdate {
            expected_revision: Revision::try_from(3)?,
            action: WorkerAction::Ready {
                progress: Scenario::progress(Note::try_from("Ready".to_owned())?),
            },
            ..Scenario::heartbeat()?
        }))
    };
    fs::write(worker.directory.path().join("unfinished.txt"), "unfinished")?;
    assert_eq!(worker.failure(ready()?)?.code, "invalid_request");
    fs::remove_file(worker.directory.path().join("unfinished.txt"))?;
    worker.run(ready()?)?;
    let integrate = || -> anyhow::Result<Operation> {
        Ok(Operation::Coordinate(CoordinatorUpdate {
            expected_revision: Revision::try_from(4)?,
            ..Scenario::coordinate(CoordinatorAction::Integrate {
                commit: commit.clone(),
            })?
        }))
    };
    assert_eq!(scenario.failure(integrate()?)?.code, "invalid_request");
    scenario.git(&["merge", "--ff-only", "codex/worker"])?;
    scenario.run(integrate()?)?;
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
        version: ProtocolVersion,
        invocation: InvocationGuide,
        transport: TransportGuide,
        commands: Vec<CommandDescription>,
    }
    #[derive(Debug, PartialEq, Deserialize, From)]
    #[serde(transparent)]
    struct InvocationGuide(String);
    #[derive(Debug, PartialEq, Deserialize, From)]
    #[serde(transparent)]
    struct TransportGuide(String);
    #[derive(Debug, PartialEq, Deserialize, From)]
    #[serde(transparent)]
    struct CommandSummary(String);
    #[derive(Deserialize)]
    struct CommandDescription {
        description: CommandSummary,
        example: Request,
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
    assert_eq!(catalog.version, ProtocolVersion::CURRENT);
    assert_eq!(
        catalog.invocation,
        InvocationGuide::from(
            "meta-cortex run --request request.yaml (or meta-cortex run --request - for stdin)"
                .to_owned()
        )
    );
    assert_eq!(
        catalog.transport,
        TransportGuide::from("One YAML request and response per process; local tool discovery/calls, no MCP server or JSON-RPC session. Exit 0: success; exit 2: structured error. Legacy init/info remain available; list/--help discover the CLI.".to_owned())
    );
    assert_eq!(catalog.commands.len(), 11);
    assert!(
        catalog
            .commands
            .iter()
            .all(|c| c.description != CommandSummary::from(String::new()))
    );
    for command in catalog.commands {
        assert_eq!(command.example.version, ProtocolVersion::CURRENT);
        assert_eq!(command.example.project, PathBuf::from("/absolute/project"));
    }
    let scenario = Scenario::create()?;
    for request in [
        "version: 1\nproject: .\noperation: {name: nope, arguments: {}}",
        "version: 1\nproject: .\noperation: {name: task.claim, arguments: {feature: f, task: t, expected_revision: 0, agent: a, ttl_seconds: 1}}",
        "version: 1\nproject: .\noperation: {name: ledger.status, arguments: {feature: f, typo: 1}}",
        "version: 1\nproject: .\noperation: {name: ledger.status, arguments: {feature: f, feature: g}}",
    ] {
        let response =
            Scenario::collect(Scenario::start_yaml(RequestYaml::from(request.to_owned()))?)?;
        let Outcome::Error(error) = response.result else {
            bail!("invalid request accepted")
        };
        assert_eq!(error.code, "invalid_request");
    }
    assert_eq!(
        scenario
            .failure(Operation::Status(FeatureQuery {
                feature: FeatureId::try_from("missing".to_owned())?
            }))?
            .code,
        "not_found"
    );
    Ok(())
}

#[test]
fn progress_dependencies_cancellation_and_invalid_assignments() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    scenario.init(FeatureId::try_from("feature".to_owned())?)?;
    scenario.create_task()?;
    assert_eq!(
        scenario
            .failure(Operation::Update(Scenario::heartbeat()?))?
            .code,
        "conflict"
    );
    scenario.run(Operation::Claim(Scenario::claim()?))?;
    let mut progress = Scenario::progress(Note::try_from(
        "Investigated: \"quotes\"\nNext line — details".to_owned(),
    )?);
    progress.findings = vec![Note::try_from("Need a decision".to_owned())?];
    progress.next_steps = vec![Note::try_from("Ask Gizmo".to_owned())?];
    progress.checks = vec![Check {
        command: Note::try_from("cargo test".to_owned())?,
        outcome: CheckOutcome::NotRun,
        evidence: Note::try_from("Waiting".to_owned())?,
    }];
    // Extensions are the explicitly open, task-specific portion of this schema.
    let Extensions(entries) = &mut progress.extensions;
    entries.insert(
        "details".to_owned(),
        serde_json::json!({"arbitrary": [1, true, null]}),
    );
    scenario.run(Operation::Update(WorkerUpdate {
        action: WorkerAction::Progress {
            ttl_seconds: LeaseSeconds::try_from(600)?,
            phase: Phase::Blocked {
                reason: Note::try_from("Waiting for input".to_owned())?,
            },
            progress: progress.clone(),
        },
        ..Scenario::heartbeat()?
    }))?;
    let Reply::TaskView(view) = scenario.run(Operation::Get(Scenario::query()?))? else {
        bail!("task view")
    };
    assert_eq!(view.task.progress, progress);
    assert_eq!(
        scenario
            .failure(Operation::Claim(ClaimTask {
                expected_revision: Revision::try_from(3)?,
                ..Scenario::claim()?
            }))?
            .code,
        "invalid_state"
    );
    let dependent = || -> anyhow::Result<CreateTask> {
        Ok(CreateTask {
            task: TaskId::try_from("dependent".to_owned())?,
            dependencies: vec![TaskId::try_from("task".to_owned())?],
            ..Scenario::task()?
        })
    };
    scenario.run(Operation::Create(dependent()?))?;
    assert_eq!(
        scenario
            .failure(Operation::Claim(ClaimTask {
                task: TaskId::try_from("dependent".to_owned())?,
                ..Scenario::claim()?
            }))?
            .code,
        "dependency_pending"
    );
    assert_eq!(
        scenario.failure(Operation::Create(dependent()?))?.code,
        "conflict"
    );
    assert_eq!(
        scenario
            .failure(Operation::Create(CreateTask {
                task: TaskId::try_from("self-reference".to_owned())?,
                dependencies: vec![TaskId::try_from("self-reference".to_owned())?],
                ..Scenario::task()?
            }))?
            .code,
        "invalid_request"
    );
    scenario.run(Operation::Coordinate(CoordinatorUpdate {
        expected_revision: Revision::try_from(3)?,
        ..Scenario::coordinate(CoordinatorAction::Cancel {
            reason: Note::try_from("Scope removed".to_owned())?,
        })?
    }))?;
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
    let Reply::Features(empty) = scenario.run(Operation::Features(EmptyArguments {}))? else {
        bail!("feature list")
    };
    assert!(empty.is_empty());
    let first = scenario.init(FeatureId::try_from("feature".to_owned())?)?;
    scenario.init(FeatureId::try_from("another".to_owned())?)?;
    let Reply::Features(features) = scenario.run(Operation::Features(EmptyArguments {}))? else {
        bail!("feature list")
    };
    assert_eq!(features.len(), 2);
    assert!(features.iter().any(|item| item.path == first.path));
    let Reply::FrameworkInitialized { project } =
        scenario.run(Operation::FrameworkInit(FrameworkInit {
            harness: Harness::None,
            instructions: Instructions::Skip,
        }))?
    else {
        bail!("framework initialization")
    };
    assert_eq!(project, scenario.directory.path().canonicalize()?);
    let Reply::FrameworkInfo { paths } =
        scenario.run(Operation::FrameworkInfo(EmptyArguments {}))?
    else {
        bail!("framework info")
    };
    assert_eq!(paths.project, project);
    assert!(paths.framework.join("AGENTS.md").is_file());
    for harness in [Harness::Codex, Harness::Claude, Harness::Cursor] {
        scenario.run(Operation::FrameworkInit(FrameworkInit {
            harness,
            instructions: Instructions::Write,
        }))?;
    }
    let request_file = scenario.directory.path().join("request.yaml");
    fs::write(
        &request_file,
        serde_saphyr::to_string(&scenario.request(Operation::Status(Scenario::feature()?)))?,
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
