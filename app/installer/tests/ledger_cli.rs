use anyhow::{Context, bail};
use derive_more::From;
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::{Assignment, Check, CheckOutcome, Phase, Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature,
    StoppedExecution, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    Attempt, BranchNameParse, CommitId, CommitIdParse, Extensions, FeatureId, FeatureIdParse,
    LeaseSeconds, Note, Revision, TaskIdParse,
};
use meta_cortex_workbench::versions::{ProtocolVersion, StorageVersion};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
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
#[serde(tag = "group", content = "command", deny_unknown_fields)]
enum Operation {
    Framework(FrameworkOperation),
    Feature(FeatureOperation),
    Task(TaskOperation),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
enum FrameworkOperation {
    Initialize(FrameworkInit),
    Info(EmptyArguments),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
enum FeatureOperation {
    Initialize(InitFeature),
    List(EmptyArguments),
    Status(FeatureQuery),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
enum TaskOperation {
    Create(CreateTask),
    Get(TaskQuery),
    History(TaskQuery),
    Claim(ClaimTask),
    Update(WorkerUpdate),
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
    version: ProtocolVersion,
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
    storage_version: StorageVersion,
}
#[derive(Debug, Deserialize)]
struct Task {
    id: String,
    revision: Revision,
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
    Active { assignment: Assignment },
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
    actor: AgentId,
    kind: String,
    note: Note,
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
        let mut options = git2::RepositoryInitOptions::new();
        options.initial_head("codex/feature");
        let repository = git2::Repository::init_opts(scenario.directory.path(), &options)?;
        let signature = git2::Signature::now("Ledger Test", "ledger@example.invalid")?;
        let tree_id = repository.index()?.write_tree()?;
        let tree = repository.find_tree(tree_id)?;
        repository.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])?;
        Ok(scenario)
    }
    fn repository(&self) -> anyhow::Result<git2::Repository> {
        Ok(git2::Repository::open(self.directory.path())?)
    }
    fn head(&self) -> anyhow::Result<CommitId> {
        let oid = self.repository()?.head()?.peel_to_commit()?.id();
        match CommitIdParse::from(oid.to_string()) {
            CommitIdParse::Parsed(value) => Ok(value),
            CommitIdParse::Invalid(error) => Err(error.into()),
        }
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
        assert_eq!(response.version, ProtocolVersion::V1);
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
        let reply = self.run(Operation::Feature(FeatureOperation::Initialize(
            InitFeature {
                feature,
                objective: Note::from("Example feature".to_owned()),
                branch: match BranchNameParse::from("codex/feature".to_owned()) {
                    BranchNameParse::Parsed(value) => value,
                    BranchNameParse::Invalid(error) => return Err(error.into()),
                },
                worktree: self.directory.path().to_owned(),
            },
        )))?;
        let Reply::Ledger(info) = reply else {
            bail!("unexpected initialization reply: {reply:?}");
        };
        Ok(info)
    }

