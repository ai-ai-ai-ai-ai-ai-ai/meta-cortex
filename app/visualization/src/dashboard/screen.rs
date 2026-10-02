mod detail;
mod rows;

use super::navigation::{Navigation, Route};
use super::presentation::Content;
use detail::{ActorLabel, TaskDetail};
use meta_cortex_workbench::PageEnd;
use ratatui::buffer::Buffer;
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Paragraph, Widget, Wrap};
use rows::{EllipsisLine, RecordList};
use std::fmt;

pub(super) struct DashboardScreen<'a> {
    pub content: &'a Content,
    pub navigation: &'a Navigation,
}
pub(super) struct Surface<'a> {
    pub area: Rect,
    pub buffer: &'a mut Buffer,
}
impl Widget for DashboardScreen<'_> {
    // Ratatui Widget owns this fixed rendering signature and mutable output buffer.
    fn render(self, area: Rect, buffer: &mut Buffer) {
        let [header, body, footer] = Layout::vertical([
            Constraint::Length(4),
            Constraint::Min(1),
            Constraint::Length(3),
        ])
        .areas(area);
        self.header(header).render(header, buffer);
        self.body(Surface { area: body, buffer });
        self.footer()
            .wrap(Wrap { trim: false })
            .render(footer, buffer);
    }
}
impl DashboardScreen<'_> {
    fn header(&self, area: Rect) -> Paragraph<'static> {
        let context = match self.navigation.route() {
            Route::Features { .. } => Line::from("Recorded features"),
            Route::Tasks { feature, .. } => Line::from(format!("Feature  {feature}")),
            Route::Task { query } | Route::History { query, .. } => Line::from(format!(
                "Feature  {}   /   Task  {}",
                query.feature, query.task
            )),
            Route::Event { event, .. } => Line::from(format!(
                "Feature  {}   /   Task  {}",
                event.task.feature, event.task.id
            )),
        };
        Paragraph::new(Text::from(vec![
            Line::from(Span::styled(
                ScreenTitle::from(self.content).to_string(),
                Style::default().add_modifier(Modifier::BOLD),
            )),
            EllipsisLine {
                line: context.style(Style::default().fg(Color::Rgb(155, 165, 179))),
                area,
            }
            .fit(),
        ]))
        .block(
            Block::default()
                .borders(Borders::TOP)
                .title(" Workbench ")
                .border_style(Style::default().fg(Color::Cyan)),
        )
    }
    fn body(&self, surface: Surface<'_>) {
        match self.content {
            Content::Features(_) | Content::Tasks(_) | Content::History(_) => RecordList {
                content: self.content,
                navigation: self.navigation,
            }
            .render(surface),
            Content::Task(task) => TaskDetail(task)
                .text()
                .wrap(Wrap { trim: false })
                .scroll((self.navigation.scroll().lines(), 0))
                .render(surface.area, surface.buffer),
            Content::Event(event) => {
                let mut lines = vec![
                    Line::from(Span::styled(
                        format!("● {:?}  ·  revision {}", event.kind, event.task.revision),
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    )),
                    Line::from(format!("Recorded by  {}", ActorLabel(&event.actor))),
                    Line::from(format!("Time  {}", event.task.last_update))
                        .style(Style::default().fg(Color::Rgb(155, 165, 179))),
                    Line::from(event.note.to_string()),
                    Line::default(),
                ];
                lines.extend(TaskDetail(&event.task).lines());
                Paragraph::new(lines)
                    .wrap(Wrap { trim: false })
                    .scroll((self.navigation.scroll().lines(), 0))
                    .render(surface.area, surface.buffer);
            }
            Content::Error(error) => Paragraph::new(vec![
                Line::from(Span::styled(
                    "× Unable to observe ledger",
                    Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
                )),
                Line::default(),
                Line::from(error.to_string()),
                Line::default(),
                Line::from("Press r to retry or q to exit.")
                    .style(Style::default().fg(Color::Rgb(155, 165, 179))),
            ])
            .wrap(Wrap { trim: false })
            .render(surface.area, surface.buffer),
        }
    }
    fn footer(&self) -> Paragraph<'static> {
        let keys = match self.content {
            Content::Features(_) => {
                "↑↓ select · Enter tasks · n/p pages\nJ/K objective · r refresh · q quit"
            }
            Content::Tasks(_) => {
                "↑↓ select · Enter detail · Esc back\nn/p pages · J/K objective · r refresh · q quit"
            }
            Content::History(_) => {
                "↑↓ select · Enter event · Esc back\nn/p pages · J/K note · r refresh · q quit"
            }
            Content::Task(_) => "h history · Esc back · J/K scroll · r refresh · q quit",
            Content::Event(_) => "Esc history · J/K scroll · r refresh · q quit",
            Content::Error(_) => "r retry · Esc back · q quit",
        };
        let mut lines = vec![Line::from(vec![
            Span::styled(
                format!("Page {}", self.navigation.route().page().next()),
                Style::default().fg(Color::Cyan),
            ),
            Span::raw(match self.content.end() {
                PageEnd::Complete => " · last page",
                PageEnd::More => " · more pages",
            }),
        ])];
        lines.extend(keys.lines().map(|line| {
            Line::from(line.to_owned()).style(Style::default().fg(Color::Rgb(155, 165, 179)))
        }));
        Paragraph::new(lines)
    }
}

