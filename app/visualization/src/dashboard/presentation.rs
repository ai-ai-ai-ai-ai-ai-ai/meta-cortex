use super::navigation::{Navigation, Route, Selected, SelectedRoute, Selection};
use meta_cortex_workbench::model::workflow::TaskOwnership;
use meta_cortex_workbench::model::{Checkpoint, Event, Feature, Phase, Task, TaskState, Workspace};
use meta_cortex_workbench::request::TaskQuery;
use meta_cortex_workbench::values::Note;
use meta_cortex_workbench::{LedgerError, Page, PageEnd, PageIndex};

pub(super) enum Content {
    Features(Page<Feature>),
    Tasks(Page<Task>),
    History(Page<Event>),
    Task(Task),
    Event(Event),
    Error(LedgerError),
}
impl Content {
    pub fn last_selection(&self) -> Selection {
        let count = match self {
            Self::Features(page) => page.records.len(),
            Self::Tasks(page) => page.records.len(),
            Self::History(page) => page.records.len(),
            Self::Task(_) | Self::Event(_) | Self::Error(_) => 0,
        };
        Selection::from(count.saturating_sub(1))
    }
    pub fn end(&self) -> PageEnd {
        match self {
            Self::Features(page) => page.end,
            Self::Tasks(page) => page.end,
            Self::History(page) => page.end,
            Self::Task(_) | Self::Event(_) | Self::Error(_) => PageEnd::Complete,
        }
    }
    pub fn enter(&self, selection: Selection) -> SelectedRoute {
        match self {
            Self::Features(page) => match selection.lookup(&page.records) {
                Selected::Record(feature) => SelectedRoute::Route(Route::Tasks {
                    feature: feature.id.clone(),
                    page: PageIndex::FIRST,
                }),
                Selected::Empty => SelectedRoute::Stay,
            },
            Self::Tasks(page) => match selection.lookup(&page.records) {
                Selected::Record(task) => SelectedRoute::Route(Route::Task {
                    query: TaskQuery {
                        feature: task.common.feature.clone(),
                        task: task.common.id.clone(),
                    },
                }),
                Selected::Empty => SelectedRoute::Stay,
            },
            Self::History(page) => match selection.lookup(&page.records) {
                Selected::Record(event) => SelectedRoute::Route(Route::Event {
                    event: Box::new(event.clone()),
                    page: PageIndex::FIRST,
                }),
                Selected::Empty => SelectedRoute::Stay,
            },
            Self::Task(_) | Self::Event(_) | Self::Error(_) => SelectedRoute::Stay,
        }
    }
    pub fn text(&self, navigation: &Navigation) -> Note {
        let heading = format!(
            "WORKBENCH · recorded ledger data · page {}\nGit authorship: unrecorded. Actors identify who recorded ledger events.\n\n",
            navigation.route().page()
        );
        let body = match self {
            Self::Features(page) => FeatureList {
                page,
                selection: navigation.selection(),
            }
            .text(),
            Self::Tasks(page) => TaskList {
                page,
                selection: navigation.selection(),
            }
            .text(),
            Self::History(page) => EventList {
                page,
                selection: navigation.selection(),
            }
            .text(),
            Self::Task(task) => TaskPresentation(task).detail(),
            Self::Event(event) => format!(
                "EVENT {:?} · revision {} · time {}\nRecorded by: {:?}\nNote: {}\n\n{}",
                event.kind,
                event.task.common.revision,
                event.task.common.last_update,
                event.actor,
                event.note,
                TaskPresentation(&event.task).detail()
            ),
            Self::Error(error) => {
                format!("Unable to observe ledger: {error}\nPress r to retry or q to exit.")
            }
        };
        Note::from(format!(
            "{heading}{body}\n\nPage end: {:?} · 100 records maximum per query",
            self.end()
        ))
    }
}
struct FeatureList<'a> {
    page: &'a Page<Feature>,
    selection: Selection,
}
impl FeatureList<'_> {
    fn text(&self) -> String {
        let Self { page, selection } = self;
        let mut text = String::from("FEATURES\n");
        for (index, feature) in page.records.iter().enumerate() {
            text.push_str(&format!(
                "{} {} · {} · {}\n",
                RowMarker::from(Selection::from(index) == *selection),
                feature.id,
                feature.branch,
                feature.objective
            ));
        }
        text.push_str(match page.records.as_slice() {
            [] => "No recorded features on this page.",
            [_, ..] => "",
        });
        text
    }
}
struct TaskList<'a> {
    page: &'a Page<Task>,
    selection: Selection,
}
impl TaskList<'_> {
    fn text(&self) -> String {
        let Self { page, selection } = self;
        let mut text = String::from("TASKS · Enter: detail · h from detail: history\n");
        for (index, task) in page.records.iter().enumerate() {
            text.push_str(&format!(
                "{} {} · {} · revision {} · {}\n    {}\n",
                RowMarker::from(Selection::from(index) == *selection),
                task.common.id,
                TaskPresentation(task).state(),
                task.common.revision,
                task.common.progress.summary,
                TaskPresentation(task).workflow()
            ));
        }
        text.push_str(match page.records.as_slice() {
            [] => "No recorded tasks on this page.",
            [_, ..] => "",
        });
        text
    }
}
struct EventList<'a> {
    page: &'a Page<Event>,
    selection: Selection,
}
impl EventList<'_> {
    fn text(&self) -> String {
        let Self { page, selection } = self;
        let mut text = String::from("HISTORY · newest first · Enter: event snapshot\n");
        for (index, event) in page.records.iter().enumerate() {
            text.push_str(&format!(
                "{} revision {} · {:?} · recorded by {:?} · {}\n",
                RowMarker::from(Selection::from(index) == *selection),
                event.task.common.revision,
                event.kind,
                event.actor,
                event.note
            ));
        }
        text.push_str(match page.records.as_slice() {
            [] => "No recorded events on this page.",
            [_, ..] => "",
        });
        text
    }
}
#[derive(derive_more::Display)]
enum RowMarker {
    #[display(">")]
    Selected,
    #[display(" ")]
    Other,
}
impl From<bool> for RowMarker {
    fn from(selected: bool) -> Self {
        match selected {
            true => Self::Selected,
            false => Self::Other,
        }
    }
}
struct TaskPresentation<'a>(&'a Task);
impl TaskPresentation<'_> {
    fn state(&self) -> &'static str {
        let Self(task) = self;
        match &task.state {
            TaskState::Queued => "queued",
            TaskState::Active { assignment } => match assignment.phase {
                Phase::Working => "working",
                Phase::Blocked { .. } => "blocked",
            },
            TaskState::Ready { .. } => "ready",
            TaskState::Integrated { .. } => "integrated",
            TaskState::Completed { .. } => "completed",
            TaskState::Cancelled { .. } => "cancelled",
        }
    }
    fn workspace(&self) -> String {
        let Self(task) = self;
        match &task.workspace {
            Workspace::ReadOnly => "read only".into(),
            Workspace::Feature => "shared feature worktree".into(),
            Workspace::Git { branch, path } => format!("{branch} at {}", path.display()),
        }
    }
    fn workflow(&self) -> String {
        let Self(task) = self;
        match &task.ownership {
            TaskOwnership::Assigned { assignment } => format!(
                "Agent: {} · Reports to: {}",
                assignment.agent, assignment.reports_to
            ),
            TaskOwnership::Unrecorded => match &task.state {
                TaskState::Active { assignment } => format!(
                    "Claimed agent: {} · Reports to: unrecorded",
                    assignment.agent
                ),
                TaskState::Ready { agent, .. } | TaskState::Completed { agent, .. } => {
                    format!("Claimed agent: {agent} · Reports to: unrecorded")
                }
                TaskState::Queued | TaskState::Integrated { .. } | TaskState::Cancelled { .. } => {
                    "Agent: unrecorded · Reports to: unrecorded".into()
                }
            },
        }
    }
    fn detail(&self) -> String {
        let Self(task) = self;
        let mut text = format!(
            "TASK {} / {} · {}\nObjective: {}\nRevision: {} · attempt {}\nCreated: {} · updated: {} · progress: {}\nWorkspace: {}\nState: {}\n",
            task.common.feature,
            task.common.id,
            self.state(),
            task.common.objective,
            task.common.revision,
            task.common.attempt,
            task.common.created_at,
            task.common.last_update,
            task.common.last_progress,
            self.workspace(),
            self.state()
        );
        text.push_str(&format!("{}\n", self.workflow()));
        if let TaskState::Active { assignment } = &task.state {
            text.push_str(&format!(
                "Claimed agent: {} · expires: {}\n",
                assignment.agent, assignment.expires_at
            ));
            if let Phase::Blocked { reason } = &assignment.phase {
                text.push_str(&format!("Blocked: {reason}\n"));
            }
        }
        match &task.common.checkpoint { Checkpoint::Unrecorded => text.push_str("Checkpoint: unrecorded\n"), Checkpoint::Git { commit } => text.push_str(&format!("Recorded checkpoint: {commit}\nCheckpoint recorded by: inspect Checkpoint history event (not Git authorship)\n")) }
        if let TaskState::Integrated { commit } = &task.state {
            text.push_str(&format!("Recorded integration commit: {commit}\nIntegration recorded by: inspect Integrated history event (not Git authorship)\n"));
        }
        text.push_str(&format!(
            "\nProgress: {}\nAcceptance:\n",
            task.common.progress.summary
        ));
        for note in &task.common.acceptance {
            text.push_str(&format!("- {note}\n"));
        }
        text.push_str("Dependencies:\n");
        for dependency in &task.common.dependencies {
            text.push_str(&format!("- {dependency}\n"));
        }
        text.push_str("Findings:\n");
        for note in &task.common.progress.findings {
            text.push_str(&format!("- {note}\n"));
        }
        text.push_str("Next steps:\n");
        for note in &task.common.progress.next_steps {
            text.push_str(&format!("- {note}\n"));
        }
        for check in &task.common.progress.checks {
            text.push_str(&format!(
                "Check {:?}: {}\nEvidence: {}\n",
                check.outcome, check.command, check.evidence
            ));
        }
        text.push_str("Task-specific extensions:\n");
        for (key, value) in &task.common.progress.extensions.0 {
            text.push_str(&format!("{key}: {value}\n"));
        }
        text
    }
}

