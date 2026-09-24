#[path = "ledger_cli/scenario.rs"]
mod scenario;
use scenario::{Cli, Examples, Scenario};

use anyhow::{Context, bail};
use derive_more::From;
use git2::StatusOptions;
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::{
    Assignment, Check, CheckOutcome, EventKind, LeaseHealth, Phase, Progress, Workspace,
};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature,
    StoppedExecution, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    Attempt, BranchName, Extensions, FeatureId, LeaseSeconds, Note, Revision, TaskId, Timestamp,
};
use meta_cortex_workbench::versions::{ProtocolVersion, StorageVersion};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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
    bun: BunSetup,
}
#[derive(Debug, Serialize, Deserialize)]
enum BunSetup {
    InstallMissing,
    RequireExisting,
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
    id: TaskId,
    revision: Revision,
    attempt: Attempt,
    state: State,
    last_update: Timestamp,
    last_progress: Timestamp,
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
    lease: LeaseHealth,
}
#[derive(Debug, Deserialize)]
struct Event {
    actor: AgentId,
    kind: EventKind,
    note: Note,
    task: Task,
}

#[test]
fn concurrent_claims_history_and_feature_isolation() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let reopen = scenario.initialization(Examples::feature()?.feature)?;
    let other = scenario.initialization(FeatureId::try_from("other-feature".to_owned())?)?;
    let scenario = scenario.initialize(Examples::feature()?.feature)?;
    assert_eq!(scenario.ledger().storage_version, StorageVersion::IndexedV2);
    let Reply::Ledger(reopened) = scenario
        .client()
        .run(Operation::Feature(FeatureOperation::Initialize(reopen)))?
    else {
        bail!("reopened ledger")
    };
    assert_eq!(reopened.path, scenario.ledger().path);
    let Reply::Ledger(other) = scenario
        .client()
        .run(Operation::Feature(FeatureOperation::Initialize(other)))?
    else {
        bail!("other ledger")
    };
    assert_ne!(scenario.ledger().path, other.path);
    let scenario = scenario.create_task(Examples::task()?)?;
    assert_eq!(scenario.created_task().id, Examples::query()?.task);
    assert!(matches!(scenario.created_task().state, State::Queued));
    let first = scenario
        .client()
        .start(Operation::Task(TaskOperation::Claim(Examples::claim()?)))?;
    let second = scenario
        .client()
        .start(Operation::Task(TaskOperation::Claim(Examples::claim()?)))?;
    let results = [Cli::collect(first)?, Cli::collect(second)?];
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
                assert_eq!(task.attempt, Attempt::UNCLAIMED.advance()?);
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
    match scenario
        .client()
        .run(Operation::Task(TaskOperation::Get(Examples::query()?)))?
    {
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
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Update(
            Examples::heartbeat()?
        )))?;
    let after = scenario.status()?.remove(0);
    assert_eq!(after.task.revision, before.revision.advance()?);
    assert_eq!(after.task.last_progress, before.last_progress);
    assert!(after.task.last_update >= before.last_update);
    assert_eq!(after.lease, LeaseHealth::Current);
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Task(TaskOperation::Update(
                Examples::heartbeat()?
            )))?
            .code,
        "conflict"
    );
    match scenario
        .client()
        .run(Operation::Task(TaskOperation::History(Examples::query()?)))?
    {
        Reply::History(events) => {
            assert_eq!(events.len(), 3);
            assert_eq!(events[0].kind, EventKind::Created);
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
            .client()
            .failure(Operation::Task(TaskOperation::Get(TaskQuery {
                feature: FeatureId::try_from("other-feature".to_owned())?,
                ..Examples::query()?
            })))?
            .code,
        "not_found"
    );
    let mut options = StatusOptions::new();
    options
        .include_ignored(false)
        .include_untracked(true)
        .recurse_untracked_dirs(true);
    assert!(
        scenario
            .repository()?
            .statuses(Some(&mut options))?
            .is_empty()
    );
    Ok(())
}

