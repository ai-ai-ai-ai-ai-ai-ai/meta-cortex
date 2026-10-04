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
