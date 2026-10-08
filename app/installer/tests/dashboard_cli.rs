use meta_cortex_visualization::{DashboardRequest, DashboardView};
use meta_cortex_workbench::agents::{AgentId, GizmoAgent};
use meta_cortex_workbench::model::{Progress, Workspace};
use meta_cortex_workbench::request::{CreateTask, InitFeature, TaskQuery};
use meta_cortex_workbench::values::{BranchName, FeatureId, Note, TaskId};
use meta_cortex_workbench::versions::ProtocolVersion;
use meta_cortex_workbench::{DataDirectory, PageIndex, Workbench};
use serde::{Deserialize, Serialize};
use std::env::consts::EXE_SUFFIX;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tokio::runtime::Builder;

#[derive(Serialize)]
struct Request {
    version: ProtocolVersion,
    project: PathBuf,
    operation: Operation,
}
#[derive(Serialize)]
#[serde(tag = "group", content = "command")]
enum Operation {
    Workbench(WorkbenchOperation),
}
#[derive(Serialize)]
#[serde(tag = "name", content = "arguments")]
enum WorkbenchOperation {
    Dashboard(DashboardRequest),
}
#[derive(Deserialize)]
struct Response {
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
    Dashboard(Report),
}
#[derive(Deserialize)]
struct Report {
    content: Note,
}
#[derive(Deserialize)]
struct Failure {
    message: Note,
}
struct Scenario {
    directory: tempfile::TempDir,
    project: PathBuf,
    data: DataDirectory,
    database: PathBuf,
}
impl Scenario {
    fn new() -> anyhow::Result<Self> {
        let directory = tempfile::tempdir()?;
        let project = directory.path().join("project");
        let mut options = git2::RepositoryInitOptions::new();
        options.initial_head("codex/feature");
        let repository = git2::Repository::init_opts(&project, &options)?;
        let signature = git2::Signature::now("Fixture", "fixture@example.invalid")?;
        let tree = repository.find_tree(repository.index()?.write_tree()?)?;
        repository.commit(Some("HEAD"), &signature, &signature, "fixture", &tree, &[])?;
        let data = DataDirectory::from(directory.path().join("data"));
        let database = Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let workbench = Workbench::discover(&project)?.with_data_directory(data.clone());
                let mut ledger = workbench
                    .initialize(InitFeature {
                        feature: Self::feature()?,
                        objective: Note::from("Recorded feature objective".to_owned()),
                        branch: BranchName::try_from("codex/feature".to_owned())?,
                        worktree: project.clone(),
                    })
                    .await?;
                ledger
                    .create(CreateTask {
                        feature: Self::feature()?,
                        task: Self::task()?,
                        actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                        objective: Note::from("Recorded task objective".to_owned()),
                        acceptance: vec![Note::from("Accept recorded output".to_owned())],
                        dependencies: vec![],
                        workspace: Workspace::ReadOnly,
                        progress: Progress {
                            summary: Note::from("Recorded progress".to_owned()),
                            findings: vec![Note::from("Recorded finding".to_owned())],
                            next_steps: vec![],
                            checks: vec![],
                            extensions: Default::default(),
                        },
                    })
                    .await?;
                Ok::<_, anyhow::Error>(ledger.info().path)
            })?;
        Ok(Self {
            directory,
            project,
            data,
            database,
        })
    }
    fn feature() -> anyhow::Result<FeatureId> {
        Ok(FeatureId::try_from("feature".to_owned())?)
    }
    fn task() -> anyhow::Result<TaskId> {
        Ok(TaskId::try_from("task".to_owned())?)
    }
    fn query() -> anyhow::Result<TaskQuery> {
        Ok(TaskQuery {
            feature: Self::feature()?,
            task: Self::task()?,
        })
    }
    fn request(&self, arguments: DashboardRequest) -> anyhow::Result<PathBuf> {
        let path = self.directory.path().join("request.yaml");
        fs::write(
            &path,
            serde_saphyr::to_string(&Request {
                version: ProtocolVersion::CURRENT,
                project: self.project.clone(),
                operation: Operation::Workbench(WorkbenchOperation::Dashboard(arguments)),
            })?,
        )?;
        Ok(path)
    }
    fn run(&self, arguments: DashboardRequest) -> anyhow::Result<Outcome> {
        let output = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .args(["run", "--request"])
            .arg(self.request(arguments)?)
            .env("META_CORTEX_HOME", self.data.path())
            .output()?;
        let response: Response = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
        match &response.result {
            Outcome::Success(_) => assert!(output.status.success()),
            Outcome::Error(_) => assert_eq!(output.status.code(), Some(2)),
        }
        Ok(response.result)
    }
}
#[test]
fn snapshots_use_typed_transport_and_recorded_content() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    for view in [
        DashboardView::Features,
        DashboardView::Tasks {
            feature: Scenario::feature()?,
        },
        DashboardView::Task {
            query: Scenario::query()?,
        },
        DashboardView::History {
            query: Scenario::query()?,
        },
    ] {
        let outcome = scenario.run(DashboardRequest::Snapshot {
            view,
            page: PageIndex::FIRST,
        })?;
        let Outcome::Success(Reply::Dashboard(report)) = outcome else {
            anyhow::bail!("snapshot failed");
        };
        let text = report.content.to_string();
        assert!(text.contains("recorded ledger data"));
        assert!(text.contains("Git authorship: unrecorded"));
        assert!(
            !text.contains("Fixture"),
            "Git commit author leaked into dashboard"
        );
    }
    assert!(serde_saphyr::from_str::<DashboardRequest>("mode: Interactive").is_err());
    assert!(
        serde_saphyr::from_str::<DashboardRequest>("mode: Desktop\nview: {kind: Features}")
            .is_err()
    );
    assert!(serde_saphyr::from_str::<DashboardRequest>("mode: Desktop").is_ok());

    Ok(())
}
#[test]
fn dashboard_help_needs_no_request_file_and_snapshot_retains_repository_scope() -> anyhow::Result<()>
{
    let executable = env!("CARGO_BIN_EXE_meta-cortex");
    let help = Command::new(executable)
        .args(["dashboard", "--help"])
        .output()?;
    assert!(help.status.success());
    let text = String::from_utf8(help.stdout)?;
    assert!(
        text.contains(&format!("Usage: meta-cortex{EXE_SUFFIX} dashboard")),
        "{text}"
    );
    assert!(!text.contains("--request"));
    let outside = tempfile::tempdir()?;
    let data = outside.path().join("unused-data");
    let request = outside.path().join("snapshot.yaml");
    fs::write(
        &request,
        serde_saphyr::to_string(&Request {
            version: ProtocolVersion::V1,
            project: outside.path().to_owned(),
            operation: Operation::Workbench(WorkbenchOperation::Dashboard(
                DashboardRequest::Snapshot {
                    view: DashboardView::Features,
                    page: PageIndex::FIRST,
                },
            )),
        })?,
    )?;
    let output = Command::new(executable)
        .arg("run")
        .arg("--request")
        .arg(request)
        .current_dir(outside.path())
        .env("META_CORTEX_HOME", &data)
        .output()?;
    assert_eq!(output.status.code(), Some(2));
    let response: Response = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
    let Outcome::Error(failure) = response.result else {
        anyhow::bail!("Snapshot accepted an outside repository");
    };
    assert!(failure.message.to_string().contains("Git operation failed"));
    assert!(!data.exists());
    let scenario = Scenario::new()?;
    fs::remove_file(&scenario.database)?;
    let outcome = scenario.run(DashboardRequest::Snapshot {
        view: DashboardView::Features,
        page: PageIndex::FIRST,
    })?;
    let Outcome::Success(Reply::Dashboard(report)) = outcome else {
        anyhow::bail!("empty feature catalog failed");
    };
    assert!(report.content.to_string().contains("No recorded features"));
    assert!(!scenario.database.exists());
    Ok(())
}