#[test]
fn requeue_rejects_old_worker_and_accepts_new_attempt() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let scenario = scenario.initialize(Examples::feature()?.feature)?;
    let scenario = scenario.create_task(Examples::task()?)?;
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Claim(Examples::claim()?)))?;
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Coordinate(
            Examples::coordinate(CoordinatorAction::Requeue {
                reason: Note::from("Worker exited".to_owned()),
                previous_execution: StoppedExecution::StoppedOrFinished,
            })?,
        )))?;
    let requeued_revision = scenario.status()?.remove(0).task.revision;
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Claim(ClaimTask {
            expected_revision: requeued_revision,
            ..Examples::claim()?
        })))?;
    let reclaimed_revision = scenario.status()?.remove(0).task.revision;
    let stale = WorkerUpdate {
        expected_revision: reclaimed_revision,
        ..Examples::heartbeat()?
    };
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Task(TaskOperation::Update(stale)))?
            .code,
        "assignment_changed"
    );
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Update(WorkerUpdate {
            expected_revision: reclaimed_revision,
            attempt: Attempt::UNCLAIMED.advance()?.advance()?,
            action: WorkerAction::Ready {
                progress: Examples::progress(Note::from("Reviewed".to_owned())),
            },
            ..Examples::heartbeat()?
        })))?;
    let ready_revision = scenario.status()?.remove(0).task.revision;
    let commit = scenario.head()?;
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Coordinate(
            CoordinatorUpdate {
                expected_revision: ready_revision,
                ..Examples::coordinate(CoordinatorAction::Integrate { commit })?
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
    let scenario = scenario.initialize(Examples::feature()?.feature)?;
    let worker_dir = tempfile::tempdir()?;
    // libgit2 creates the worktree directory itself.
    fs::remove_dir(worker_dir.path())?;
    let repository = scenario.repository()?;
    let base = repository.head()?.peel_to_commit()?;
    let branch = repository.branch("codex/worker", &base, false)?;
    let mut options = git2::WorktreeAddOptions::new();
    options.reference(Some(branch.get()));
    repository.worktree("worker", worker_dir.path(), Some(&options))?;
    let worker = scenario
        .linked(worker_dir)?
        .observe(Examples::feature()?.feature)?;
    match worker
        .client()
        .run(Operation::Feature(FeatureOperation::Status(
            Examples::feature()?,
        )))? {
        Reply::Status { ledger: found, .. } => assert_eq!(found.path, scenario.ledger().path),
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
    let scenario = scenario.create_task(CreateTask {
        workspace: Workspace::Git {
            branch: BranchName::try_from("codex/worker".to_owned())?,
            path: worker.path().to_owned(),
        },
        ..Examples::task()?
    })?;
    worker
        .client()
        .run(Operation::Task(TaskOperation::Claim(Examples::claim()?)))?;
    fs::write(worker.path().join("result.txt"), "result\n")?;
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
    worker
        .client()
        .run(Operation::Task(TaskOperation::Update(WorkerUpdate {
            action: WorkerAction::Checkpoint {
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
                commit: commit.clone(),
                progress: Examples::progress(Note::from("File added".to_owned())),
            },
            ..Examples::heartbeat()?
        })))?;
    let checkpoint_revision = worker.status()?.remove(0).task.revision;
    let ready = || -> anyhow::Result<Operation> {
        Ok(Operation::Task(TaskOperation::Update(WorkerUpdate {
            expected_revision: checkpoint_revision,
            action: WorkerAction::Ready {
                progress: Examples::progress(Note::from("Ready".to_owned())),
            },
            ..Examples::heartbeat()?
        })))
    };
    fs::write(worker.path().join("unfinished.txt"), "unfinished")?;
    assert_eq!(worker.client().failure(ready()?)?.code, "invalid_request");
    fs::remove_file(worker.path().join("unfinished.txt"))?;
    worker.client().run(ready()?)?;
    let ready_revision = worker.status()?.remove(0).task.revision;
    let integrate = || -> anyhow::Result<Operation> {
        Ok(Operation::Task(TaskOperation::Coordinate(
            CoordinatorUpdate {
                expected_revision: ready_revision,
                ..Examples::coordinate(CoordinatorAction::Integrate {
                    commit: commit.clone(),
                })?
            },
        )))
    };
    assert_eq!(
        scenario.client().failure(integrate()?)?.code,
        "invalid_request"
    );
    let target = repository.find_commit(worker_repository.head()?.peel_to_commit()?.id())?;
    assert!(repository.graph_descendant_of(target.id(), base.id())?);
    repository.checkout_tree(target.as_object(), None)?;
    repository
        .head()?
        .set_target(target.id(), "fast-forward test feature")?;
    scenario.client().run(integrate()?)?;
    assert_eq!(
        fs::read_to_string(scenario.path().join("result.txt"))?,
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
        let response = Cli::collect(
            scenario
                .client()
                .start_yaml(RequestYaml::from(request.to_owned()))?,
        )?;
        let Outcome::Error(error) = response.result else {
            bail!("invalid request accepted")
        };
        assert_eq!(error.code, "invalid_request");
    }
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Feature(FeatureOperation::Status(FeatureQuery {
                feature: FeatureId::try_from("missing".to_owned())?
            })))?
            .code,
        "not_found"
    );
    Ok(())
}

