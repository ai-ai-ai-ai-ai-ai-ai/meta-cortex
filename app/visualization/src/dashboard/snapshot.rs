use super::DashboardView;
use super::presentation::Content;
use derive_more::Display;
use meta_cortex_workbench::request::TaskQuery;
use meta_cortex_workbench::values::FeatureId;
use meta_cortex_workbench::{HistoryPage, LedgerError, Observation, PageIndex, TaskPage};

pub(super) enum Route {
    Features { page: PageIndex },
    Tasks { feature: FeatureId, page: PageIndex },
    Task { query: TaskQuery },
    History { query: TaskQuery, page: PageIndex },
}
#[derive(Default, Clone, Copy, Debug, Display, PartialEq, Eq, derive_more::From)]
pub(super) struct Selection(usize);
impl Selection {
    pub const FIRST: Self = Self(0);
}
pub(super) struct SnapshotContext {
    pub route: Route,
}
impl Default for SnapshotContext {
    fn default() -> Self {
        Self {
            route: Route::Features {
                page: PageIndex::FIRST,
            },
        }
    }
}
impl SnapshotContext {
    pub fn route(&self) -> &Route {
        &self.route
    }
    pub fn selection(&self) -> Selection {
        Selection::FIRST
    }
}
impl From<DashboardView> for Route {
    fn from(view: DashboardView) -> Self {
        match view {
            DashboardView::Features => Self::Features {
                page: PageIndex::FIRST,
            },
            DashboardView::Tasks { feature } => Self::Tasks {
                feature,
                page: PageIndex::FIRST,
            },
            DashboardView::Task { query } => Self::Task { query },
            DashboardView::History { query } => Self::History {
                query,
                page: PageIndex::FIRST,
            },
        }
    }
}
impl Route {
    pub fn page(&self) -> PageIndex {
        match self {
            Self::Features { page } | Self::Tasks { page, .. } | Self::History { page, .. } => {
                *page
            }
            Self::Task { .. } => PageIndex::FIRST,
        }
    }
    #[must_use]
    pub fn with_page(mut self, value: PageIndex) -> Self {
        match &mut self {
            Self::Features { page } | Self::Tasks { page, .. } | Self::History { page, .. } => {
                *page = value
            }
            Self::Task { .. } => {}
        }
        self
    }
    pub async fn load(&self, observation: &Observation) -> Result<Content, LedgerError> {
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
            Self::Task { query } => Ok(Content::Task(Box::new(
                observation.task(query.clone()).await?,
            ))),
            Self::History { query, page } => Ok(Content::History(
                observation
                    .history(HistoryPage {
                        feature: query.feature.clone(),
                        task: query.task.clone(),
                        page: *page,
                    })
                    .await?,
            )),
        }
    }
}