    fn create_task(&self) -> anyhow::Result<Reply> {
        self.run(Operation::Task(TaskOperation::Create(Self::task()?)))
    }
    fn task() -> anyhow::Result<CreateTask> {
        let TaskQuery { feature, task } = Self::query()?;
        Ok(CreateTask {
            feature,
            task,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            objective: Note::from("Review code".to_owned()),
            acceptance: vec![Note::from("Report findings".to_owned())],
            dependencies: Vec::new(),
            workspace: Workspace::ReadOnly,
            progress: Self::progress(Note::from("Waiting".to_owned())),
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
        let TaskQuery { feature, task } = Self::query()?;
        Ok(ClaimTask {
            feature,
            task,
            expected_revision: Revision::INITIAL,
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
        })
    }
    fn heartbeat() -> anyhow::Result<WorkerUpdate> {
        let TaskQuery { feature, task } = Self::query()?;
        Ok(WorkerUpdate {
            feature,
            task,
            expected_revision: Revision::INITIAL.advance()?,
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            attempt: Attempt::UNCLAIMED.advance()?,
            action: WorkerAction::Heartbeat {
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
            },
        })
    }
    fn coordinate(action: CoordinatorAction) -> anyhow::Result<CoordinatorUpdate> {
        let TaskQuery { feature, task } = Self::query()?;
        Ok(CoordinatorUpdate {
            feature,
            task,
            expected_revision: Revision::INITIAL.advance()?,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            action,
        })
    }
    fn query() -> anyhow::Result<TaskQuery> {
        Ok(TaskQuery {
            feature: Scenario::feature()?.feature,
            task: match TaskIdParse::from("task".to_owned()) {
                TaskIdParse::Parsed(value) => value,
                TaskIdParse::Invalid(error) => return Err(error.into()),
            },
        })
    }
    fn feature() -> anyhow::Result<FeatureQuery> {
        Ok(FeatureQuery {
            feature: match FeatureIdParse::from("feature".to_owned()) {
                FeatureIdParse::Parsed(value) => value,
                FeatureIdParse::Invalid(error) => return Err(error.into()),
            },
        })
    }
    fn status(&self) -> anyhow::Result<Vec<TaskView>> {
        let reply = self.run(Operation::Feature(FeatureOperation::Status(
            Self::feature()?
        )))?;
        let Reply::Status { ledger, tasks } = reply else {
            bail!("unexpected status reply: {reply:?}");
        };
        assert_eq!(ledger.storage_version, StorageVersion::IndexedV2);
        Ok(tasks)
    }
}

#[test]
fn concurrent_claims_history_and_feature_isolation() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let ledger = scenario.init(Scenario::feature()?.feature)?;
    assert_eq!(ledger.storage_version, StorageVersion::IndexedV2);
    assert_eq!(
        scenario.init(Scenario::feature()?.feature)?.path,
        ledger.path
    );
    let other = scenario.init(match FeatureIdParse::from("other-feature".to_owned()) {
        FeatureIdParse::Parsed(value) => value,
        FeatureIdParse::Invalid(error) => return Err(error.into()),
    })?;
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
    let first = scenario.start(Operation::Task(TaskOperation::Claim(Scenario::claim()?)))?;
    let second = scenario.start(Operation::Task(TaskOperation::Claim(Scenario::claim()?)))?;
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
                assert_eq!(task.revision, Revision::INITIAL.advance()?);
                assert_eq!(task.attempt, 1);
                let State::Active { assignment } = task.state else {
                    bail!("claimed task must retain its active assignment")
                };
                assert_eq!(
                    assignment.agent,
                    AgentId::Development(DevelopmentAgent::RustDev)
                );
            }
            Outcome::Success(other) => bail!("{other:?}"),
        }
    }
    match scenario.run(Operation::Task(TaskOperation::Get(Scenario::query()?)))? {
        Reply::TaskView(view) => assert_eq!(view.task.revision, Revision::INITIAL.advance()?),
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
    scenario.run(Operation::Task(TaskOperation::Update(
        Scenario::heartbeat()?
    )))?;
    let after = scenario.status()?.remove(0);
    assert_eq!(after.task.revision, before.revision.advance()?);
    assert_eq!(after.task.last_progress, before.last_progress);
    assert!(after.task.last_update >= before.last_update);
    assert_eq!(after.lease, "current");
    assert_eq!(
        scenario
            .failure(Operation::Task(TaskOperation::Update(
                Scenario::heartbeat()?
            )))?
            .code,
        "conflict"
    );
    match scenario.run(Operation::Task(TaskOperation::History(Scenario::query()?)))? {
        Reply::History(events) => {
            assert_eq!(events.len(), 3);
            assert_eq!(events[0].kind, "created");
            assert_eq!(events[0].actor, AgentId::Gizmo(GizmoAgent::Gizmo));
            assert_eq!(
                events[1].actor,
                AgentId::Development(DevelopmentAgent::RustDev)
            );
            assert_eq!(
                events[2].actor,
                AgentId::Development(DevelopmentAgent::RustDev)
            );
            assert_eq!(events[2].task.revision, after.task.revision);
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
            .failure(Operation::Task(TaskOperation::Get(TaskQuery {
                feature: match FeatureIdParse::from("other-feature".to_owned()) {
                    FeatureIdParse::Parsed(value) => value,
                    FeatureIdParse::Invalid(error) => return Err(error.into()),
                },
                ..Scenario::query()?
            })))?
            .code,
        "not_found"
    );
    assert!(scenario.repository()?.statuses(None)?.is_empty());
    Ok(())
}

#[test]
fn requeue_rejects_old_worker_and_accepts_new_attempt() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    scenario.init(Scenario::feature()?.feature)?;
    scenario.create_task()?;
    scenario.run(Operation::Task(TaskOperation::Claim(Scenario::claim()?)))?;
    scenario.run(Operation::Task(TaskOperation::Coordinate(
        Scenario::coordinate(CoordinatorAction::Requeue {
            reason: Note::from("Worker exited".to_owned()),
            previous_execution: StoppedExecution::StoppedOrFinished,
        })?,
    )))?;
    let requeued_revision = scenario.status()?.remove(0).task.revision;
    scenario.run(Operation::Task(TaskOperation::Claim(ClaimTask {
        expected_revision: requeued_revision,
        ..Scenario::claim()?
    })))?;
    let reclaimed_revision = scenario.status()?.remove(0).task.revision;
    let stale = WorkerUpdate {
        expected_revision: reclaimed_revision,
        ..Scenario::heartbeat()?
    };
    assert_eq!(
        scenario
            .failure(Operation::Task(TaskOperation::Update(stale)))?
            .code,
        "assignment_changed"
    );
    scenario.run(Operation::Task(TaskOperation::Update(WorkerUpdate {
        expected_revision: reclaimed_revision,
        attempt: Attempt::UNCLAIMED.advance()?.advance()?,
        action: WorkerAction::Ready {
            progress: Scenario::progress(Note::from("Reviewed".to_owned())),
        },
        ..Scenario::heartbeat()?
    })))?;
    let ready_revision = scenario.status()?.remove(0).task.revision;
    let commit = scenario.head()?;
    scenario.run(Operation::Task(TaskOperation::Coordinate(
        CoordinatorUpdate {
            expected_revision: ready_revision,
            ..Scenario::coordinate(CoordinatorAction::Integrate { commit })?
        },
    )))?;
    assert!(matches!(
        scenario.status()?.remove(0).task.state,
        State::Integrated
    ));
    Ok(())
}

