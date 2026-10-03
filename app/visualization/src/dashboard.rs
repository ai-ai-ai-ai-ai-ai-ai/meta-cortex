mod desktop;
mod presentation;
mod snapshot;

use derive_more::{Display, From};
use meta_cortex_workbench::request::TaskQuery;
use meta_cortex_workbench::values::{FeatureId, Note};
use meta_cortex_workbench::{LedgerError, PageIndex, Workbench};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::io;
use thiserror::Error;

pub use desktop::{
    DesktopContent, DesktopContract, DesktopFailure, DesktopLaunch, DesktopRead, DesktopReply,
    DesktopSelection,
};

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub enum DashboardMode {
    Desktop,
    Snapshot,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum DashboardView {
    Features,
    Tasks { feature: FeatureId },
    Task { query: TaskQuery },
    History { query: TaskQuery },
}
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct DashboardRequest {
    pub mode: DashboardMode,
    pub view: DashboardView,
    pub page: PageIndex,
}
#[derive(Serialize)]
pub struct DashboardReport {
    pub content: Note,
}
#[derive(Debug, Error)]
pub enum DashboardError {
    #[error(transparent)]
    Ledger(#[from] LedgerError),
    #[error("native dashboard failed: {0}")]
    Native(#[from] tauri::Error),
    #[error("dashboard runtime failed: {0}")]
    Runtime(#[from] io::Error),
    #[error("native dashboard exited with status {0}")]
    Exit(NativeExitCode),
}
#[derive(Debug, Display, From)]
pub struct NativeExitCode(i32);

pub enum DashboardExecution {
    Snapshot(DashboardReport),
    Desktop(DesktopLaunch),
}
pub struct Dashboard {
    workbench: Workbench,
}
impl From<Workbench> for Dashboard {
    fn from(workbench: Workbench) -> Self {
        Self { workbench }
    }
}
impl Dashboard {
    pub async fn execute(
        self,
        request: DashboardRequest,
    ) -> Result<DashboardExecution, DashboardError> {
        match request.mode {
            DashboardMode::Snapshot => {
                let route = snapshot::Route::from(request.view).with_page(request.page);
                let content = route.load(&self.workbench.observe().await?).await?;
                Ok(DashboardExecution::Snapshot(DashboardReport {
                    content: content.text(&snapshot::SnapshotContext { route }),
                }))
            }
            DashboardMode::Desktop => {
                self.workbench.observe().await?;
                Ok(DashboardExecution::Desktop(DesktopLaunch {
                    workbench: self.workbench,
                    view: request.view,
                    page: request.page,
                }))
            }
        }
    }
}
