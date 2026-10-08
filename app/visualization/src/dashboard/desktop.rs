use super::{DashboardError, DashboardReport, NativeExitCode};
use meta_cortex_workbench::values::Note;
use meta_cortex_workbench::{
    FeatureCard, FeatureWorkflow, Page, PageEnd, PageIndex, RepositoryCard, RepositorySelection,
    StorageObservation, StoredFeatureSelection,
};
use schemars::JsonSchema;
use serde::Serialize;
use std::future::Future;
use std::sync::Arc;
use tauri::{State, async_runtime};
use tauri_plugin_opener::init;
use tokio::runtime::Builder;

/// The most recently active features with their totals, held work, outcomes and pull requests.
#[derive(Debug, Serialize, JsonSchema)]
pub struct DesktopCatalogReply {
    pub repositories: Page<RepositoryCard>,
}
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
    pub catalog: DesktopCatalogReply,
    pub selection: StoredFeatureSelection,
    pub workflow: FeatureWorkflow,
    pub failure: DesktopFailure,
}
pub struct DesktopLaunch {
    storage: StorageObservation,
}
impl DesktopLaunch {
    pub fn discover() -> Result<Self, DashboardError> {
        Ok(Self {
            storage: StorageObservation::discover()?,
        })
    }
    /// Run only after async preparation returns to the executable's original main thread.
    pub fn run(self) -> Result<DashboardReport, DashboardError> {
        let app = tauri::Builder::default()
            .plugin(init())
            .manage(Arc::new(self))
            .invoke_handler(tauri::generate_handler![
                dashboard_read,
                dashboard_features,
                dashboard_workflow,
                dashboard_upgrade
            ])
            .build(tauri::generate_context!())?;
        match app.run_return(|_handle, _event| {}) {
            0 => {}
            code => return Err(DashboardError::Exit(NativeExitCode::from(code))),
        }
        Ok(DashboardReport {
            content: Note::from("Homeostat closed".to_owned()),
        })
    }
    async fn features(
        &self,
        repository: RepositorySelection,
    ) -> Result<DesktopReply, DashboardError> {
        let catalog = self
            .storage
            .observe(repository)?
            .summaries(PageIndex::FIRST)
            .await?;
        Ok(DesktopReply {
            features: catalog.features,
        })
    }
    fn blocking_workflow(
        &self,
        request: StoredFeatureSelection,
    ) -> Result<FeatureWorkflow, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                Ok(self
                    .storage
                    .observe(request.repository)?
                    .workflow(request.feature)
                    .await?)
            })
    }
    fn blocking_upgrade(
        &self,
        request: StoredFeatureSelection,
    ) -> Result<FeatureWorkflow, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let feature = request.feature.clone();
                Ok(self
                    .storage
                    .upgrade(request)
                    .await?
                    .workflow(feature)
                    .await?)
            })
    }
    fn blocking_features(
        &self,
        repository: RepositorySelection,
    ) -> Result<DesktopReply, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(self.features(repository))
    }
    fn blocking_read(&self) -> Result<DesktopCatalogReply, DashboardError> {
        Ok(DesktopCatalogReply {
            repositories: Page {
                records: self.storage.repositories()?,
                end: PageEnd::Complete,
            },
        })
    }
}
// Tauri's command adapter injects managed State as the command's only argument.
#[tauri::command(async)]
fn dashboard_read(
    state: State<'_, Arc<DesktopLaunch>>,
) -> impl Future<Output = Result<DesktopCatalogReply, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_read())
            .await
            .map_err(DashboardError::from)
            .flatten()
            .map_err(DesktopFailure::from)
    }
}

// Tauri injects State independently of the selected repository transport record.
#[tauri::command(async)]
fn dashboard_features(
    state: State<'_, Arc<DesktopLaunch>>,
    repository: RepositorySelection,
) -> impl Future<Output = Result<DesktopReply, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_features(repository))
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
    selection: StoredFeatureSelection,
) -> impl Future<Output = Result<FeatureWorkflow, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_workflow(selection))
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
    selection: StoredFeatureSelection,
) -> impl Future<Output = Result<FeatureWorkflow, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_upgrade(selection))
            .await
            .map_err(DashboardError::from)
            .flatten()
            .map_err(DesktopFailure::from)
    }
}