#[cfg(test)]
pub mod tests {
    use super::super::navigation::{Navigation, SelectedRoute, Selection};
    use super::{Content, TaskPresentation};
    use meta_cortex_workbench::agents::{AgentId, DeliveryAgent, DevelopmentAgent, GizmoAgent};
    use meta_cortex_workbench::model::workflow::{TaskAssignment, TaskOwnership};
    use meta_cortex_workbench::model::{
        Assignment, Check, CheckOutcome, Checkpoint, Event, EventKind, Phase, Progress, Task,
        TaskCommon, TaskState, Workspace,
    };
    use meta_cortex_workbench::values::{
        Attempt, CommitId, FeatureId, LeaseSeconds, Note, Revision, TaskId, Timestamp,
    };
    use meta_cortex_workbench::versions::{RecordVersion, TaskRecordVersion};
    use meta_cortex_workbench::{LedgerError, Page, PageEnd};

    pub struct Scenario;
    impl Scenario {
        pub fn task() -> anyhow::Result<Task> {
            let now = Timestamp::now()?;
            Ok(Task {
                version: TaskRecordVersion::CURRENT,
                common: TaskCommon {
                    id: TaskId::try_from("task".to_owned())?,
                    feature: FeatureId::try_from("feature".to_owned())?,
                    objective: Note::from("Task objective".to_owned()),
                    acceptance: vec![Note::from("Acceptance".to_owned())],
                    dependencies: vec![],
                    revision: Revision::INITIAL,
                    attempt: Attempt::UNCLAIMED,
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
                ownership: TaskOwnership::Unrecorded,
                workspace: Workspace::ReadOnly,
                state: TaskState::Queued,
            })
        }
        pub fn event() -> anyhow::Result<Event> {
            Ok(Event {
                version: RecordVersion::CURRENT,
                kind: EventKind::Created,
                actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                note: Note::from("Event note".to_owned()),
                task: Self::task()?,
            })
        }
    }
    #[test]
    fn feature_tasks_show_coordinators_and_delivery_owners() -> anyhow::Result<()> {
        let mut records = Vec::new();
        for agent in [
            AgentId::Gizmo(GizmoAgent::GizmoPrime),
            AgentId::Gizmo(GizmoAgent::Gizmo),
            AgentId::Delivery(DeliveryAgent::IntegrationAgent),
        ] {
            records.push(Task {
                state: TaskState::Active {
                    assignment: Assignment {
                        agent,
                        attempt: Attempt::UNCLAIMED.advance()?,
                        expires_at: Timestamp::now()?.expires(LeaseSeconds::TEN_MINUTES)?,
                        phase: Phase::Working,
                    },
                },
                ..Scenario::task()?
            });
        }
        let text = Content::Tasks(Page {
            records,
            end: PageEnd::Complete,
        })
        .text(&Navigation::default())
        .to_string();
        for owner in ["GizmoPrime", "IntegrationAgent", "Reports to: unrecorded"] {
            assert!(
                text.contains(owner),
                "missing workflow information: {owner}"
            );
        }
        Ok(())
    }