enum ScreenTitle {
    Features,
    Tasks,
    Task,
    History,
    Event,
    ObservationFailed,
}
impl From<&Content> for ScreenTitle {
    fn from(content: &Content) -> Self {
        match content {
            Content::Features(_) => Self::Features,
            Content::Tasks(_) => Self::Tasks,
            Content::Task(_) => Self::Task,
            Content::History(_) => Self::History,
            Content::Event(_) => Self::Event,
            Content::Error(_) => Self::ObservationFailed,
        }
    }
}
impl fmt::Display for ScreenTitle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Features => "FEATURES",
            Self::Tasks => "TASKS",
            Self::Task => "TASK",
            Self::History => "HISTORY · newest first",
            Self::Event => "EVENT · recorded snapshot",
            Self::ObservationFailed => "OBSERVATION FAILED",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::DashboardView;
    use super::super::navigation::{
        Action, Direction, Navigation, NavigationInput, NavigationOutcome,
    };
    use super::super::presentation::Content;
    use super::DashboardScreen;
    use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent};
    use meta_cortex_workbench::model::{
        Assignment, Check, CheckOutcome, Checkpoint, Event, EventKind, Feature, Phase, Progress,
        Task, TaskState, Workspace,
    };
    use meta_cortex_workbench::request::TaskQuery;
    use meta_cortex_workbench::values::{
        Attempt, BranchName, CommitId, FeatureId, LeaseSeconds, Note, Revision, TaskId, Timestamp,
    };
    use meta_cortex_workbench::versions::RecordVersion;
    use meta_cortex_workbench::{LedgerError, Page, PageEnd};
    use ratatui::Terminal;
    use ratatui::backend::TestBackend;
    use ratatui::buffer::Buffer;
    use ratatui::layout::Rect;
    use std::fs::{self, File};
    use std::io::Write;
    use std::path::{Path, PathBuf};

    struct Capture {
        area: Rect,
        path: PathBuf,
    }
    struct CaptureView<'a> {
        content: &'a Content,
        navigation: &'a Navigation,
    }
    impl Capture {
        fn write(&self, view: CaptureView<'_>) -> anyhow::Result<Buffer> {
            fs::create_dir_all(
                self.path
                    .parent()
                    .ok_or_else(|| anyhow::anyhow!("capture output requires a parent directory"))?,
            )?;
            let mut terminal = Terminal::new(TestBackend::new(self.area.width, self.area.height))?;
            terminal.draw(|frame| {
                frame.render_widget(
                    DashboardScreen {
                        content: view.content,
                        navigation: view.navigation,
                    },
                    frame.area(),
                )
            })?;
            let mut file = File::create(&self.path)?;
            writeln!(file, "{}\t{}", self.area.width, self.area.height)?;
            for cell in &terminal.backend().buffer().content {
                writeln!(
                    file,
                    "{:?}\t{:?}\t{:?}\t{}",
                    cell.fg,
                    cell.bg,
                    cell.modifier,
                    cell.symbol()
                )?;
            }
            Ok(terminal.backend().buffer().clone())
        }
    }
    #[test]
    fn feature_selection_and_objective_are_visible_at_multiple_sizes() -> anyhow::Result<()> {
        let directory = Path::new("/tmp/meta-cortex-layout-screens");
        let feature = Feature {
            version: RecordVersion::CURRENT,
            id: FeatureId::try_from("dashboard-layout".to_owned())?,
            objective: Note::from("Make the Workbench dashboard readable at every terminal size with compact metadata, clear selection, long objectives and useful recorded progress. Full objective text stays available in the selected detail pane.".to_owned()),
            branch: BranchName::try_from("codex/dashboard-layout".to_owned())?,
            worktree: PathBuf::from("/project"),
        };
        let content = Content::Features(Page {
            records: vec![feature.clone(), Feature { id: FeatureId::try_from("workbench-visualization".to_owned())?, objective: Note::from("Observe recorded ledger tasks, commits and history without disrupting concurrent writers".to_owned()), ..feature.clone() }, Feature { id: FeatureId::try_from("release-v0.12.0".to_owned())?, objective: Note::from("Prepare and validate the supported application release".to_owned()), ..feature }],
            end: PageEnd::Complete,
        });
        for area in [
            Rect::new(0, 0, 64, 20),
            Rect::new(0, 0, 100, 32),
            Rect::new(0, 0, 160, 48),
        ] {
            let buffer = Capture {
                area,
                path: directory.join(format!("features-{}x{}.cells", area.width, area.height)),
            }
            .write(CaptureView {
                content: &content,
                navigation: &Navigation::default(),
            })?;
            let text = buffer
                .content
                .iter()
                .map(|cell| cell.symbol())
                .collect::<String>();
            assert!(text.contains("Make the Workbench dashboard readable"));
            assert!(text.contains("q quit"));
            assert!(text.contains('…'));
            assert!(!text.contains("Git authorship"));
        }
        Ok(())
    }

    #[derive(derive_more::Display)]
    #[display("{}", match self { Self::Tasks => "tasks", Self::Task => "task", Self::History => "history", Self::Event => "event", Self::Empty => "empty", Self::Error => "error" })]
    enum CaptureName {
        Tasks,
        Task,
        History,
        Event,
        Empty,
        Error,
    }
    struct CaptureCase<'a> {
        name: CaptureName,
        content: &'a Content,
        navigation: Navigation,
    }
    struct FixtureStep<'a> {
        input: NavigationInput<'a>,
        navigation: Navigation,
    }
    impl FixtureStep<'_> {
        fn advance(self) -> anyhow::Result<Navigation> {
            let Self { input, navigation } = self;
            match navigation.apply(input) {
                NavigationOutcome::Continue(next) => Ok(next),
                NavigationOutcome::Exit => anyhow::bail!("Unexpected fixture exit"),
            }
        }
    }
    struct TaskFixture {
        template: Task,
    }
    impl TryFrom<Timestamp> for TaskFixture {
        type Error = anyhow::Error;

        fn try_from(now: Timestamp) -> Result<Self, Self::Error> {
            Ok(Self {
                template: Task {
                    version: RecordVersion::CURRENT,
                    id: TaskId::try_from("task".to_owned())?,
                    feature: FeatureId::try_from("feature".to_owned())?,
                    objective: Note::from("Task objective".to_owned()),
                    acceptance: vec![Note::from("Acceptance".to_owned())],
                    dependencies: vec![],
                    workspace: Workspace::ReadOnly,
                    revision: Revision::INITIAL,
                    attempt: Attempt::UNCLAIMED,
                    state: TaskState::Queued,
                    created_at: now,
                    last_update: now,
                    last_progress: now,
                    checkpoint: Checkpoint::Unrecorded,
                    progress: Progress {
                        summary: Note::from("Summary".to_owned()),
                        findings: vec![Note::from("Finding".to_owned())],
                        next_steps: vec![Note::from("Next step".to_owned())],
                        checks: vec![Check {
                            command: Note::from("Check command".to_owned()),
                            outcome: CheckOutcome::Passed,
                            evidence: Note::from("Check evidence".to_owned()),
                        }],
                        extensions: Default::default(),
                    },
                },
            })
        }
    }
    impl TaskFixture {
        fn tasks(&self) -> anyhow::Result<Vec<Task>> {
            let base = self.template.clone();
            let agent = AgentId::Development(DevelopmentAgent::RustDev);
            let attempt = Attempt::UNCLAIMED.advance()?;
            let now = Timestamp::now()?;
            let states = [
                TaskState::Queued,
                TaskState::Active {
                    assignment: Assignment {
                        agent,
                        attempt,
                        expires_at: now.expires(LeaseSeconds::TEN_MINUTES)?,
                        phase: Phase::Working,
                    },
                },
                TaskState::Active {
                    assignment: Assignment {
                        agent,
                        attempt,
                        expires_at: now,
                        phase: Phase::Blocked {
                            reason: Note::from(
                                "Missing recorded acceptance evidence; waiting for review"
                                    .to_owned(),
                            ),
                        },
                    },
                },
                TaskState::Ready { agent, attempt },
                TaskState::Integrated {
                    commit: CommitId::try_from("b".repeat(40))?,
                },
                TaskState::Cancelled {
                    reason: Note::from("Recorded scope cancelled".to_owned()),
                },
            ];
            states.into_iter().enumerate().map(|(index, state)| Ok(Task {
                id: TaskId::try_from(format!("task-{}-structured-dashboard", index + 1))?,
                objective: Note::from("Show a long recorded objective with Unicode 界面 🦀 é and meaningful human-readable progress across narrow and wide terminals; full detail remains available without losing any ledger evidence.".to_owned()),
                state,
                attempt,
                checkpoint: Checkpoint::Git { commit: CommitId::try_from("a".repeat(40))? },
                progress: Progress {
                    summary: Note::from("Structured rendering implemented; visual review and mandatory checks remain recorded separately.".to_owned()),
                    findings: vec![Note::from("Actual buffers preserve selection and readable Unicode objectives.".to_owned())],
                    next_steps: vec![Note::from("Inspect narrow terminal layouts, then complete frozen Rust gates.".to_owned())],
                    checks: vec![
                        Check { command: Note::from("cargo fmt --all --check".to_owned()), outcome: CheckOutcome::Passed, evidence: Note::from("Recorded format check passed on the checkpoint tree.".to_owned()) },
                        Check { command: Note::from("visual acceptance".to_owned()), outcome: CheckOutcome::Failed, evidence: Note::from("Initial list ellipsis clipped; corrected before acceptance.".to_owned()) },
                        Check { command: Note::from("cargo llvm-cov --locked --workspace".to_owned()), outcome: CheckOutcome::NotRun, evidence: Note::from("Waiting for source freeze.".to_owned()) },
                    ],
                    extensions: Default::default(),
                },
                ..base.clone()
            })).collect()
        }
    }
    #[test]
    fn recorded_views_capture_all_states_and_detail_scroll_at_multiple_sizes() -> anyhow::Result<()>
    {
        let tasks = TaskFixture::try_from(Timestamp::now()?)?.tasks()?;
        let query = TaskQuery {
            feature: tasks[0].feature.clone(),
            task: tasks[4].id.clone(),
        };
        let history = Content::History(Page {
            records: [EventKind::Integrated, EventKind::Ready, EventKind::Checkpoint, EventKind::Progress, EventKind::Claimed, EventKind::Created].into_iter().enumerate().map(|(index, kind)| Event {
                kind, actor: AgentId::Development(DevelopmentAgent::RustDev), note: Note::from(format!("Recorded event {}: checked Unicode 界面 🦀 rendering and long objective navigation without ledger mutations", index + 1)), task: tasks[[4,3,1,2,1,0][index]].clone(), version: RecordVersion::CURRENT
            }).collect(), end: PageEnd::More,
        });
        let task_list = Content::Tasks(Page {
            records: tasks.clone(),
            end: PageEnd::Complete,
        });
        let detail = Content::Task(tasks[4].clone());
        let event = match &history {
            Content::History(page) => Content::Event(page.records[0].clone()),
            Content::Features(_)
            | Content::Tasks(_)
            | Content::Task(_)
            | Content::Event(_)
            | Content::Error(_) => anyhow::bail!("Fixture history missing"),
        };
        let empty = Content::Features(Page {
            records: vec![],
            end: PageEnd::Complete,
        });
        let error = Content::Error(LedgerError::Uninitialized);
        let mut event_navigation = Navigation::from(DashboardView::History {
            query: TaskQuery {
                feature: query.feature.clone(),
                task: query.task.clone(),
            },
        });
        event_navigation = FixtureStep {
            input: NavigationInput {
                action: Action::Enter,
                content: &history,
            },
            navigation: event_navigation,
        }
        .advance()?;
        let views = [
            CaptureCase {
                name: CaptureName::Tasks,
                content: &task_list,
                navigation: Navigation::from(DashboardView::Tasks {
                    feature: query.feature.clone(),
                }),
            },
            CaptureCase {
                name: CaptureName::Task,
                content: &detail,
                navigation: Navigation::from(DashboardView::Task {
                    query: TaskQuery {
                        feature: query.feature.clone(),
                        task: query.task.clone(),
                    },
                }),
            },
            CaptureCase {
                name: CaptureName::History,
                content: &history,
                navigation: Navigation::from(DashboardView::History {
                    query: TaskQuery {
                        feature: query.feature.clone(),
                        task: query.task.clone(),
                    },
                }),
            },
            CaptureCase {
                name: CaptureName::Event,
                content: &event,
                navigation: event_navigation,
            },
            CaptureCase {
                name: CaptureName::Empty,
                content: &empty,
                navigation: Navigation::default(),
            },
            CaptureCase {
                name: CaptureName::Error,
                content: &error,
                navigation: Navigation::default(),
            },
        ];
        for CaptureCase {
            name,
            content,
            navigation,
        } in views
        {
            for area in [
                Rect::new(0, 0, 48, 14),
                Rect::new(0, 0, 64, 20),
                Rect::new(0, 0, 100, 32),
                Rect::new(0, 0, 160, 48),
            ] {
                Capture {
                    area,
                    path: Path::new("/tmp/meta-cortex-layout-screens")
                        .join(format!("{name}-{}x{}.cells", area.width, area.height)),
                }
                .write(CaptureView {
                    content,
                    navigation: &navigation,
                })?;
            }
            let mut scrolled = navigation;
            for _ in 0..24 {
                scrolled = FixtureStep {
                    input: NavigationInput {
                        action: Action::Scroll(Direction::Down),
                        content,
                    },
                    navigation: scrolled,
                }
                .advance()?;
            }
            Capture {
                area: Rect::new(0, 0, 100, 32),
                path: PathBuf::from(format!(
                    "/tmp/meta-cortex-layout-screens/{name}-scrolled-100x32.cells"
                )),
            }
            .write(CaptureView {
                content,
                navigation: &scrolled,
            })?;
        }
        Ok(())
    }

    #[test]
    fn bottom_selection_remains_visible_with_unicode_at_short_height() -> anyhow::Result<()> {
        let tasks = TaskFixture::try_from(Timestamp::now()?)?.tasks()?;
        let mut records = Vec::new();
        for index in 0..40 {
            records.push(Task {
                id: TaskId::try_from(format!("item-{index:03}"))?,
                ..tasks[index % tasks.len()].clone()
            });
        }
        let content = Content::Tasks(Page {
            records,
            end: PageEnd::Complete,
        });
        let mut navigation = Navigation::from(DashboardView::Tasks {
            feature: tasks[0].feature.clone(),
        });
        for _ in 0..39 {
            navigation = FixtureStep {
                input: NavigationInput {
                    action: Action::Select(Direction::Down),
                    content: &content,
                },
                navigation,
            }
            .advance()?;
        }
        for area in [
            Rect::new(0, 0, 48, 14),
            Rect::new(0, 0, 64, 20),
            Rect::new(0, 0, 100, 32),
            Rect::new(0, 0, 160, 48),
        ] {
            let buffer = Capture {
                area,
                path: PathBuf::from(format!(
                    "/tmp/meta-cortex-layout-screens/bottom-selection-{}x{}.cells",
                    area.width, area.height
                )),
            }
            .write(CaptureView {
                content: &content,
                navigation: &navigation,
            })?;
            let text = buffer
                .content
                .iter()
                .map(|cell| cell.symbol())
                .collect::<String>();
            assert!(
                text.contains("item-039"),
                "selected item disappeared at {area:?}: {text}"
            );
            assert!(
                text.contains("Ready"),
                "selected state disappeared at {area:?}"
            );
            assert!(text.contains("q quit"), "quit key disappeared at {area:?}");
            assert!(
                text.contains('…'),
                "long Unicode objective lacks intentional ellipsis at {area:?}"
            );
            assert!(
                !text.contains("item-000"),
                "viewport did not follow selection"
            );
        }
        Ok(())
    }

    #[test]
    fn recorded_detail_fields_and_checks_remain_readable_for_every_state() -> anyhow::Result<()> {
        let fixture = TaskFixture::try_from(Timestamp::now()?)?;
        for task in fixture.tasks()? {
            let navigation = Navigation::from(DashboardView::Task {
                query: TaskQuery {
                    feature: task.feature.clone(),
                    task: task.id.clone(),
                },
            });
            let content = Content::Task(task.clone());
            let mut terminal = Terminal::new(TestBackend::new(100, 120))?;
            terminal.draw(|frame| {
                frame.render_widget(
                    DashboardScreen {
                        content: &content,
                        navigation: &navigation,
                    },
                    frame.area(),
                )
            })?;
            let text = terminal
                .backend()
                .buffer()
                .content
                .iter()
                .map(|cell| cell.symbol())
                .collect::<String>();
            for expected in [
                "Objective",
                "Progress",
                "Acceptance",
                "Dependencies",
                "None recorded",
                "Findings",
                "Next steps",
                "Success",
                "Failure",
                "Not run",
                "Recorded checkpoint",
                "Recorded by:",
            ] {
                assert!(
                    text.contains(expected),
                    "Missing {expected} for {:?}",
                    task.state
                );
            }
            assert_eq!(text.matches("Git authorship unrecorded").count(), 1);
            assert!(!text.contains("NoteText("));
            assert!(!text.contains("Development("));
        }
        Ok(())
    }

    #[test]
    fn long_task_identity_keeps_selected_state_visible_at_narrow_width() -> anyhow::Result<()> {
        let task = Task {
            id: TaskId::try_from("long-".repeat(25))?,
            ..TaskFixture::try_from(Timestamp::now()?)?.tasks()?.remove(4)
        };
        let navigation = Navigation::from(DashboardView::Tasks {
            feature: task.feature.clone(),
        });
        let content = Content::Tasks(Page {
            records: vec![task],
            end: PageEnd::Complete,
        });
        let buffer = Capture {
            area: Rect::new(0, 0, 48, 14),
            path: PathBuf::from("/tmp/meta-cortex-layout-screens/long-id-48x14.cells"),
        }
        .write(CaptureView {
            content: &content,
            navigation: &navigation,
        })?;
        let text = buffer
            .content
            .iter()
            .map(|cell| cell.symbol())
            .collect::<String>();
        assert!(text.contains("Integrated"));
        assert!(text.contains("long-long"));
        assert!(text.contains('…'));
        assert!(text.contains("q quit"));
        Ok(())
    }
}
