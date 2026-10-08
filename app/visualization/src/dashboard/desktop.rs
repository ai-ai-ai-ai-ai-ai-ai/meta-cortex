use super::{DashboardError, DashboardReport, NativeExitCode};
use meta_cortex_workbench::values::{FeatureId, Note};
use meta_cortex_workbench::{FeatureCard, FeatureWorkflow, Page, PageIndex, Workbench};
use schemars::JsonSchema;
use serde::Serialize;
use std::future::Future;
use std::sync::Arc;
use tauri::{State, async_runtime};
use tauri_plugin_opener::init;
use tokio::runtime::Builder;

/// The most recently active features with their totals, held work, outcomes and pull requests.
#[derive(Debug, Serialize, JsonSchema)]
pub struct DesktopReply {
    pub features: Page<FeatureCard>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "kind")]
pub enum DesktopFailure {
    Ledger { message: Note },
    Runtime { message: Note },
    Native { message: Note },
}
impl From<DashboardError> for DesktopFailure {
    fn from(error: DashboardError) -> Self {
        let message = Note::from(error.to_string());
        match error {
            DashboardError::Ledger(_) => Self::Ledger { message },
            DashboardError::Runtime(_) => Self::Runtime { message },
            DashboardError::Native(_) | DashboardError::Exit(_) => Self::Native { message },
        }
    }
}
#[derive(JsonSchema)]
pub struct DesktopContract {
    pub reply: DesktopReply,
    pub workflow: FeatureWorkflow,
    pub failure: DesktopFailure,
}
pub struct DesktopLaunch {
    pub(super) workbench: Workbench,
}
impl DesktopLaunch {
    /// Run only after async preparation returns to the executable's original main thread.
    pub fn run(self) -> Result<DashboardReport, DashboardError> {
        let app = tauri::Builder::default()
            .plugin(init())
            .manage(Arc::new(self))
            .invoke_handler(tauri::generate_handler![
                dashboard_read,
                dashboard_workflow,
                dashboard_upgrade
            ])
            .build(tauri::generate_context!())?;
        match app.run_return(|_handle, _event| {}) {
            0 => {}
            code => return Err(DashboardError::Exit(NativeExitCode::from(code))),
        }
        Ok(DashboardReport {
            content: Note::from("Workbench dashboard closed".to_owned()),
        })
    }
    async fn read(&self) -> Result<DesktopReply, DashboardError> {
        let observation = self.workbench.observe().await?;
        let catalog = observation.summaries(PageIndex::FIRST).await?;
        Ok(DesktopReply {
            features: catalog.features,
        })
    }
    fn blocking_workflow(&self, feature: FeatureId) -> Result<FeatureWorkflow, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async { Ok(self.workbench.observe().await?.workflow(feature).await?) })
    }
    fn blocking_upgrade(&self, feature: FeatureId) -> Result<FeatureWorkflow, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                self.workbench.open(feature.clone()).await?;
                Ok(self.workbench.observe().await?.workflow(feature).await?)
            })
    }
    fn blocking_read(&self) -> Result<DesktopReply, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(self.read())
    }
}
// Tauri's command adapter injects managed State as the command's only argument.
#[tauri::command(async)]
fn dashboard_read(
    state: State<'_, Arc<DesktopLaunch>>,
) -> impl Future<Output = Result<DesktopReply, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_read())
            .await
            .map_err(DashboardError::from)
            .flatten()
            .map_err(DesktopFailure::from)
    }
}

// Tauri injects State independently of the serialized feature argument.
#[tauri::command(async)]
fn dashboard_workflow(
    state: State<'_, Arc<DesktopLaunch>>,
    feature: FeatureId,
) -> impl Future<Output = Result<FeatureWorkflow, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_workflow(feature))
            .await
            .map_err(DashboardError::from)
            .flatten()
            .map_err(DesktopFailure::from)
    }
}

// Only an explicit selected-feature action may migrate storage.
#[tauri::command(async)]
fn dashboard_upgrade(
    state: State<'_, Arc<DesktopLaunch>>,
    feature: FeatureId,
) -> impl Future<Output = Result<FeatureWorkflow, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_upgrade(feature))
            .await
            .map_err(DashboardError::from)
            .flatten()
            .map_err(DesktopFailure::from)
    }
}

#[cfg(test)]
mod tests {
    use super::DesktopContract;
    use meta_cortex_workbench::model::Progress;
    use meta_cortex_workbench::values::{CommitId, FeatureId};
    use meta_cortex_workbench::{DataDirectory, Workbench};
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;