#[test]
fn linked_worktrees_share_feature_ledger_and_checkpoints() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let ledger = scenario.init(Scenario::feature()?.feature)?;
    let worker_dir = tempfile::tempdir()?;
    // libgit2 creates the worktree directory itself.
    fs::remove_dir(worker_dir.path())?;
    let repository = scenario.repository()?;
    let base = repository.head()?.peel_to_commit()?;
    let branch = repository.branch("codex/worker", &base, false)?;
    let mut options = git2::WorktreeAddOptions::new();
    options.reference(Some(branch.get()));
    repository.worktree("worker", worker_dir.path(), Some(&options))?;
    let worker = Scenario {
        directory: worker_dir,
    };
    match worker.run(Operation::Feature(FeatureOperation::Status(
        Scenario::feature()?,
    )))? {
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
    scenario.run(Operation::Task(TaskOperation::Create(CreateTask {
        workspace: Workspace::Git {
            branch: match BranchNameParse::from("codex/worker".to_owned()) {
                BranchNameParse::Parsed(value) => value,
                BranchNameParse::Invalid(error) => return Err(error.into()),
            },
            path: worker.directory.path().to_owned(),
        },
        ..Scenario::task()?
    })))?;
    worker.run(Operation::Task(TaskOperation::Claim(Scenario::claim()?)))?;
    fs::write(worker.directory.path().join("result.txt"), "result\n")?;
    let worker_repository = worker.repository()?;
    let mut index = worker_repository.index()?;
    index.add_path(Path::new("result.txt"))?;
    index.write()?;
    let tree_id = index.write_tree()?;
    let tree = worker_repository.find_tree(tree_id)?;
    let parent = worker_repository.head()?.peel_to_commit()?;
    let signature = git2::Signature::now("Ledger Test", "ledger@example.invalid")?;
    worker_repository.commit(
        Some("HEAD"),
        &signature,
        &signature,
        "checkpoint",
        &tree,
        &[&parent],
    )?;
    let commit = worker.head()?;
    worker.run(Operation::Task(TaskOperation::Update(WorkerUpdate {
        action: WorkerAction::Checkpoint {
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
            commit: commit.clone(),
            progress: Scenario::progress(Note::from("File added".to_owned())),
        },
        ..Scenario::heartbeat()?
    })))?;
    let checkpoint_revision = worker.status()?.remove(0).task.revision;
    let ready = || -> anyhow::Result<Operation> {
        Ok(Operation::Task(TaskOperation::Update(WorkerUpdate {
            expected_revision: checkpoint_revision,
            action: WorkerAction::Ready {
                progress: Scenario::progress(Note::from("Ready".to_owned())),
            },
            ..Scenario::heartbeat()?
        })))
    };
    fs::write(worker.directory.path().join("unfinished.txt"), "unfinished")?;
    assert_eq!(worker.failure(ready()?)?.code, "invalid_request");
    fs::remove_file(worker.directory.path().join("unfinished.txt"))?;
    worker.run(ready()?)?;
    let ready_revision = worker.status()?.remove(0).task.revision;
    let integrate = || -> anyhow::Result<Operation> {
        Ok(Operation::Task(TaskOperation::Coordinate(
            CoordinatorUpdate {
                expected_revision: ready_revision,
                ..Scenario::coordinate(CoordinatorAction::Integrate {
                    commit: commit.clone(),
                })?
            },
        )))
    };
    assert_eq!(scenario.failure(integrate()?)?.code, "invalid_request");
    let target = repository.find_commit(worker_repository.head()?.peel_to_commit()?.id())?;
    assert!(repository.graph_descendant_of(target.id(), base.id())?);
    repository.checkout_tree(target.as_object(), None)?;
    repository
        .head()?
        .set_target(target.id(), "fast-forward test feature")?;
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
        commands: CommandGroups,
    }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct CommandGroups {
        framework: Vec<CommandDescription>,
        feature: Vec<CommandDescription>,
        task: Vec<CommandDescription>,
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
        TransportGuide::from("One YAML request and response per process; local tool discovery/calls, no MCP server or JSON-RPC session. Exit 0: success; exit 2: structured error. list/--help discover the CLI.".to_owned())
    );
    let CommandGroups {
        framework,
        feature,
        task,
    } = catalog.commands;
    assert_eq!([framework.len(), feature.len(), task.len()], [2, 3, 6]);
    for command in &framework {
        assert!(matches!(command.example.operation, Operation::Framework(_)));
    }
    for command in &feature {
        assert!(matches!(command.example.operation, Operation::Feature(_)));
    }
    for command in &task {
        assert!(matches!(command.example.operation, Operation::Task(_)));
    }
    for command in framework.into_iter().chain(feature).chain(task) {
        assert_ne!(command.description, CommandSummary::from(String::new()));
        assert_eq!(command.example.version, ProtocolVersion::CURRENT);
        assert_eq!(command.example.project, PathBuf::from("/absolute/project"));
    }
    let scenario = Scenario::create()?;
    for request in [
        "version: 1\nproject: .\noperation: {name: nope, arguments: {}}",
        // A known leaf under the wrong group must not dispatch.
        "version: 1\nproject: .\noperation: {group: Framework, command: {name: Claim, arguments: {feature: f, task: t, expected_revision: 1, agent: {team: Development, role: RustDev}, ttl_seconds: 600}}}",
        "version: 1\nproject: .\noperation: {group: Task, command: {name: List, arguments: {}}}",
        "version: 1\nproject: .\noperation: {group: Unknown, command: {name: List, arguments: {}}}",
        "version: 1\nproject: .\noperation: {group: Feature, command: {name: List, arguments: {}, typo: 1}}",
        "version: 1\nproject: .\noperation: {group: Feature, command: {name: List, arguments: {}}, typo: 1}",
        // Superseded aliases and automatic casing are not command identities.
        "version: 1\nproject: .\noperation: {name: framework.info, arguments: {}}",
        "version: 1\nproject: .\noperation: {name: get_framework_info, arguments: {}}",
        "version: 1\nproject: .\noperation: {name: ledger.features, arguments: {}}",
        "version: 1\nproject: .\noperation: {group: Task, command: {name: Claim, arguments: {feature: f, task: t, expected_revision: 1, agent: worker, ttl_seconds: 600}}}",
        "version: 1\nproject: .\noperation: {group: Task, command: {name: Claim, arguments: {feature: f, task: t, expected_revision: 1, agent: {team: Sre, role: RustDev}, ttl_seconds: 600}}}",
        "version: 1\nproject: .\noperation: {group: Task, command: {name: Claim, arguments: {feature: f, task: t, expected_revision: 0, agent: {team: Development, role: RustDev}, ttl_seconds: 1}}}",
        "version: 1\nproject: .\noperation: {group: Feature, command: {name: Status, arguments: {feature: f, typo: 1}}}",
        "version: 1\nproject: .\noperation: {group: Feature, command: {name: Status, arguments: {feature: f, feature: g}}}",
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
            .failure(Operation::Feature(FeatureOperation::Status(FeatureQuery {
                feature: match FeatureIdParse::from("missing".to_owned()) {
                    FeatureIdParse::Parsed(value) => value,
                    FeatureIdParse::Invalid(error) => return Err(error.into()),
                }
            })))?
            .code,
        "not_found"
    );
    Ok(())
}

