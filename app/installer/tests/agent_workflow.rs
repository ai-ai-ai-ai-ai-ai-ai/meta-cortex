use anyhow::{Context, bail};
use meta_cortex_visualization::{DashboardRequest, DashboardView};
use meta_cortex_workbench::PageIndex;
use meta_cortex_workbench::agents::{
    AgentId, DeliveryAgent, DevelopmentAgent, GizmoAgent, ReportingTarget,
};
use meta_cortex_workbench::model::workflow::{TaskAssignment, TaskOwnership};
use meta_cortex_workbench::model::{
    Event, EventKind, Phase, Progress, Task, TaskState, TaskView, Workspace,
};
use meta_cortex_workbench::request::{
    AssignTask, ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery,
    InitFeature, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::WorkerId;
use meta_cortex_workbench::values::{
    BranchName, CommitId, FeatureId, LeaseSeconds, Note, TaskId, TaskRevision,
};
use meta_cortex_workbench::versions::ProtocolVersion;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
struct Request {
    version: ProtocolVersion,
    project: PathBuf,
    operation: Operation,
}
#[derive(Serialize)]
#[serde(tag = "group", content = "command")]
enum Operation {
    Feature(FeatureOperation),
    Task(TaskOperation),
    Workbench(WorkbenchOperation),
}
#[derive(Serialize)]
#[serde(tag = "name", content = "arguments")]
enum FeatureOperation {
    Initialize(InitFeature),
    Status(FeatureQuery),
}
#[derive(Serialize)]
#[serde(tag = "name", content = "arguments")]
enum TaskOperation {
    Create(CreateTask),
    Assign(AssignTask),
    Claim(ClaimTask),
    Update(WorkerUpdate),
    Coordinate(CoordinatorUpdate),
    History(TaskQuery),
}
#[derive(Serialize)]
#[serde(tag = "name", content = "arguments")]
enum WorkbenchOperation {
    Dashboard(DashboardRequest),
}
#[derive(Deserialize)]
struct Response {
    version: ProtocolVersion,
    result: Outcome,
}
#[derive(Deserialize)]
#[serde(tag = "status", content = "data", rename_all = "snake_case")]
enum Outcome {
    Success(Reply),
    Error(Failure),
}
#[derive(Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
enum Reply {
    Ledger(Initialized),
    Task(Box<Task>),
    Status { tasks: Vec<TaskView> },
    History(Vec<Event>),
    Dashboard(Snapshot),
}
#[derive(Deserialize)]
struct Initialized {
    path: PathBuf,
}
#[derive(Deserialize)]
struct Snapshot {
    content: Note,
}
#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum FailureCode {
    InvalidRequest,
    Conflict,
    AssignmentChanged,
    InvalidState,
}
#[derive(Deserialize)]
struct Failure {
    code: FailureCode,
}