    #[test]
    fn reporting_lines_remain_visible_before_claim_and_after_completion() -> anyhow::Result<()> {
        let mut records = Vec::new();
        for agent in [
            AgentId::Gizmo(GizmoAgent::GizmoPrime),
            AgentId::Gizmo(GizmoAgent::Gizmo),
            AgentId::Delivery(DeliveryAgent::IntegrationAgent),
        ] {
            let mut task = Scenario::task()?;
            task = task.assign(TaskAssignment::from(agent))?;
            let text = TaskPresentation(&task).detail();
            assert!(text.contains(&agent.to_string()));
            assert!(text.contains(&agent.reports_to().to_string()));
            records.push(task);
        }
        let text = Content::Tasks(Page {
            records,
            end: PageEnd::Complete,
        })
        .text(&Navigation::default())
        .to_string();
        for relationship in [
            "Agent: Gizmo/GizmoPrime · Reports to: host",
            "Agent: Gizmo/Gizmo · Reports to: Gizmo/GizmoPrime",
            "Agent: Delivery/IntegrationAgent · Reports to: Gizmo/Gizmo",
        ] {
            assert!(text.contains(relationship), "missing {relationship}");
        }
        let agent = AgentId::Delivery(DeliveryAgent::PrAgent);
        let task = Scenario::task()?.assign(TaskAssignment::from(agent))?;
        let task = Task {
            state: TaskState::Completed {
                agent,
                attempt: Attempt::UNCLAIMED.advance()?,
            },
            workspace: Workspace::Feature,
            ..task
        };
        let text = TaskPresentation(&task).detail();
        assert!(text.contains("completed"));
        assert!(text.contains("Agent: Delivery/PrAgent · Reports to: Gizmo/Gizmo"));
        assert!(text.contains("shared feature worktree"));
        Ok(())
    }

