mod navigation;
mod presentation;
mod terminal;

use meta_cortex_workbench::request::TaskQuery;
use meta_cortex_workbench::values::{FeatureId, Note};
use meta_cortex_workbench::{
    HistoryPage, LedgerError, Observation, PageIndex, TaskPage, Workbench,
};
use navigation::{Navigation, Route};
use presentation::Content;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::io;
use terminal::TerminalSession;
use thiserror::Error;

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub enum DashboardMode {
    Interactive,
    Snapshot,
}
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
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
    #[error("terminal operation failed: {0}")]
    Terminal(#[from] io::Error),
    #[error(
        "Interactive dashboard requires a terminal on stdin and stdout; use mode: Snapshot for redirected output"
    )]
    TerminalRequired,
}

pub struct Dashboard {
    workbench: Workbench,
    navigation: Navigation,
}
impl From<Workbench> for Dashboard {
    fn from(workbench: Workbench) -> Self {
        Self {
            workbench,
            navigation: Navigation::default(),
        }
    }
}
impl Dashboard {
    pub async fn execute(
        mut self,
        request: DashboardRequest,
    ) -> Result<DashboardReport, DashboardError> {
        tracing::debug!(mode = ?request.mode, "Workbench dashboard started");
        self.navigation = Navigation::from(request.view).with_page(request.page);
        match request.mode {
            DashboardMode::Snapshot => {
                let content = self.load().await?;
                Ok(DashboardReport {
                    content: content.text(&self.navigation),
                })
            }
            DashboardMode::Interactive => self.run().await,
        }
    }
    async fn load(&self) -> Result<Content, LedgerError> {
        self.navigation
            .route()
            .load(&self.workbench.observe().await?)
            .await
    }
    async fn run(mut self) -> Result<DashboardReport, DashboardError> {
        let mut session = TerminalSession::open()?;
        loop {
            let content = match self.load().await {
                Ok(content) => content,
                Err(error) => Content::Error(error),
            };
            session.draw(terminal::TerminalFrame {
                text: content.text(&self.navigation),
                scroll: self.navigation.scroll(),
            })?;
            let action = session.action()?;
            match self.navigation.apply(navigation::NavigationInput {
                action,
                content: &content,
            }) {
                navigation::NavigationOutcome::Continue(navigation) => self.navigation = navigation,
                navigation::NavigationOutcome::Exit => break,
            }
        }
        session.close()?;
        Ok(DashboardReport {
            content: Note::from("Workbench dashboard closed".to_owned()),
        })
    }
}
impl Route {
    async fn load(&self, observation: &Observation) -> Result<Content, LedgerError> {
        match self {
            Self::Features { page } => Ok(Content::Features(observation.features(*page).await?)),
            Self::Tasks { feature, page } => Ok(Content::Tasks(
                observation
                    .tasks(TaskPage {
                        feature: feature.clone(),
                        page: *page,
                    })
                    .await?,
            )),
            Self::Task { query } => Ok(Content::Task(
                observation
                    .task(TaskQuery {
                        feature: query.feature.clone(),
                        task: query.task.clone(),
                    })
                    .await?,
            )),
            Self::History { query, page } => Ok(Content::History(
                observation
                    .history(HistoryPage {
                        feature: query.feature.clone(),
                        task: query.task.clone(),
                        page: *page,
                    })
                    .await?,
            )),
            Self::Event { event, .. } => Ok(Content::Event(*event.clone())),
        }
    }
}