struct TaskPlan {
    id: TaskId,
    agent: AgentId,
    workspace: Workspace,
    dependencies: Vec<TaskId>,
}
struct Scenario {
    directory: tempfile::TempDir,
    project: PathBuf,
    data: PathBuf,
}
impl Scenario {
    fn new() -> anyhow::Result<Self> {
        let directory = tempfile::tempdir()?;
        let project = directory.path().join("project");
        let mut options = git2::RepositoryInitOptions::new();
        options.initial_head("codex/feature");
        let repository = git2::Repository::init_opts(&project, &options)?;
        let signature = git2::Signature::now("Workflow fixture", "fixture@example.invalid")?;
        let tree = repository.find_tree(repository.index()?.write_tree()?)?;
        repository.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])?;
        let data = directory.path().join("data");
        let scenario = Self {
            directory,
            project,
            data,
        };
        let Reply::Ledger(ledger) = scenario.run(Operation::Feature(
            FeatureOperation::Initialize(InitFeature {
                feature: Self::feature()?,
                objective: Note::from("Record the whole feature workflow".to_owned()),
                branch: BranchName::try_from("codex/feature".to_owned())?,
                worktree: scenario.project.clone(),
            }),
        ))?
        else {
            bail!("initialization response")
        };
        assert!(ledger.path.exists());
        Ok(scenario)
    }
    fn feature() -> anyhow::Result<FeatureId> {
        Ok(FeatureId::try_from("workflow".to_owned())?)
    }
    fn progress(summary: Note) -> Progress {
        Progress {
            summary,
            findings: vec![],
            next_steps: vec![],
            checks: vec![],
            extensions: Default::default(),
        }
    }
    fn call(&self, operation: Operation) -> anyhow::Result<Outcome> {
        let request = self.directory.path().join("request.yaml");
        fs::write(
            &request,
            serde_saphyr::to_string(&Request {
                version: ProtocolVersion::CURRENT,
                project: self.project.clone(),
                operation,
            })?,
        )?;
        let output = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .args(["run", "--request"])
            .arg(request)
            .env("META_CORTEX_HOME", &self.data)
            .output()?;
        let stdout = String::from_utf8(output.stdout)?;
        let response: Response = serde_saphyr::from_str(&stdout)
            .with_context(|| format!("decode CLI response:\n{stdout}"))?;
        assert_eq!(response.version, ProtocolVersion::CURRENT);
        match &response.result {
            Outcome::Success(_) => assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            ),
            Outcome::Error(_) => assert_eq!(output.status.code(), Some(2)),
        }
        Ok(response.result)
    }
    fn run(&self, operation: Operation) -> anyhow::Result<Reply> {
        match self.call(operation)? {
            Outcome::Success(reply) => Ok(reply),
            Outcome::Error(failure) => bail!("CLI failure: {:?}", failure.code),
        }
    }
    fn task(&self, operation: TaskOperation) -> anyhow::Result<Task> {
        let Reply::Task(task) = self.run(Operation::Task(operation))? else {
            bail!("task response")
        };
        Ok(*task)
    }
    fn create(&self, plan: TaskPlan) -> anyhow::Result<Task> {
        let actor = match plan.agent.reports_to() {
            ReportingTarget::Host => plan.agent,
            ReportingTarget::Gizmo(coordinator) => AgentId::Gizmo(coordinator),
        };
        let task = self.task(TaskOperation::Create(CreateTask {
            feature: Self::feature()?,
            task: plan.id,
            actor,
            objective: Note::from(format!("{} responsibility", plan.agent)),
            acceptance: vec![Note::from("Return the assigned evidence".to_owned())],
            dependencies: plan.dependencies,
            workspace: plan.workspace,
            progress: Self::progress(Note::from("Queued".to_owned())),
        }))?;
        self.task(TaskOperation::Assign(AssignTask {
            feature: task.common.feature,
            task: task.common.id,
            expected_revision: task.common.revision,
            actor,
            assignment: TaskAssignment::from(plan.agent),
        }))
    }
    fn claim(&self, task: Task) -> anyhow::Result<Task> {
        let TaskOwnership::Assigned { assignment } = &task.ownership else {
            bail!("missing assignment")
        };
        let agent = assignment.agent;
        self.task(TaskOperation::Claim(ClaimTask {
            worker_id: WorkerId::EXAMPLE,
            feature: task.common.feature,
            task: task.common.id,
            expected_revision: task.common.revision,
            agent,
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
        }))
    }
    fn update(&self, input: ActivityUpdate) -> anyhow::Result<Task> {
        let TaskOwnership::Assigned { assignment } = &input.task.ownership else {
            bail!("missing assignment")
        };
        let agent = assignment.agent;
        self.task(TaskOperation::Update(WorkerUpdate {
            worker_id: WorkerId::EXAMPLE,
            feature: input.task.common.feature,
            task: input.task.common.id,
            expected_revision: input.task.common.revision,
            agent,
            attempt: input.task.common.attempt,
            action: input.action,
        }))
    }
    fn complete(&self, task: Task) -> anyhow::Result<Task> {
        let task = self.update(ActivityUpdate {
            task,
            action: WorkerAction::Ready {
                progress: Self::progress(Note::from("Accepted evidence is ready".to_owned())),
            },
        })?;
        let TaskOwnership::Assigned { assignment } = &task.ownership else {
            bail!("missing assignment")
        };
        let actor = match assignment.reports_to {
            ReportingTarget::Host => assignment.agent,
            ReportingTarget::Gizmo(coordinator) => AgentId::Gizmo(coordinator),
        };
        self.task(TaskOperation::Coordinate(CoordinatorUpdate {
            feature: task.common.feature,
            task: task.common.id,
            expected_revision: task.common.revision,
            actor,
            action: CoordinatorAction::Complete,
        }))
    }
    fn worker(&self) -> anyhow::Result<Workspace> {
        let repository = git2::Repository::open(&self.project)?;
        let commit = repository.head()?.peel_to_commit()?;
        let branch = repository.branch("codex/worker", &commit, false)?;
        let path = self.directory.path().join("worker");
        let mut options = git2::WorktreeAddOptions::new();
        options.reference(Some(branch.get()));
        repository.worktree("worker", &path, Some(&options))?;
        let worker = git2::Repository::open(&path)?;
        fs::write(path.join("feature.txt"), "feature implementation")?;
        let mut index = worker.index()?;
        index.add_path(Path::new("feature.txt"))?;
        index.write()?;
        let tree = worker.find_tree(index.write_tree()?)?;
        let signature = git2::Signature::now("Worker fixture", "worker@example.invalid")?;
        worker.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "implement feature",
            &tree,
            &[&worker.head()?.peel_to_commit()?],
        )?;
        Ok(Workspace::Git {
            branch: BranchName::try_from("codex/worker".to_owned())?,
            path,
        })
    }
    fn merge(&self, commit: &CommitId) -> anyhow::Result<()> {
        let repository = git2::Repository::open(&self.project)?;
        let commit = repository.find_commit(git2::Oid::from_str(&commit.to_string())?)?;
        repository
            .find_reference("refs/heads/codex/feature")?
            .set_target(commit.id(), "fast-forward integration fixture")?;
        repository.checkout_head(None)?;
        Ok(())
    }
}
struct ActivityUpdate {
    task: Task,
    action: WorkerAction,
}

