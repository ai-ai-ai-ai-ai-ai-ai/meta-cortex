use super::{DashboardError, DashboardReport, NativeExitCode};
use meta_cortex_workbench::values::Note;
use meta_cortex_workbench::{FeatureSummary, Page, PageIndex, Workbench};
use schemars::JsonSchema;
use serde::Serialize;
use std::future::Future;
use std::sync::Arc;
use tauri::{State, async_runtime};
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
    pub failure: DesktopFailure,
}
pub struct DesktopLaunch {
    pub(super) workbench: Workbench,
}
impl DesktopLaunch {
    /// Run only after async preparation returns to the executable's original main thread.
    pub fn run(self) -> Result<DashboardReport, DashboardError> {
        let app = tauri::Builder::default()
            .manage(Arc::new(self))
            .invoke_handler(tauri::generate_handler![dashboard_read])
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