#[cfg(test)]
mod tests {
    use super::{DesktopContract, DesktopLaunch};
    use meta_cortex_workbench::{DataDirectory, StorageObservation};
    #[test]
    fn missing_global_home_produces_empty_native_catalog_without_creation() -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        let home = directory.path().join("absent-home");
        let launch = DesktopLaunch {
            storage: StorageObservation::from(DataDirectory::from(home.clone())),
        };
        assert!(launch.blocking_read()?.repositories.records.is_empty());
        assert!(!home.exists());
        Ok(())
    }

    /// Tauri MockRuntime calls the actual command against real Turso after deleting its checkout.
    #[test]
    fn actual_workflow_ipc_reads_existing_turso_without_writes() -> anyhow::Result<()> {
        use super::{
            DesktopLaunch, dashboard_features, dashboard_read, dashboard_upgrade,
            dashboard_workflow,
        };
        use meta_cortex_workbench::values::FeatureId;
        use meta_cortex_workbench::{
            DataDirectory, RepositoryId, RepositoryName, RepositorySelection, StorageObservation,
            StoredFeatureSelection,
        };
        use std::fs;
        use std::io::ErrorKind;
        use std::sync::Arc;
        use tauri::WebviewWindowBuilder;
        use tauri::ipc::{CallbackFn, InvokeBody};
        use tauri::test::{INVOKE_KEY, get_ipc_response, mock_builder, mock_context, noop_assets};
        use tauri::webview::InvokeRequest;
        #[derive(serde::Serialize)]
        struct WorkflowInvocation {
            selection: StoredFeatureSelection,
        }
        use git2::{Repository, RepositoryInitOptions, Signature};
        use meta_cortex_workbench::Workbench;
        use meta_cortex_workbench::agents::{AgentId, GizmoAgent};
        use meta_cortex_workbench::model::{Progress, Workspace};
        use meta_cortex_workbench::request::{CreateTask, InitFeature};
        use meta_cortex_workbench::values::{BranchName, Extensions, Note, TaskId};
        use tokio::runtime::Builder;
        let directory = tempfile::tempdir()?;
        let project = directory.path().join("deleted-checkout");
        let data = directory.path().join("data");
        let mut options = RepositoryInitOptions::new();
        options.initial_head("codex/ipc");
        let git = Repository::init_opts(&project, &options)?;
        let tree = git.find_tree(git.index()?.write_tree()?)?;
        let signature = Signature::now("IPC Fixture", "ipc@example.invalid")?;
        git.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])?;
        drop(tree);
        drop(git);
        let workbench =
            Workbench::discover(&project)?.with_data_directory(DataDirectory::from(data.clone()));
        let feature = FeatureId::try_from("ipc-feature".to_owned())?;
        let ledger = Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let mut ledger = workbench
                    .initialize(InitFeature {
                        feature: feature.clone(),
                        objective: Note::from("Recorded IPC feature".to_owned()),
                        branch: BranchName::try_from("codex/ipc".to_owned())?,
                        worktree: project.clone(),
                    })
                    .await?;
                ledger
                    .create(CreateTask {
                        feature: feature.clone(),
                        task: TaskId::try_from("recorded-task".to_owned())?,
                        actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                        objective: Note::from("Recorded task".to_owned()),
                        acceptance: vec![Note::from("Observed through IPC".to_owned())],
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
                Ok::<_, anyhow::Error>(ledger.info().path)
            })?;
        let repository = RepositorySelection {
            name: RepositoryName::try_from("deleted-checkout".to_owned())?,
            repository_id: RepositoryId::try_from(
                fs::read_to_string(project.join(".meta-cortex/repository-id"))?
                    .trim()
                    .to_owned(),
            )?,
        };
        fs::remove_dir_all(&project)?;
        let before = fs::read(&ledger)?;
        let wal = ledger.with_extension("db-wal");
        let before_wal = match fs::read(&wal) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(error.into()),
        };
        let launch = DesktopLaunch {
            storage: StorageObservation::from(DataDirectory::from(data)),
        };
        let selection = StoredFeatureSelection {
            repository: repository.clone(),
            feature,
        };
        let expected_workflow = serde_json::to_value(launch.blocking_workflow(selection.clone())?)?;
        let expected_features =
            serde_json::to_value(launch.blocking_features(repository.clone())?)?;
        let expected_catalog = serde_json::to_value(launch.blocking_read()?)?;
        #[derive(serde::Serialize)]
        struct RepositoryInvocation {
            repository: RepositorySelection,
        }
        #[derive(serde::Serialize)]
        struct CatalogInvocation {}
        // These are Tauri-owned request/response edge values, not application records.
        struct IpcCase {
            request: InvokeRequest,
            expected: serde_json::Value,
        }
        let app = mock_builder()
            .manage(Arc::new(launch))
            .invoke_handler(tauri::generate_handler![
                dashboard_read,
                dashboard_features,
                dashboard_workflow,
                dashboard_upgrade
            ])
            .build(mock_context(noop_assets()))?;
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default()).build()?;
        for case in [
            IpcCase {
                request: InvokeRequest {
                    cmd: "dashboard_read".to_owned(),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse()?,
                    body: InvokeBody::Json(serde_json::to_value(CatalogInvocation {})?),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.to_owned(),
                },
                expected: expected_catalog,
            },
            IpcCase {
                request: InvokeRequest {
                    cmd: "dashboard_features".to_owned(),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse()?,
                    body: InvokeBody::Json(serde_json::to_value(RepositoryInvocation {
                        repository,
                    })?),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.to_owned(),
                },
                expected: expected_features,
            },
            IpcCase {
                request: InvokeRequest {
                    cmd: "dashboard_workflow".to_owned(),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse()?,
                    body: InvokeBody::Json(serde_json::to_value(WorkflowInvocation {
                        selection: selection.clone(),
                    })?),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.to_owned(),
                },
                expected: expected_workflow.clone(),
            },
            IpcCase {
                request: InvokeRequest {
                    cmd: "dashboard_upgrade".to_owned(),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse()?,
                    body: InvokeBody::Json(serde_json::to_value(WorkflowInvocation { selection })?),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.to_owned(),
                },
                expected: expected_workflow,
            },
        ] {
            let response = get_ipc_response(&webview, case.request)
                .map_err(|error| anyhow::anyhow!("IPC failed: {error}"))?
                .deserialize::<serde_json::Value>()?;
            assert_eq!(
                response, case.expected,
                "actual IPC handler must expose the public Workbench projection"
            );
        }
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
        assert!(!project.exists());
        println!(
            "Tauri MockRuntime IPC -> actual catalog/features/workflow/upgrade commands -> Workbench -> real Turso; database and WAL bytes unchanged. No native window render asserted."
        );
        Ok(())
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