#[test]
fn cli_records_prime_team_workers_verification_integration_and_pr_delivery() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    let prime = AgentId::Gizmo(GizmoAgent::GizmoPrime);
    let team = AgentId::Gizmo(GizmoAgent::Gizmo);
    let root = scenario.claim(scenario.create(TaskPlan {
        id: TaskId::try_from("prime".to_owned())?,
        agent: prime,
        workspace: Workspace::ReadOnly,
        dependencies: vec![],
    })?)?;
    let coordination = scenario.claim(scenario.create(TaskPlan {
        id: TaskId::try_from("coordination".to_owned())?,
        agent: team,
        workspace: Workspace::ReadOnly,
        dependencies: vec![],
    })?)?;
    let root = scenario.update(ActivityUpdate {
        task: root,
        action: WorkerAction::Progress {
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
            phase: Phase::Blocked {
                reason: Note::from("Waiting for combined validation and PR delivery".to_owned()),
            },
            progress: Scenario::progress(Note::from("Reviewing the feature outcome".to_owned())),
        },
    })?;
    let integration = scenario.claim(scenario.create(TaskPlan {
        id: TaskId::try_from("integration".to_owned())?,
        agent: AgentId::Delivery(DeliveryAgent::IntegrationAgent),
        workspace: Workspace::Feature,
        dependencies: vec![],
    })?)?;
    let workspace = scenario.worker()?;
    let Workspace::Git { path, .. } = &workspace else {
        bail!("worker workspace")
    };
    let commit = CommitId::try_from(
        git2::Repository::open(path)?
            .head()?
            .peel_to_commit()?
            .id()
            .to_string(),
    )?;
    let worker = scenario.claim(scenario.create(TaskPlan {
        id: TaskId::try_from("implementation".to_owned())?,
        agent: AgentId::Development(DevelopmentAgent::RustDev),
        workspace,
        dependencies: vec![],
    })?)?;
    let worker = scenario.update(ActivityUpdate {
        task: worker,
        action: WorkerAction::Checkpoint {
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
            commit: commit.clone(),
            progress: Scenario::progress(Note::from("Implementation checkpoint".to_owned())),
        },
    })?;
    let worker = scenario.update(ActivityUpdate {
        task: worker,
        action: WorkerAction::Ready {
            progress: Scenario::progress(Note::from(
                "Implementation ready for verification".to_owned(),
            )),
        },
    })?;
    let verifier = scenario.claim(scenario.create(TaskPlan {
        id: TaskId::try_from("verification".to_owned())?,
        agent: AgentId::Development(DevelopmentAgent::RustVerifier),
        workspace: Workspace::ReadOnly,
        dependencies: vec![],
    })?)?;
    let verifier = scenario.complete(verifier)?;
    scenario.merge(&commit)?;
    let worker = scenario.task(TaskOperation::Coordinate(CoordinatorUpdate {
        feature: worker.common.feature,
        task: worker.common.id,
        expected_revision: worker.common.revision,
        actor: AgentId::Delivery(DeliveryAgent::IntegrationAgent),
        action: CoordinatorAction::Integrate { commit },
    }))?;
    let integration = scenario.complete(integration)?;
    let delivery = scenario.claim(scenario.create(TaskPlan {
        id: TaskId::try_from("pr-delivery".to_owned())?,
        agent: AgentId::Delivery(DeliveryAgent::PrAgent),
        workspace: Workspace::Feature,
        dependencies: vec![worker.common.id, verifier.common.id, integration.common.id],
    })?)?;
    let delivery = scenario.update(ActivityUpdate {
        task: delivery,
        action: WorkerAction::Progress {
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
            phase: Phase::Working,
            progress: Scenario::progress(Note::from(
                "PR URL and observed checks recorded by the delivery owner".to_owned(),
            )),
        },
    })?;
    scenario.complete(delivery)?;
    scenario.complete(coordination)?;
    let root = scenario.complete(root)?;
    let Reply::Status { tasks } =
        scenario.run(Operation::Feature(FeatureOperation::Status(FeatureQuery {
            feature: Scenario::feature()?,
        })))?
    else {
        bail!("status response")
    };
    assert_eq!(tasks.len(), 6);
    for view in &tasks {
        let TaskOwnership::Assigned { assignment } = &view.task.ownership else {
            bail!("unrecorded workflow participant")
        };
        assignment.validate()?;
        assert!(matches!(
            view.task.state,
            TaskState::Completed { .. } | TaskState::Integrated { .. }
        ));
    }
    let Reply::History(history) =
        scenario.run(Operation::Task(TaskOperation::History(TaskQuery {
            feature: root.common.feature,
            task: root.common.id,
        })))?
    else {
        bail!("history response")
    };
    assert!(
        history
            .iter()
            .any(|event| event.kind == EventKind::Assigned && event.actor == prime)
    );
    assert!(
        history
            .iter()
            .any(|event| event.kind == EventKind::Progress && event.actor == prime)
    );
    let Reply::Dashboard(snapshot) = scenario.run(Operation::Workbench(
        WorkbenchOperation::Dashboard(DashboardRequest::Snapshot {
            view: DashboardView::Tasks {
                feature: Scenario::feature()?,
            },
            page: PageIndex::FIRST,
        }),
    ))?
    else {
        bail!("snapshot response")
    };
    let content = snapshot.content.to_string();
    for expected in [
        "Agent: Gizmo/GizmoPrime · Reports to: host",
        "Agent: Gizmo/Gizmo · Reports to: Gizmo/GizmoPrime",
        "Agent: Delivery/IntegrationAgent · Reports to: Gizmo/Gizmo",
        "Agent: Delivery/PrAgent · Reports to: Gizmo/Gizmo",
        "RustDev",
        "RustVerifier",
        "completed",
        "integrated",
    ] {
        assert!(content.contains(expected), "missing {expected}");
    }
    Ok(())
}

