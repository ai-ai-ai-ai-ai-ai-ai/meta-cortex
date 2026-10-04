//! Generate the UI sample through real public Workbench mutations and observation.
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::workflow::TaskAssignment;
use meta_cortex_workbench::model::{Check, CheckOutcome, Progress, Workspace};
use meta_cortex_workbench::request::{
    AssignTask, ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, InitFeature,
    WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    BranchName, Extensions, FeatureId, LeaseSeconds, Note, TaskId, WorkerId,
};
use meta_cortex_workbench::{DataDirectory, Workbench};
use std::collections::BTreeMap;
use tokio::runtime::Builder;

fn main() -> anyhow::Result<()> {
    let project = tempfile::tempdir()?;
    let data = tempfile::tempdir()?;
    let mut options = git2::RepositoryInitOptions::new();
    options.initial_head("codex/release-0-12-3");
    let repository = git2::Repository::init_opts(project.path(), &options)?;
    let signature = git2::Signature::now("Fixture", "fixture@example.invalid")?;
    let tree = repository.find_tree(repository.index()?.write_tree()?)?;
    repository.commit(Some("HEAD"), &signature, &signature, "Fixture", &tree, &[])?;
    let workbench = Workbench::discover(project.path())?
        .with_data_directory(DataDirectory::from(data.path().to_owned()));
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let feature = FeatureId::try_from("release-0-12-3".to_owned())?;
            let actor = AgentId::Gizmo(GizmoAgent::GizmoPrime);
            let agent = AgentId::Development(DevelopmentAgent::RustDev);
            let mut ledger = workbench
                .initialize(InitFeature {
                    feature: feature.clone(),
                    objective: Note::from("Ship the release".to_owned()),
                    branch: BranchName::try_from("codex/release-0-12-3".to_owned())?,
                    worktree: project.path().to_owned(),
                })
                .await?;
            let progress = Progress {
                summary: Note::from("Release implemented".to_owned()),
                findings: vec![Note::from("Checked the manifest".to_owned())],
                next_steps: Vec::new(),
                checks: vec![Check {
                    command: Note::from("cargo test -p workbench".to_owned()),
                    outcome: CheckOutcome::Passed,
                    evidence: Note::from("34 passed".to_owned()),
                }],
                extensions: Extensions(BTreeMap::from([(
                    "review_report".to_owned(),
                    serde_json::Value::String("All checks passed".to_owned()),
                )])),
            };
            let task = ledger
                .create(CreateTask {
                    feature: feature.clone(),
                    task: TaskId::try_from("rust-release".to_owned())?,
                    actor,
                    objective: Note::from("Implement the release".to_owned()),
                    acceptance: vec![Note::from("Tests pass".to_owned())],
                    dependencies: Vec::new(),
                    workspace: Workspace::ReadOnly,
                    progress: Progress {
                        summary: Note::Empty,
                        findings: Vec::new(),
                        next_steps: Vec::new(),
                        checks: Vec::new(),
                        extensions: Extensions::default(),
                    },
                })
                .await?;
            let task = ledger
                .assign(AssignTask {
                    feature: feature.clone(),
                    task: task.common.id,
                    expected_revision: task.common.revision,
                    actor,
                    assignment: TaskAssignment::from(agent),
                })
                .await?;
            let task = ledger
                .claim(ClaimTask {
                    feature: feature.clone(),
                    task: task.common.id,
                    expected_revision: task.common.revision,
                    agent,
                    worker_id: WorkerId::EXAMPLE,
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                })
                .await?;
            let task = ledger
                .update(WorkerUpdate {
                    feature: feature.clone(),
                    task: task.common.id,
                    expected_revision: task.common.revision,
                    agent,
                    worker_id: WorkerId::EXAMPLE,
                    attempt: task.common.attempt,
                    action: WorkerAction::Ready { progress },
                })
                .await?;
            ledger
                .coordinate(CoordinatorUpdate {
                    feature: feature.clone(),
                    task: task.common.id,
                    expected_revision: task.common.revision,
                    actor,
                    action: CoordinatorAction::Complete,
                })
                .await?;
            let workflow = workbench.observe().await?.workflow(feature).await?;
            println!("{}", serde_json::to_string_pretty(&workflow)?);
            Ok(())
        })
}