    #[test]
    fn details_preserve_recorded_progress_commits_checks_and_actor_labels() -> anyhow::Result<()> {
        let task = Scenario::task()?;
        let content = Content::Task(task.clone())
            .text(&Navigation::default())
            .to_string();
        for expected in [
            "Task objective",
            "Acceptance",
            "Finding",
            "Next step",
            "Check command",
            "Check evidence",
            "Checkpoint: unrecorded",
            "Git authorship: unrecorded",
        ] {
            assert!(content.contains(expected), "missing {expected}");
        }
        let commit = CommitId::try_from("a".repeat(40))?;
        let task = Task {
            common: TaskCommon {
                checkpoint: Checkpoint::Git {
                    commit: commit.clone(),
                },
                ..task.common
            },
            state: TaskState::Integrated { commit },
            ..task
        };
        let text = Content::Task(task).text(&Navigation::default()).to_string();
        assert!(text.contains("Recorded checkpoint:"));
        assert!(text.contains("Recorded integration commit:"));
        assert!(text.contains("not Git authorship"));
        let event = Content::Event(Scenario::event()?)
            .text(&Navigation::default())
            .to_string();
        assert!(event.contains("Recorded by:"));
        assert!(event.contains("Gizmo"));
        assert!(event.contains("Event note"));
        Ok(())
    }
    #[test]
    fn all_task_states_are_distinguished() -> anyhow::Result<()> {
        let task = Scenario::task()?;
        let agent = AgentId::Development(DevelopmentAgent::RustDev);
        let states = [
            TaskState::Queued,
            TaskState::Active {
                assignment: Assignment {
                    agent,
                    attempt: Attempt::UNCLAIMED.advance()?,
                    expires_at: Timestamp::now()?.expires(LeaseSeconds::TEN_MINUTES)?,
                    phase: Phase::Working,
                },
            },
            TaskState::Active {
                assignment: Assignment {
                    agent,
                    attempt: Attempt::UNCLAIMED.advance()?,
                    expires_at: Timestamp::now()?,
                    phase: Phase::Blocked {
                        reason: Note::from("Blocked reason".to_owned()),
                    },
                },
            },
            TaskState::Ready {
                agent,
                attempt: Attempt::UNCLAIMED.advance()?,
            },
            TaskState::Integrated {
                commit: CommitId::try_from("a".repeat(40))?,
            },
            TaskState::Completed {
                agent,
                attempt: Attempt::UNCLAIMED.advance()?,
            },
            TaskState::Cancelled {
                reason: Note::from("Cancelled reason".to_owned()),
            },
        ];
        for state in states {
            let presentation = Task {
                state,
                ..task.clone()
            };
            assert!(!TaskPresentation(&presentation).state().is_empty());
            assert!(!TaskPresentation(&presentation).detail().is_empty());
        }
        Ok(())
    }
    #[test]
    fn lists_and_empty_error_states_are_presented() -> anyhow::Result<()> {
        let task = Scenario::task()?;
        let task_page = Content::Tasks(Page {
            records: vec![task],
            end: PageEnd::More,
        });
        assert!(
            task_page
                .text(&Navigation::default())
                .to_string()
                .contains("> task")
        );
        assert!(matches!(
            task_page.enter(Selection::FIRST),
            SelectedRoute::Route(_)
        ));
        let history = Content::History(Page {
            records: vec![Scenario::event()?],
            end: PageEnd::Complete,
        });
        assert!(
            history
                .text(&Navigation::default())
                .to_string()
                .contains("recorded by")
        );
        assert!(matches!(
            history.enter(Selection::FIRST),
            SelectedRoute::Route(_)
        ));
        for content in [
            Content::Features(Page {
                records: vec![],
                end: PageEnd::Complete,
            }),
            Content::Tasks(Page {
                records: vec![],
                end: PageEnd::Complete,
            }),
            Content::History(Page {
                records: vec![],
                end: PageEnd::Complete,
            }),
            Content::Error(LedgerError::Uninitialized),
        ] {
            assert!(matches!(
                content.enter(Selection::FIRST),
                SelectedRoute::Stay
            ));
            assert!(!content.text(&Navigation::default()).to_string().is_empty());
        }
        Ok(())
    }
}