#[test]
fn assignment_changes_require_a_queued_task_current_revision_and_catalog_reporting_line()
-> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    let agent = AgentId::Delivery(DeliveryAgent::IntegrationAgent);
    let task = scenario.create(TaskPlan {
        id: TaskId::try_from("integration".to_owned())?,
        agent,
        workspace: Workspace::Feature,
        dependencies: vec![],
    })?;
    let input = AssignTask {
        feature: task.common.feature.clone(),
        task: task.common.id.clone(),
        expected_revision: task.common.revision,
        actor: AgentId::Gizmo(GizmoAgent::Gizmo),
        assignment: TaskAssignment {
            agent,
            reports_to: ReportingTarget::Gizmo(GizmoAgent::GizmoPrime),
        },
    };
    let Outcome::Error(failure) = scenario.call(Operation::Task(TaskOperation::Assign(input)))?
    else {
        bail!("invalid reporting line accepted")
    };
    assert_eq!(failure.code, FailureCode::InvalidRequest);
    let Outcome::Error(failure) =
        scenario.call(Operation::Task(TaskOperation::Assign(AssignTask {
            feature: task.common.feature.clone(),
            task: task.common.id.clone(),
            expected_revision: TaskRevision::INITIAL,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            assignment: TaskAssignment::from(agent),
        })))?
    else {
        bail!("stale assignment revision accepted")
    };
    assert_eq!(failure.code, FailureCode::Conflict);
    let Outcome::Error(failure) =
        scenario.call(Operation::Task(TaskOperation::Claim(ClaimTask {
            worker_id: WorkerId::EXAMPLE,
            feature: task.common.feature.clone(),
            task: task.common.id.clone(),
            expected_revision: task.common.revision,
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
        })))?
    else {
        bail!("wrong owner claimed task")
    };
    assert_eq!(failure.code, FailureCode::AssignmentChanged);
    let claimed = scenario.claim(task)?;
    let Outcome::Error(failure) =
        scenario.call(Operation::Task(TaskOperation::Assign(AssignTask {
            feature: claimed.common.feature.clone(),
            task: claimed.common.id.clone(),
            expected_revision: claimed.common.revision,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            assignment: TaskAssignment::from(agent),
        })))?
    else {
        bail!("active task reassigned")
    };
    assert_eq!(failure.code, FailureCode::InvalidState);
    fs::write(
        scenario.project.join("unfinished.txt"),
        "uncommitted feature work",
    )?;
    let Outcome::Error(failure) =
        scenario.call(Operation::Task(TaskOperation::Update(WorkerUpdate {
            worker_id: WorkerId::EXAMPLE,
            feature: claimed.common.feature.clone(),
            task: claimed.common.id.clone(),
            expected_revision: claimed.common.revision,
            agent,
            attempt: claimed.common.attempt,
            action: WorkerAction::Ready {
                progress: Scenario::progress(Note::from("Not clean yet".to_owned())),
            },
        })))?
    else {
        bail!("dirty feature activity became ready")
    };
    assert_eq!(failure.code, FailureCode::InvalidRequest);
    fs::remove_file(scenario.project.join("unfinished.txt"))?;
    let completed = scenario.complete(claimed)?;
    let Outcome::Error(failure) =
        scenario.call(Operation::Task(TaskOperation::Assign(AssignTask {
            feature: completed.common.feature,
            task: completed.common.id,
            expected_revision: completed.common.revision,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            assignment: TaskAssignment::from(agent),
        })))?
    else {
        bail!("completed task reassigned")
    };
    assert_eq!(failure.code, FailureCode::InvalidState);
    Ok(())
}
