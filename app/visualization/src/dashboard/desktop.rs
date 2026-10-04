use super::{DashboardError, DashboardReport, NativeExitCode};
use meta_cortex_workbench::values::{FeatureId, Note};
use meta_cortex_workbench::{FeatureSummary, FeatureWorkflow, Page, PageIndex, Workbench};
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
    pub features: Page<FeatureSummary>,
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
            .invoke_handler(tauri::generate_handler![dashboard_read, dashboard_workflow])
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
        Ok(DesktopReply {
            features: observation.summaries(PageIndex::FIRST).await?,
        })
    }
    fn blocking_workflow(&self, feature: FeatureId) -> Result<FeatureWorkflow, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async { Ok(self.workbench.observe().await?.workflow(feature).await?) })
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

#[cfg(test)]
mod tests {
    use super::DesktopContract;

    /// Explicitly invoked against a real repository, never a native-window claim.
    #[test]
    #[ignore = "requires explicit real repository, feature, ledger and output paths"]
    fn actual_workflow_ipc_reads_existing_turso_without_writes() -> anyhow::Result<()> {
        use super::{DesktopLaunch, dashboard_read, dashboard_workflow};
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
            .invoke_handler(tauri::generate_handler![dashboard_read, dashboard_workflow])
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
