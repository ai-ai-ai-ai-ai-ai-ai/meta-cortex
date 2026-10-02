use super::{DashboardError, DashboardReport, DashboardView, NativeExitCode};
use meta_cortex_workbench::model::{Event, Feature, Task};
use meta_cortex_workbench::request::TaskQuery;
use meta_cortex_workbench::values::{FeatureId, Note};
use meta_cortex_workbench::{FeatureFlow, HistoryPage, Page, PageIndex, TaskPage, Workbench};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::sync::Arc;
use tauri::{State, async_runtime};
use tokio::runtime::Builder;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum DesktopRead {
    Initial,
    Features { page: PageIndex },
    Workflow { feature: FeatureId, page: PageIndex },
    Task { query: TaskQuery },
    History { query: TaskQuery, page: PageIndex },
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "kind", content = "value")]
pub enum DesktopContent {
    Features(Page<Feature>),
    Workflow(FeatureFlow),
    Task(Box<Task>),
    History(Page<Event>),
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct DesktopSelection {
    pub view: DashboardView,
    pub page: PageIndex,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct DesktopReply {
    pub selection: DesktopSelection,
    pub content: DesktopContent,
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
    pub request: DesktopRead,
    pub reply: DesktopReply,
    pub failure: DesktopFailure,
}
pub struct DesktopLaunch {
    pub(super) workbench: Workbench,
    pub(super) view: DashboardView,
    pub(super) page: PageIndex,
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
    fn selection(&self, request: DesktopRead) -> DesktopSelection {
        match request {
            DesktopRead::Initial => DesktopSelection {
                view: self.view.clone(),
                page: self.page,
            },
            DesktopRead::Features { page } => DesktopSelection {
                view: DashboardView::Features,
                page,
            },
            DesktopRead::Workflow { feature, page } => DesktopSelection {
                view: DashboardView::Tasks { feature },
                page,
            },
            DesktopRead::Task { query } => DesktopSelection {
                view: DashboardView::Task { query },
                page: PageIndex::FIRST,
            },
            DesktopRead::History { query, page } => DesktopSelection {
                view: DashboardView::History { query },
                page,
            },
        }
    }
    async fn read(&self, request: DesktopRead) -> Result<DesktopReply, DashboardError> {
        let observation = self.workbench.observe().await?;
        let selection = self.selection(request);
        let content = match &selection.view {
            DashboardView::Features => {
                DesktopContent::Features(observation.features(selection.page).await?)
            }
            DashboardView::Tasks { feature } => DesktopContent::Workflow(
                observation
                    .flow(TaskPage {
                        feature: feature.clone(),
                        page: selection.page,
                    })
                    .await?,
            ),
            DashboardView::Task { query } => {
                DesktopContent::Task(Box::new(observation.task(query.clone()).await?))
            }
            DashboardView::History { query } => DesktopContent::History(
                observation
                    .history(HistoryPage {
                        feature: query.feature.clone(),
                        task: query.task.clone(),
                        page: selection.page,
                    })
                    .await?,
            ),
        };
        Ok(DesktopReply { selection, content })
    }
    fn blocking_read(&self, request: DesktopRead) -> Result<DesktopReply, DashboardError> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(self.read(request))
    }
}
// Tauri's command adapter injects managed State separately from the typed IPC request.
#[tauri::command(async)]
fn dashboard_read(
    state: State<'_, Arc<DesktopLaunch>>,
    request: DesktopRead,
) -> impl Future<Output = Result<DesktopReply, DesktopFailure>> + Send + 'static {
    let owner = Arc::clone(state.inner());
    async move {
        async_runtime::spawn_blocking(move || owner.blocking_read(request))
            .await
            .map_err(DashboardError::from)
            .flatten()
            .map_err(DesktopFailure::from)
    }
}