    /// Explicitly invoked against a real repository, never a native-window claim.
    #[test]
    #[ignore = "requires explicit real repository, feature, ledger and output paths"]
    fn actual_workflow_ipc_reads_existing_turso_without_writes() -> anyhow::Result<()> {
        use super::{DesktopLaunch, dashboard_read, dashboard_upgrade, dashboard_workflow};
        use meta_cortex_workbench::Workbench;
        use meta_cortex_workbench::values::FeatureId;
        use std::io::ErrorKind;
        use std::path::PathBuf;
        use std::sync::Arc;
        use std::{env, fs};
        use tauri::WebviewWindowBuilder;
        use tauri::ipc::{CallbackFn, InvokeBody};
        use tauri::test::{INVOKE_KEY, get_ipc_response, mock_builder, mock_context, noop_assets};
        use tauri::webview::InvokeRequest;
        #[derive(serde::Serialize)]
        struct WorkflowInvocation {
            feature: FeatureId,
        }
        let project = PathBuf::from(
            env::var_os("META_CORTEX_IPC_PROJECT")
                .ok_or_else(|| anyhow::anyhow!("META_CORTEX_IPC_PROJECT is required"))?,
        );
        let ledger = PathBuf::from(
            env::var_os("META_CORTEX_IPC_LEDGER")
                .ok_or_else(|| anyhow::anyhow!("META_CORTEX_IPC_LEDGER is required"))?,
        );
        let output = PathBuf::from(
            env::var_os("META_CORTEX_IPC_OUTPUT")
                .ok_or_else(|| anyhow::anyhow!("META_CORTEX_IPC_OUTPUT is required"))?,
        );
        let feature = FeatureId::try_from(env::var("META_CORTEX_IPC_FEATURE")?)?;
        let before = fs::read(&ledger)?;
        let wal = ledger.with_extension("db-wal");
        let before_wal = match fs::read(&wal) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(error.into()),
        };
        let launch = DesktopLaunch {
            workbench: Workbench::discover(&project)?,
        };
        let expected = serde_json::to_value(launch.blocking_workflow(feature.clone())?)?;
        let app = mock_builder()
            .manage(Arc::new(launch))
            .invoke_handler(tauri::generate_handler![
                dashboard_read,
                dashboard_workflow,
                dashboard_upgrade
            ])
            .build(mock_context(noop_assets()))?;
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default()).build()?;
        let response = get_ipc_response(
            &webview,
            InvokeRequest {
                cmd: "dashboard_workflow".to_owned(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse()?,
                body: InvokeBody::Json(serde_json::to_value(WorkflowInvocation { feature })?),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_owned(),
            },
        )
        .map_err(|error| anyhow::anyhow!("IPC failed: {error}"))?
        .deserialize::<serde_json::Value>()?;
        assert_eq!(
            response, expected,
            "actual IPC handler must expose the public Workbench projection"
        );
        assert_eq!(
            before,
            fs::read(&ledger)?,
            "observation must not modify the database"
        );
        let after_wal = match fs::read(&wal) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(error.into()),
        };
        assert_eq!(
            before_wal, after_wal,
            "observation must not append WAL records"
        );
        fs::write(output, serde_json::to_vec_pretty(&response)?)?;
        println!(
            "Tauri MockRuntime IPC -> actual dashboard_workflow -> Workbench -> real Turso; database and WAL bytes unchanged. No native window render asserted."
        );
        Ok(())
    }

    struct FeatureLogScenario {
        _directory: TempDir,
        project: PathBuf,
        worker: PathBuf,
        data: DataDirectory,
        feature: FeatureId,
        checkpoint: CommitId,
    }
    impl FeatureLogScenario {
        fn new() -> anyhow::Result<Self> {
            let directory = tempfile::tempdir()?;
            let project = directory.path().join("project");
            let mut options = git2::RepositoryInitOptions::new();
            options.initial_head("codex/native-feature-log");
            let repository = git2::Repository::init_opts(&project, &options)?;
            let signature = git2::Signature::now("Fixture author", "author@example.invalid")?;
            let tree = repository.find_tree(repository.index()?.write_tree()?)?;
            let checkpoint = CommitId::try_from(
                repository
                    .commit(Some("HEAD"), &signature, &signature, "Fixture", &tree, &[])?
                    .to_string(),
            )?;
            let worker = directory.path().join("worker");
            let worker_reference = repository
                .branch(
                    "codex/native-worker",
                    &repository.head()?.peel_to_commit()?,
                    false,
                )?
                .into_reference();
            let mut worker_options = git2::WorktreeAddOptions::new();
            worker_options.reference(Some(&worker_reference));
            repository.worktree("native-worker", &worker, Some(&worker_options))?;
            let data = DataDirectory::from(directory.path().join("data"));
            Ok(Self {
                _directory: directory,
                project,
                worker,
                data,
                feature: FeatureId::try_from("native-feature-log".to_owned())?,
                checkpoint,
            })
        }
        fn workbench(&self) -> anyhow::Result<Workbench> {
            Ok(Workbench::discover(&self.project)?.with_data_directory(self.data.clone()))
        }
        fn progress() -> Progress {
            use meta_cortex_workbench::values::Note;
            Progress {
                summary: Note::from("Coordination progress is not a milestone".to_owned()),
                findings: Vec::new(),
                next_steps: Vec::new(),
                checks: Vec::new(),
                extensions: Default::default(),
            }
        }
        fn populate(&self) -> anyhow::Result<PathBuf> {
            use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
            use meta_cortex_workbench::model::Workspace;
            use meta_cortex_workbench::model::checkpoint_outcome::{CheckpointOutcome, OutcomeId};
            use meta_cortex_workbench::request::{
                ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, InitFeature,
                WorkerAction, WorkerUpdate,
            };
            use meta_cortex_workbench::values::{BranchName, LeaseSeconds, Note, TaskId, WorkerId};
            use tokio::runtime::Builder;
            Builder::new_current_thread()
                .enable_time()
                .build()?
                .block_on(async {
                    let workbench = self.workbench()?;
                    let actor = AgentId::Gizmo(GizmoAgent::Gizmo);
                    let agent = AgentId::Development(DevelopmentAgent::RustDev);
                    let mut ledger = workbench
                        .initialize(InitFeature {
                            feature: self.feature.clone(),
                            objective: Note::from("Native outcome transport".to_owned()),
                            branch: BranchName::try_from("codex/native-feature-log".to_owned())?,
                            worktree: self.project.clone(),
                        })
                        .await?;
                    let task = ledger
                        .create(CreateTask {
                            feature: self.feature.clone(),
                            task: TaskId::try_from("implementation".to_owned())?,
                            actor,
                            objective: Note::Empty,
                            acceptance: vec![Note::Empty],
                            dependencies: Vec::new(),
                            workspace: Workspace::Git {
                                branch: BranchName::try_from("codex/native-worker".to_owned())?,
                                path: self.worker.clone(),
                            },
                            progress: Self::progress(),
                        })
                        .await?;
                    let mut task = ledger
                        .claim(ClaimTask {
                            worker_id: WorkerId::EXAMPLE,
                            feature: self.feature.clone(),
                            task: task.common.id,
                            expected_revision: task.common.revision,
                            agent,
                            ttl_seconds: LeaseSeconds::TEN_MINUTES,
                        })
                        .await?;
                    let first = CheckpointOutcome {
                        id: OutcomeId::try_from("first".to_owned())?,
                        summary: Note::from("Implemented the first behavior".to_owned()),
                        detail: Note::Empty,
                    };
                    let second = CheckpointOutcome {
                        id: OutcomeId::try_from("second".to_owned())?,
                        summary: first.summary.clone(),
                        detail: Note::from("Distinct implementation milestone".to_owned()),
                    };
                    let duplicate = WorkerUpdate {
                        worker_id: WorkerId::EXAMPLE,
                        feature: self.feature.clone(),
                        task: task.common.id.clone(),
                        expected_revision: task.common.revision,
                        agent,
                        attempt: task.common.attempt,
                        action: WorkerAction::Checkpoint {
                            outcomes: vec![first.clone(), first.clone()],
                            commit: self.checkpoint.clone(),
                            ttl_seconds: LeaseSeconds::TEN_MINUTES,
                            progress: Self::progress(),
                        },
                    };
                    assert!(ledger.update(duplicate).await.is_err());
                    assert_eq!(ledger.task(&task.common.id).await?.task, task);
                    for outcomes in [
                        vec![first.clone()],
                        vec![first.clone(), second.clone()],
                        vec![first, second],
                    ] {
                        task = ledger
                            .update(WorkerUpdate {
                                worker_id: WorkerId::EXAMPLE,
                                feature: self.feature.clone(),
                                task: task.common.id,
                                expected_revision: task.common.revision,
                                agent,
                                attempt: task.common.attempt,
                                action: WorkerAction::Checkpoint {
                                    outcomes,
                                    commit: self.checkpoint.clone(),
                                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                                    progress: Self::progress(),
                                },
                            })
                            .await?;
                    }
                    task = ledger
                        .update(WorkerUpdate {
                            worker_id: WorkerId::EXAMPLE,
                            feature: self.feature.clone(),
                            task: task.common.id,
                            expected_revision: task.common.revision,
                            agent,
                            attempt: task.common.attempt,
                            action: WorkerAction::Ready {
                                progress: Self::progress(),
                            },
                        })
                        .await?;
                    assert!(
                        workbench
                            .observe()
                            .await?
                            .workflow(self.feature.clone())
                            .await?
                            .feature_log
                            .entries()
                            .is_empty()
                    );
                    ledger
                        .coordinate(CoordinatorUpdate {
                            feature: self.feature.clone(),
                            task: task.common.id,
                            expected_revision: task.common.revision,
                            actor,
                            action: CoordinatorAction::Integrate {
                                commit: self.checkpoint.clone(),
                            },
                        })
                        .await?;
                    Ok(ledger.info().path)
                })
        }
        fn snapshot(path: &Path) -> anyhow::Result<Vec<u8>> {
            use std::fs;
            use std::io::ErrorKind;
            match fs::read(path) {
                Ok(bytes) => Ok(bytes),
                Err(error) if error.kind() == ErrorKind::NotFound => Ok(Vec::new()),
                Err(error) => Err(error.into()),
            }
        }
        fn invoke(self) -> anyhow::Result<()> {
            use super::{DesktopLaunch, dashboard_workflow};
            use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
            use meta_cortex_workbench::{FeatureLogEntry, SequenceProvenance};
            use std::sync::Arc;
            use tauri::WebviewWindowBuilder;
            use tauri::ipc::{CallbackFn, InvokeBody};
            use tauri::test::{
                INVOKE_KEY, get_ipc_response, mock_builder, mock_context, noop_assets,
            };
            use tauri::webview::InvokeRequest;
            #[derive(serde::Serialize)]
            struct WorkflowInvocation {
                feature: FeatureId,
            }
            #[derive(serde::Deserialize)]
            struct ObservedLog {
                feature_log: Vec<FeatureLogEntry>,
            }
            let ledger = self.populate()?;
            let before = Self::snapshot(&ledger)?;
            let wal = ledger.with_extension("db-wal");
            let before_wal = Self::snapshot(&wal)?;
            let launch = DesktopLaunch {
                workbench: self.workbench()?,
            };
            let expected = launch.blocking_workflow(self.feature.clone())?;
            let app = mock_builder()
                .manage(Arc::new(launch))
                .invoke_handler(tauri::generate_handler![dashboard_workflow])
                .build(mock_context(noop_assets()))?;
            let webview = WebviewWindowBuilder::new(&app, "main", Default::default()).build()?;
            let response = get_ipc_response(
                &webview,
                InvokeRequest {
                    cmd: "dashboard_workflow".to_owned(),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse()?,
                    body: InvokeBody::Json(serde_json::to_value(WorkflowInvocation {
                        feature: self.feature.clone(),
                    })?),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.to_owned(),
                },
            )
            .map_err(|error| anyhow::anyhow!("native outcome IPC failed: {error}"))?
            .deserialize::<ObservedLog>()?;
            assert_eq!(response.feature_log, expected.feature_log.entries());
            let [first, second] = response.feature_log.as_slice() else {
                anyhow::bail!("expected two native milestones");
            };
            assert_eq!(first.id.to_string(), "first");
            assert_eq!(second.id.to_string(), "second");
            assert_eq!(first.summary, second.summary);
            assert_eq!(
                first.checkpoint.recorded.actor,
                AgentId::Development(DevelopmentAgent::RustDev)
            );
            assert_eq!(
                first.integration.recorded.actor,
                AgentId::Gizmo(GizmoAgent::Gizmo)
            );
            assert_eq!(
                first.integration.recorded.provenance,
                SequenceProvenance::CommittedAppend
            );
            assert!(first.first_recorded.sequence < first.checkpoint.recorded.sequence);
            assert!(first.checkpoint.recorded.sequence < first.integration.recorded.sequence);
            assert_eq!(before, Self::snapshot(&ledger)?);
            assert_eq!(before_wal, Self::snapshot(&wal)?);
            Ok(())
        }
    }
    #[test]
    fn native_feature_log_ipc_preserves_integrated_milestones_without_writes() -> anyhow::Result<()>
    {
        FeatureLogScenario::new()?.invoke()
    }

    #[test]
    fn committed_frontend_schema_matches_the_rust_contract() -> anyhow::Result<()> {
        let committed: serde_json::Value =
            serde_json::from_str(include_str!("../../frontend/contracts.schema.json"))?;
        assert_eq!(
            committed,
            schemars::schema_for!(DesktopContract).as_value().clone(),
            "regenerate frontend/contracts.schema.json with `cargo run --example contracts`"
        );
        Ok(())
    }
}
