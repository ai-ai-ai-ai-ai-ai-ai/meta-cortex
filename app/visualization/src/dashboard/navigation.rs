use super::DashboardView;
use super::presentation::Content;
use derive_more::Display;
use meta_cortex_workbench::model::Event;
use meta_cortex_workbench::request::TaskQuery;
use meta_cortex_workbench::values::FeatureId;
use meta_cortex_workbench::{PageEnd, PageIndex};
use std::cmp::Ordering;

pub(super) enum Route {
    Features { page: PageIndex },
    Tasks { feature: FeatureId, page: PageIndex },
    Task { query: TaskQuery },
    History { query: TaskQuery, page: PageIndex },
    Event { event: Box<Event>, page: PageIndex },
}
#[derive(
    Default, Clone, Copy, Debug, Display, PartialEq, Eq, PartialOrd, Ord, derive_more::From,
)]
pub(super) struct Selection(usize);
impl Selection {
    pub const FIRST: Self = Self(0);
    #[must_use]
    fn move_by(self, direction: Direction) -> Self {
        let Self(value) = self;
        match direction {
            Direction::Up => Self(value.saturating_sub(1)),
            Direction::Down => Self(value.saturating_add(1)),
        }
    }
    pub fn lookup<'a, T>(&self, records: &'a [T]) -> Selected<'a, T> {
        let Self(value) = self;
        match records.get(*value) {
            Some(record) => Selected::Record(record),
            None => Selected::Empty,
        }
    }
}
pub(super) enum Selected<'a, T> {
    Record(&'a T),
    Empty,
}
#[derive(Clone, Copy)]
pub(super) enum Direction {
    Up,
    Down,
}
pub(super) enum Action {
    Select(Direction),
    Scroll(Direction),
    Enter,
    Back,
    History,
    NextPage,
    PreviousPage,
    Refresh,
    Quit,
}
pub(super) struct NavigationInput<'a> {
    pub action: Action,
    pub content: &'a Content,
}
pub(super) enum NavigationOutcome {
    Continue(Navigation),
    Exit,
}
pub(super) struct Navigation {
    route: Route,
    selection: Selection,
    scroll: Scroll,
}
#[derive(Default, Clone, Copy)]
pub(super) struct Scroll(u16);
impl Scroll {
    #[must_use]
    fn move_by(self, direction: Direction) -> Self {
        let Self(value) = self;
        match direction {
            Direction::Up => Self(value.saturating_sub(1)),
            Direction::Down => Self(value.saturating_add(1)),
        }
    }
    pub fn lines(self) -> u16 {
        let Self(value) = self;
        value
    }
}
impl Default for Navigation {
    fn default() -> Self {
        Self {
            route: Route::Features {
                page: PageIndex::FIRST,
            },
            selection: Selection::FIRST,
            scroll: Scroll::default(),
        }
    }
}
impl From<DashboardView> for Navigation {
    fn from(view: DashboardView) -> Self {
        let route = match view {
            DashboardView::Features => Route::Features {
                page: PageIndex::FIRST,
            },
            DashboardView::Tasks { feature } => Route::Tasks {
                feature,
                page: PageIndex::FIRST,
            },
            DashboardView::Task { query } => Route::Task { query },
            DashboardView::History { query } => Route::History {
                query,
                page: PageIndex::FIRST,
            },
        };
        Self {
            route,
            ..Self::default()
        }
    }
}
impl Navigation {
    pub fn route(&self) -> &Route {
        &self.route
    }
    pub fn selection(&self) -> Selection {
        self.selection
    }
    pub fn scroll(&self) -> Scroll {
        self.scroll
    }
    #[must_use]
    pub fn with_page(mut self, page: PageIndex) -> Self {
        self.route = self.route.with_page(page);
        self
    }
    #[must_use]
    pub fn apply(mut self, input: NavigationInput<'_>) -> NavigationOutcome {
        let NavigationInput { action, content } = input;
        match action {
            Action::Quit => return NavigationOutcome::Exit,
            Action::Select(direction) => {
                let selection = self
                    .selection
                    .move_by(direction)
                    .min(content.last_selection());
                match selection.cmp(&self.selection) {
                    Ordering::Equal => {}
                    Ordering::Less | Ordering::Greater => {
                        self.scroll = self.scroll.move_by(direction)
                    }
                }
                self.selection = selection;
            }
            Action::Scroll(direction) => self.scroll = self.scroll.move_by(direction),
            Action::Enter => self = self.enter(content),
            Action::Back => self = self.back(),
            Action::History => self = self.history(),
            Action::NextPage => {
                self = self.page(PageMove {
                    end: content.end(),
                    direction: Direction::Down,
                })
            }
            Action::PreviousPage => {
                self = self.page(PageMove {
                    end: PageEnd::More,
                    direction: Direction::Up,
                })
            }
            Action::Refresh => {}
        }
        NavigationOutcome::Continue(self)
    }
    #[must_use]
    fn enter(mut self, content: &Content) -> Self {
        let route = content.enter(self.selection);
        if let SelectedRoute::Route(route) = route {
            self.route = match route {
                route @ Route::Event { .. } => route.with_page(self.route.page()),
                route @ (Route::Features { .. }
                | Route::Tasks { .. }
                | Route::Task { .. }
                | Route::History { .. }) => route,
            };
            self.selection = Selection::FIRST;
            self.scroll = Scroll::default();
        }
        self
    }
    #[must_use]
    fn back(mut self) -> Self {
        self.route = match self.route {
            Route::Features { page } => Route::Features { page },
            Route::Tasks { .. } => Route::Features {
                page: PageIndex::FIRST,
            },
            Route::Task { query } | Route::History { query, .. } => Route::Tasks {
                feature: query.feature,
                page: PageIndex::FIRST,
            },
            Route::Event { event, page } => Route::History {
                query: TaskQuery {
                    feature: event.task.feature,
                    task: event.task.id,
                },
                page,
            },
        };
        self.selection = Selection::FIRST;
        self.scroll = Scroll::default();
        self
    }
    #[must_use]
    fn history(mut self) -> Self {
        if let Route::Task { query } = self.route {
            self.route = Route::History {
                query,
                page: PageIndex::FIRST,
            };
        }
        self.selection = Selection::FIRST;
        self.scroll = Scroll::default();
        self
    }
    #[must_use]
    fn page(mut self, request: PageMove) -> Self {
        let PageMove { end, direction } = request;
        let page = self.route.page();
        let page = match direction {
            Direction::Up => page.previous(),
            Direction::Down => match end {
                PageEnd::Complete => page,
                PageEnd::More => page.next(),
            },
        };
        self.route = self.route.with_page(page);
        self.selection = Selection::FIRST;
        self.scroll = Scroll::default();
        self
    }
}
struct PageMove {
    end: PageEnd,
    direction: Direction,
}
pub(super) enum SelectedRoute {
    Route(Route),
    Stay,
}
impl Route {
    pub fn page(&self) -> PageIndex {
        match self {
            Self::Features { page }
            | Self::Tasks { page, .. }
            | Self::History { page, .. }
            | Self::Event { page, .. } => *page,
            Self::Task { .. } => PageIndex::FIRST,
        }
    }
    #[must_use]
    fn with_page(self, page: PageIndex) -> Self {
        match self {
            Self::Features { .. } => Self::Features { page },
            Self::Tasks { feature, .. } => Self::Tasks { feature, page },
            Self::History { query, .. } => Self::History { query, page },
            Self::Task { query } => Self::Task { query },
            Self::Event { event, .. } => Self::Event { event, page },
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::super::DashboardView;
    use super::super::presentation::{Content, tests::Scenario};
    use super::{
        Action, Direction, Navigation, NavigationInput, NavigationOutcome, Route, Scroll, Selection,
    };
    use meta_cortex_workbench::model::Feature;
    use meta_cortex_workbench::request::TaskQuery;
    use meta_cortex_workbench::values::{BranchName, FeatureId, Note};
    use meta_cortex_workbench::versions::RecordVersion;
    use meta_cortex_workbench::{Page, PageEnd, PageIndex};
    use std::path::PathBuf;

    struct Interaction {
        navigation: Navigation,
        content: Content,
    }
    impl Interaction {
        #[must_use = "retain the updated interaction"]
        fn apply(mut self, action: Action) -> anyhow::Result<Self> {
            match self.navigation.apply(NavigationInput {
                action,
                content: &self.content,
            }) {
                NavigationOutcome::Continue(navigation) => self.navigation = navigation,
                NavigationOutcome::Exit => anyhow::bail!("unexpected exit"),
            }
            Ok(self)
        }
    }
    #[test]
    fn navigate_features_tasks_details_history_and_event_snapshot() -> anyhow::Result<()> {
        let feature = Feature {
            version: RecordVersion::CURRENT,
            id: FeatureId::try_from("feature".to_owned())?,
            objective: Note::from("Objective".to_owned()),
            branch: BranchName::try_from("codex/feature".to_owned())?,
            worktree: PathBuf::from("/project"),
        };
        let mut interaction = Interaction {
            navigation: Navigation::default(),
            content: Content::Features(Page {
                records: vec![feature],
                end: PageEnd::More,
            }),
        };
        interaction = interaction
            .apply(Action::NextPage)?
            .apply(Action::PreviousPage)?
            .apply(Action::Enter)?;
        assert!(matches!(
            interaction.navigation.route(),
            Route::Tasks { .. }
        ));
        interaction.content = Content::Tasks(Page {
            records: vec![Scenario::task()?],
            end: PageEnd::Complete,
        });
        interaction = interaction
            .apply(Action::Select(Direction::Down))?
            .apply(Action::Select(Direction::Up))?
            .apply(Action::Enter)?;
        assert!(matches!(interaction.navigation.route(), Route::Task { .. }));
        interaction.content = Content::Task(Scenario::task()?);
        interaction = interaction.apply(Action::History)?;
        assert!(matches!(
            interaction.navigation.route(),
            Route::History { .. }
        ));
        interaction.navigation = interaction.navigation.with_page(PageIndex::FIRST.next());
        interaction.content = Content::History(Page {
            records: vec![Scenario::event()?],
            end: PageEnd::More,
        });
        interaction = interaction.apply(Action::Enter)?;
        assert!(matches!(
            interaction.navigation.route(),
            Route::Event { .. }
        ));
        interaction = interaction.apply(Action::Back)?;
        assert_eq!(
            interaction.navigation.route().page(),
            PageIndex::FIRST.next()
        );
        interaction = interaction
            .apply(Action::Back)?
            .apply(Action::Back)?
            .apply(Action::Back)?;
        assert!(matches!(
            interaction.navigation.route(),
            Route::Features { .. }
        ));
        Ok(())
    }
    #[test]
    fn navigation_edges_and_snapshot_start_views() -> anyhow::Result<()> {
        assert_eq!(Selection::FIRST.move_by(Direction::Up), Selection::FIRST);
        assert_eq!(Scroll::default().move_by(Direction::Up).lines(), 0);
        let content = Content::Features(Page {
            records: vec![],
            end: PageEnd::Complete,
        });
        let interaction = Interaction {
            navigation: Navigation::default(),
            content,
        }
        .apply(Action::Enter)?
        .apply(Action::History)?
        .apply(Action::NextPage)?
        .apply(Action::Scroll(Direction::Down))?
        .apply(Action::Scroll(Direction::Up))?
        .apply(Action::Refresh)?;
        assert_eq!(interaction.navigation.route().page(), PageIndex::FIRST);
        assert!(matches!(
            interaction.navigation.apply(NavigationInput {
                action: Action::Quit,
                content: &interaction.content
            }),
            NavigationOutcome::Exit
        ));
        for view in [
            DashboardView::Features,
            DashboardView::Tasks {
                feature: Scenario::task()?.feature,
            },
            DashboardView::Task {
                query: TaskQuery {
                    feature: Scenario::task()?.feature,
                    task: Scenario::task()?.id,
                },
            },
            DashboardView::History {
                query: TaskQuery {
                    feature: Scenario::task()?.feature,
                    task: Scenario::task()?.id,
                },
            },
        ] {
            let navigation = Navigation::from(view).with_page(PageIndex::FIRST.next());
            let navigation = Interaction {
                navigation,
                content: Content::Task(Scenario::task()?),
            }
            .apply(Action::PreviousPage)?
            .apply(Action::Back)?;
            assert_eq!(navigation.navigation.route().page(), PageIndex::FIRST);
        }
        Ok(())
    }
}