#[test]
fn progress_dependencies_cancellation_and_invalid_assignments() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let scenario = scenario.initialize(Examples::feature()?.feature)?;
    let scenario = scenario.create_task(Examples::task()?)?;
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Task(TaskOperation::Update(
                Examples::heartbeat()?
            )))?
            .code,
        "conflict"
    );
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Claim(Examples::claim()?)))?;
    let mut progress = Examples::progress(Note::from(
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
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Update(WorkerUpdate {
            action: WorkerAction::Progress {
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
                phase: Phase::Blocked {
                    reason: Note::from("Waiting for input".to_owned()),
                },
                progress: progress.clone(),
            },
            ..Examples::heartbeat()?
        })))?;
    let Reply::TaskView(view) = scenario
        .client()
        .run(Operation::Task(TaskOperation::Get(Examples::query()?)))?
    else {
        bail!("task view")
    };
    assert_eq!(view.task.progress, progress);
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Task(TaskOperation::Claim(ClaimTask {
                expected_revision: view.task.revision,
                ..Examples::claim()?
            })))?
            .code,
        "invalid_state"
    );
    let dependent = || -> anyhow::Result<CreateTask> {
        Ok(CreateTask {
            task: TaskId::try_from("dependent".to_owned())?,
            dependencies: vec![TaskId::try_from("task".to_owned())?],
            ..Examples::task()?
        })
    };
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Create(dependent()?)))?;
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Task(TaskOperation::Claim(ClaimTask {
                task: TaskId::try_from("dependent".to_owned())?,
                ..Examples::claim()?
            })))?
            .code,
        "dependency_pending"
    );
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Task(TaskOperation::Create(dependent()?)))?
            .code,
        "conflict"
    );
    assert_eq!(
        scenario
            .client()
            .failure(Operation::Task(TaskOperation::Create(CreateTask {
                task: TaskId::try_from("self-reference".to_owned())?,
                dependencies: vec![TaskId::try_from("self-reference".to_owned())?],
                ..Examples::task()?
            })))?
            .code,
        "invalid_request"
    );
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Coordinate(
            CoordinatorUpdate {
                expected_revision: view.task.revision,
                ..Examples::coordinate(CoordinatorAction::Cancel {
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
    let Reply::Features(empty) =
        scenario
            .client()
            .run(Operation::Feature(FeatureOperation::List(
                EmptyArguments {},
            )))?
    else {
        bail!("feature list")
    };
    assert!(empty.is_empty());
    let another = scenario.initialization(FeatureId::try_from("another".to_owned())?)?;
    let scenario = scenario.initialize(Examples::feature()?.feature)?;
    scenario
        .client()
        .run(Operation::Feature(FeatureOperation::Initialize(another)))?;
    let Reply::Features(features) =
        scenario
            .client()
            .run(Operation::Feature(FeatureOperation::List(
                EmptyArguments {},
            )))?
    else {
        bail!("feature list")
    };
    assert_eq!(features.len(), 2);
    assert!(
        features
            .iter()
            .any(|item| item.path == scenario.ledger().path)
    );
    let Reply::FrameworkInitialized { project } =
        scenario
            .client()
            .run(Operation::Framework(FrameworkOperation::Initialize(
                FrameworkInit {
                    harness: Harness::None,
                    instructions: Instructions::Skip,
                    bun: BunSetup::RequireExisting,
                },
            )))?
    else {
        bail!("framework initialization")
    };
    assert_eq!(project, scenario.path().canonicalize()?);
    let Reply::FrameworkInfo { paths } =
        scenario
            .client()
            .run(Operation::Framework(FrameworkOperation::Info(
                EmptyArguments {},
            )))?
    else {
        bail!("framework info")
    };
    assert_eq!(paths.project, project);
    assert!(paths.framework.join("AGENTS.md").is_file());
    for harness in [Harness::Codex, Harness::Claude, Harness::Cursor] {
        scenario
            .client()
            .run(Operation::Framework(FrameworkOperation::Initialize(
                FrameworkInit {
                    harness,
                    instructions: Instructions::Write,
                    bun: BunSetup::RequireExisting,
                },
            )))?;
    }
    let request_file = scenario.path().join("request.yaml");
    fs::write(
        &request_file,
        serde_saphyr::to_string(&scenario.client().request(Operation::Feature(
            FeatureOperation::Status(Examples::feature()?),
        )))?,
    )?;
    let output = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
        .args(["run", "--request"])
        .env("META_CORTEX_HOME", scenario.data_directory())
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
        .env("META_CORTEX_HOME", scenario.data_directory())
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
    let input = InitFeature {
        objective: Note::Empty,
        ..scenario.initialization(Examples::feature()?.feature)?
    };
    let scenario = scenario.initialize_with(input)?;
    let empty_progress = Examples::progress(Note::Empty);
    let scenario = scenario.create_task(CreateTask {
        objective: Note::Empty,
        acceptance: vec![Note::Empty],
        progress: empty_progress.clone(),
        ..Examples::task()?
    })?;
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Claim(Examples::claim()?)))?;
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Update(WorkerUpdate {
            action: WorkerAction::Progress {
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
                phase: Phase::Blocked {
                    reason: Note::Empty,
                },
                progress: empty_progress.clone(),
            },
            ..Examples::heartbeat()?
        })))?;
    let task = scenario.status()?.remove(0).task;
    assert_eq!(task.progress, empty_progress);
    scenario
        .client()
        .run(Operation::Task(TaskOperation::Coordinate(
            CoordinatorUpdate {
                expected_revision: task.revision,
                ..Examples::coordinate(CoordinatorAction::Cancel {
                    reason: Note::Empty,
                })?
            },
        )))?;
    let Reply::History(events) = scenario
        .client()
        .run(Operation::Task(TaskOperation::History(Examples::query()?)))?
    else {
        bail!("history")
    };
    let cancelled = events.last().context("cancelled event")?;
    assert_eq!(cancelled.note, Note::Empty);
    assert_eq!(cancelled.task.progress, empty_progress);
    assert!(matches!(cancelled.task.state, State::Cancelled));
    Ok(())
}

#[test]
fn scenario_setup_requires_successful_effects() -> anyhow::Result<()> {
    assert!(
        Scenario::create()?
            .observe(Examples::feature()?.feature)
            .is_err()
    );
    let scenario = Scenario::create()?;
    let input = InitFeature {
        branch: BranchName::try_from("codex/missing".to_owned())?,
        ..scenario.initialization(Examples::feature()?.feature)?
    };
    assert!(scenario.initialize_with(input).is_err());
    let scenario = Scenario::create()?.initialize(Examples::feature()?.feature)?;
    let other_feature = FeatureId::try_from("other".to_owned())?;
    assert!(
        scenario
            .create_task(CreateTask {
                feature: other_feature,
                ..Examples::task()?
            })
            .is_err()
    );
    Ok(())
}