#[test]
fn progress_dependencies_cancellation_and_invalid_assignments() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    scenario.init(Scenario::feature()?.feature)?;
    scenario.create_task()?;
    assert_eq!(
        scenario
            .failure(Operation::Task(TaskOperation::Update(
                Scenario::heartbeat()?
            )))?
            .code,
        "conflict"
    );
    scenario.run(Operation::Task(TaskOperation::Claim(Scenario::claim()?)))?;
    let mut progress = Scenario::progress(Note::from(
        "Investigated: \"quotes\"\nNext line — details".to_owned(),
    ));
    progress.findings = vec![Note::from("Need a decision".to_owned())];
    progress.next_steps = vec![Note::from("Ask Gizmo".to_owned())];
    progress.checks = vec![Check {
        command: Note::from("cargo test".to_owned()),
        outcome: CheckOutcome::NotRun,
        evidence: Note::from("Waiting".to_owned()),
    }];
    // Extensions are the explicitly open, task-specific portion of this schema.
    let Extensions(entries) = &mut progress.extensions;
    entries.insert(
        "details".to_owned(),
        serde_json::json!({"arbitrary": [1, true, null]}),
    );
    scenario.run(Operation::Task(TaskOperation::Update(WorkerUpdate {
        action: WorkerAction::Progress {
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
            phase: Phase::Blocked {
                reason: Note::from("Waiting for input".to_owned()),
            },
            progress: progress.clone(),
        },
        ..Scenario::heartbeat()?
    })))?;
    let Reply::TaskView(view) =
        scenario.run(Operation::Task(TaskOperation::Get(Scenario::query()?)))?
    else {
        bail!("task view")
    };
    assert_eq!(view.task.progress, progress);
    assert_eq!(
        scenario
            .failure(Operation::Task(TaskOperation::Claim(ClaimTask {
                expected_revision: view.task.revision,
                ..Scenario::claim()?
            })))?
            .code,
        "invalid_state"
    );
    let dependent = || -> anyhow::Result<CreateTask> {
        Ok(CreateTask {
            task: match TaskIdParse::from("dependent".to_owned()) {
                TaskIdParse::Parsed(value) => value,
                TaskIdParse::Invalid(error) => return Err(error.into()),
            },
            dependencies: vec![match TaskIdParse::from("task".to_owned()) {
                TaskIdParse::Parsed(value) => value,
                TaskIdParse::Invalid(error) => return Err(error.into()),
            }],
            ..Scenario::task()?
        })
    };
    scenario.run(Operation::Task(TaskOperation::Create(dependent()?)))?;
    assert_eq!(
        scenario
            .failure(Operation::Task(TaskOperation::Claim(ClaimTask {
                task: match TaskIdParse::from("dependent".to_owned()) {
                    TaskIdParse::Parsed(value) => value,
                    TaskIdParse::Invalid(error) => return Err(error.into()),
                },
                ..Scenario::claim()?
            })))?
            .code,
        "dependency_pending"
    );
    assert_eq!(
        scenario
            .failure(Operation::Task(TaskOperation::Create(dependent()?)))?
            .code,
        "conflict"
    );
    assert_eq!(
        scenario
            .failure(Operation::Task(TaskOperation::Create(CreateTask {
                task: match TaskIdParse::from("self-reference".to_owned()) {
                    TaskIdParse::Parsed(value) => value,
                    TaskIdParse::Invalid(error) => return Err(error.into()),
                },
                dependencies: vec![match TaskIdParse::from("self-reference".to_owned()) {
                    TaskIdParse::Parsed(value) => value,
                    TaskIdParse::Invalid(error) => return Err(error.into()),
                }],
                ..Scenario::task()?
            })))?
            .code,
        "invalid_request"
    );
    scenario.run(Operation::Task(TaskOperation::Coordinate(
        CoordinatorUpdate {
            expected_revision: view.task.revision,
            ..Scenario::coordinate(CoordinatorAction::Cancel {
                reason: Note::from("Scope removed".to_owned()),
            })?
        },
    )))?;
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
    let Reply::Features(empty) = scenario.run(Operation::Feature(FeatureOperation::List(
        EmptyArguments {},
    )))?
    else {
        bail!("feature list")
    };
    assert!(empty.is_empty());
    let first = scenario.init(Scenario::feature()?.feature)?;
    scenario.init(match FeatureIdParse::from("another".to_owned()) {
        FeatureIdParse::Parsed(value) => value,
        FeatureIdParse::Invalid(error) => return Err(error.into()),
    })?;
    let Reply::Features(features) = scenario.run(Operation::Feature(FeatureOperation::List(
        EmptyArguments {},
    )))?
    else {
        bail!("feature list")
    };
    assert_eq!(features.len(), 2);
    assert!(features.iter().any(|item| item.path == first.path));
    let Reply::FrameworkInitialized { project } = scenario.run(Operation::Framework(
        FrameworkOperation::Initialize(FrameworkInit {
            harness: Harness::None,
            instructions: Instructions::Skip,
        }),
    ))?
    else {
        bail!("framework initialization")
    };
    assert_eq!(project, scenario.directory.path().canonicalize()?);
    let Reply::FrameworkInfo { paths } = scenario.run(Operation::Framework(
        FrameworkOperation::Info(EmptyArguments {}),
    ))?
    else {
        bail!("framework info")
    };
    assert_eq!(paths.project, project);
    assert!(paths.framework.join("AGENTS.md").is_file());
    for harness in [Harness::Codex, Harness::Claude, Harness::Cursor] {
        scenario.run(Operation::Framework(FrameworkOperation::Initialize(
            FrameworkInit {
                harness,
                instructions: Instructions::Write,
            },
        )))?;
    }
    let request_file = scenario.directory.path().join("request.yaml");
    fs::write(
        &request_file,
        serde_saphyr::to_string(
            &scenario.request(Operation::Feature(FeatureOperation::Status(
                Scenario::feature()?,
            ))),
        )?,
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
        "version: 99\nproject: .\noperation: {group: Framework, command: {name: Info, arguments: {}}}",
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

#[test]
fn empty_notes_survive_cli_storage_and_history() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    scenario.run(Operation::Feature(FeatureOperation::Initialize(
        InitFeature {
            objective: Note::Empty,
            feature: Scenario::feature()?.feature,
            branch: match BranchNameParse::from("codex/feature".to_owned()) {
                BranchNameParse::Parsed(value) => value,
                BranchNameParse::Invalid(error) => return Err(error.into()),
            },
            worktree: scenario.directory.path().to_owned(),
        },
    )))?;
    let empty_progress = Scenario::progress(Note::Empty);
    scenario.run(Operation::Task(TaskOperation::Create(CreateTask {
        objective: Note::Empty,
        acceptance: vec![Note::Empty],
        progress: empty_progress.clone(),
        ..Scenario::task()?
    })))?;
    scenario.run(Operation::Task(TaskOperation::Claim(Scenario::claim()?)))?;
    scenario.run(Operation::Task(TaskOperation::Update(WorkerUpdate {
        action: WorkerAction::Progress {
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
            phase: Phase::Blocked {
                reason: Note::Empty,
            },
            progress: empty_progress.clone(),
        },
        ..Scenario::heartbeat()?
    })))?;
    let task = scenario.status()?.remove(0).task;
    assert_eq!(task.progress, empty_progress);
    scenario.run(Operation::Task(TaskOperation::Coordinate(
        CoordinatorUpdate {
            expected_revision: task.revision,
            ..Scenario::coordinate(CoordinatorAction::Cancel {
                reason: Note::Empty,
            })?
        },
    )))?;
    let Reply::History(events) =
        scenario.run(Operation::Task(TaskOperation::History(Scenario::query()?)))?
    else {
        bail!("history")
    };
    let cancelled = events.last().context("cancelled event")?;
    assert_eq!(cancelled.note, Note::Empty);
    assert_eq!(cancelled.task.progress, empty_progress);
    assert!(matches!(cancelled.task.state, State::Cancelled));
    Ok(())
}
