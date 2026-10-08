//! Historical timeline decisions shared by every public observation consumer.
use super::{FeedEntry, FlowState, RecordedRole, TaskChapter};
use crate::model::TaskState;
use crate::model::worker::WorkerIdentity;
use crate::model::workflow::TaskOwnership;
use crate::values::{ElapsedMillis, Note, TaskId, TaskRevision, Timestamp, WorkerId};
use schemars::JsonSchema;
use serde::Serialize;

#[derive(Debug, Serialize, JsonSchema)]
pub struct RecordedTimeline {
    pub extent: TimelineExtent,
    pub groups: Vec<TimelineGroup>,
    pub chapter_order: Vec<TaskId>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "kind")]
pub enum TimelineExtent {
    Empty,
    Recorded {
        started: Timestamp,
        finished: Timestamp,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, JsonSchema)]
#[serde(tag = "kind")]
pub enum TimelineOrder {
    Recorded { at: Timestamp },
    Unrecorded,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind")]
pub enum TimelineGroupIdentity {
    RecordedWorker { worker_id: WorkerId },
    RoleHistory { role: RecordedRole },
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct TimelineGroup {
    pub identity: TimelineGroupIdentity,
    pub roles: Vec<RecordedRole>,
    pub tasks: Vec<TaskId>,
    pub windows: Vec<RecordedWindow>,
    pub order: TimelineOrder,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct RecordedWindow {
    pub task: TaskId,
    pub objective: Note,
    pub revision: TaskRevision,
    pub summary_revision: TaskRevision,
    pub start: Timestamp,
    pub end: Timestamp,
    pub duration_ms: ElapsedMillis,
    pub state: TaskState,
    pub status: FlowState,
    pub worker: WorkerIdentity,
    pub role: RecordedRole,
    pub summary: Note,
}
impl From<&FeedEntry> for RecordedRole {
    fn from(entry: &FeedEntry) -> Self {
        match &entry.state {
            TaskState::Active { assignment } => Self::Recorded {
                agent: assignment.agent,
            },
            TaskState::Ready { agent, .. } | TaskState::Completed { agent, .. } => {
                Self::Recorded { agent: *agent }
            }
            TaskState::Queued | TaskState::Integrated { .. } | TaskState::Cancelled { .. } => {
                match &entry.ownership {
                    TaskOwnership::Assigned { assignment } => Self::Recorded {
                        agent: assignment.agent,
                    },
                    TaskOwnership::Unrecorded => Self::Unrecorded,
                }
            }
        }
    }
}
struct WindowSource<'a> {
    task: &'a TaskId,
    entry: &'a FeedEntry,
}
impl From<WindowSource<'_>> for RecordedWindow {
    fn from(source: WindowSource<'_>) -> Self {
        let entry = source.entry;
        Self {
            task: source.task.clone(),
            objective: entry.objective.clone(),
            revision: entry.revision,
            summary_revision: entry.revision,
            start: entry.at,
            end: entry.at,
            duration_ms: entry.at.elapsed_since(entry.at),
            state: entry.state.clone(),
            status: FlowState::from(&entry.state),
            worker: entry.worker,
            role: RecordedRole::from(entry),
            summary: entry.summary.clone(),
        }
    }
}
enum RunContinuation {
    Same,
    Changed,
}
impl RecordedWindow {
    fn continuation(&self, entry: &FeedEntry) -> RunContinuation {
        match entry {
            entry if self.worker != entry.worker || self.role != RecordedRole::from(entry) => {
                RunContinuation::Changed
            }
            entry => match (&self.state, &entry.state) {
                (
                    TaskState::Active { assignment: left },
                    TaskState::Active { assignment: right },
                ) if left.agent == right.agent
                    && left.attempt == right.attempt
                    && left.phase == right.phase =>
                {
                    RunContinuation::Same
                }
                (TaskState::Integrated { .. }, TaskState::Integrated { .. }) => {
                    RunContinuation::Same
                }
                (left, right) if left == right => RunContinuation::Same,
                (
                    TaskState::Queued
                    | TaskState::Active { .. }
                    | TaskState::Ready { .. }
                    | TaskState::Integrated { .. }
                    | TaskState::Completed { .. }
                    | TaskState::Cancelled { .. },
                    _,
                ) => RunContinuation::Changed,
            },
        }
    }
    #[must_use]
    fn extend(mut self, at: Timestamp) -> Self {
        match self.state {
            TaskState::Completed { .. } | TaskState::Cancelled { .. } => {}
            TaskState::Queued
            | TaskState::Active { .. }
            | TaskState::Ready { .. }
            | TaskState::Integrated { .. } => {
                self.end = at.max(self.start);
                self.duration_ms = self.end.elapsed_since(self.start);
            }
        }
        self
    }
    #[must_use]
    fn record(mut self, entry: &FeedEntry) -> Self {
        match &entry.summary {
            Note::Empty => {}
            Note::Text(text) if text.to_string().trim().is_empty() => {}
            Note::Text(_) => {
                self.summary = entry.summary.clone();
                self.summary_revision = entry.revision;
            }
        }
        self
    }
}
struct ChapterWindows<'a>(&'a TaskChapter);
impl ChapterWindows<'_> {
    fn project(self) -> Vec<RecordedWindow> {
        let chapter = self.0;
        let mut entries: Vec<_> = chapter.entries.iter().collect();
        entries.sort_by_key(|entry| (entry.at, entry.revision));
        // Reverse first so dedup retains the final revision at each timestamp.
        entries.reverse();
        entries.dedup_by_key(|entry| entry.at);
        entries.reverse();
        let mut runs: Vec<RecordedWindow> = Vec::new();
        for entry in entries {
            match runs.pop() {
                Some(previous) => {
                    let previous = previous.extend(entry.at);
                    match previous.continuation(entry) {
                        RunContinuation::Same => runs.push(previous.record(entry)),
                        RunContinuation::Changed => {
                            runs.push(previous);
                            runs.push(RecordedWindow::from(WindowSource {
                                task: &chapter.task.common.id,
                                entry,
                            }));
                        }
                    }
                }
                None => runs.push(RecordedWindow::from(WindowSource {
                    task: &chapter.task.common.id,
                    entry,
                })),
            }
        }
        if let Some(last) = runs.pop() {
            runs.push(last.extend(chapter.task.common.last_update));
        }
        runs.into_iter()
            .filter(|window| !matches!(window.state, TaskState::Queued))
            .collect()
    }
}
struct GroupSource {
    worker: WorkerIdentity,
    role: RecordedRole,
    task: TaskId,
}
impl From<&GroupSource> for TimelineGroupIdentity {
    fn from(source: &GroupSource) -> Self {
        match source.worker {
            WorkerIdentity::Recorded { worker_id } => Self::RecordedWorker { worker_id },
            WorkerIdentity::Unrecorded => Self::RoleHistory { role: source.role },
        }
    }
}
impl TimelineGroup {
    #[must_use]
    fn include(mut self, source: GroupSource) -> Self {
        match self.roles.iter().find(|role| **role == source.role) {
            Some(_) => {}
            None => self.roles.push(source.role),
        }
        match self.tasks.iter().find(|task| **task == source.task) {
            Some(_) => {}
            None => self.tasks.push(source.task),
        }
        self
    }
    #[must_use]
    fn window(mut self, window: RecordedWindow) -> Self {
        self.order = self.order.min(TimelineOrder::Recorded { at: window.start });
        self = self.include(GroupSource {
            worker: window.worker,
            role: window.role,
            task: window.task.clone(),
        });
        self.windows.push(window);
        self
    }
}
struct TimelineGroups(Vec<TimelineGroup>);
impl TimelineGroups {
    #[must_use]
    fn include(mut self, source: GroupSource) -> Self {
        let identity = TimelineGroupIdentity::from(&source);
        match self.0.iter().position(|group| group.identity == identity) {
            Some(index) => {
                let group = self.0.remove(index).include(source);
                self.0.insert(index, group);
            }
            None => self.0.push(TimelineGroup {
                identity,
                roles: vec![source.role],
                tasks: vec![source.task],
                windows: Vec::new(),
                order: TimelineOrder::Unrecorded,
            }),
        }
        self
    }
    #[must_use]
    fn window(mut self, window: RecordedWindow) -> Self {
        let source = GroupSource {
            worker: window.worker,
            role: window.role,
            task: window.task.clone(),
        };
        let identity = TimelineGroupIdentity::from(&source);
        self = self.include(source);
        if let Some(index) = self.0.iter().position(|group| group.identity == identity) {
            let group = self.0.remove(index).window(window);
            self.0.insert(index, group);
        }
        self
    }
}
impl From<&[TaskChapter]> for RecordedTimeline {
    fn from(chapters: &[TaskChapter]) -> Self {
        let mut ordered: Vec<_> = chapters.iter().collect();
        ordered.sort_by_key(|chapter| {
            match chapter
                .entries
                .iter()
                .filter(|entry| matches!(entry.state, TaskState::Active { .. }))
                .map(|entry| entry.at)
                .min()
            {
                Some(at) => TimelineOrder::Recorded { at },
                None => TimelineOrder::Unrecorded,
            }
        });
        let chapter_order = ordered
            .iter()
            .map(|chapter| chapter.task.common.id.clone())
            .collect();
        let mut groups = TimelineGroups(Vec::new());
        for chapter in ordered {
            let windows = ChapterWindows(chapter).project();
            match windows.as_slice() {
                [] => {
                    groups = groups.include(GroupSource {
                        worker: chapter.task.worker,
                        role: chapter.role,
                        task: chapter.task.common.id.clone(),
                    })
                }
                [_first, ..] => {
                    for window in windows {
                        groups = groups.window(window);
                    }
                }
            }
        }
        let mut groups = groups.0;
        for group in &mut groups {
            group.windows.sort_by_key(|window| window.start);
        }
        groups.sort_by_key(|group| group.order);
        let extent = match chapters
            .iter()
            .map(|chapter| chapter.task.common.last_update)
            .max()
        {
            None => TimelineExtent::Empty,
            Some(finished) => {
                let started = match groups
                    .iter()
                    .flat_map(|group| &group.windows)
                    .map(|window| window.start)
                    .min()
                {
                    Some(at) => at,
                    None => finished,
                };
                TimelineExtent::Recorded { started, finished }
            }
        };
        Self {
            extent,
            groups,
            chapter_order,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::{AgentId, DevelopmentAgent};
    use crate::model::{
        Assignment, Checkpoint, EventKind, Phase, Progress, Task, TaskCommon, Workspace,
    };
    use crate::values::{Attempt, CommitId, Extensions, FeatureId};
    use crate::versions::TaskRecordVersion;

    struct Scenario {
        chapter: TaskChapter,
    }
    struct Record {
        at: i64,
        state: TaskState,
        worker: WorkerIdentity,
        summary: &'static str,
    }
    impl Scenario {
        fn new(id: &str) -> anyhow::Result<Self> {
            let task = Task {
                version: TaskRecordVersion::CURRENT,
                worker: WorkerIdentity::Unrecorded,
                common: TaskCommon {
                    id: TaskId::try_from(id.to_owned())?,
                    feature: FeatureId::try_from("feature".to_owned())?,
                    objective: Note::from("Future objective must not leak".to_owned()),
                    acceptance: Vec::new(),
                    dependencies: Vec::new(),
                    revision: TaskRevision::INITIAL,
                    attempt: Attempt::UNCLAIMED,
                    created_at: Timestamp::EPOCH,
                    last_update: Timestamp::EPOCH,
                    last_progress: Timestamp::EPOCH,
                    checkpoint: Checkpoint::Unrecorded,
                    progress: Progress {
                        summary: Note::Empty,
                        findings: Vec::new(),
                        next_steps: Vec::new(),
                        checks: Vec::new(),
                        extensions: Extensions::default(),
                    },
                },
                ownership: TaskOwnership::Unrecorded,
                workspace: Workspace::ReadOnly,
                state: TaskState::Queued,
            };
            Ok(Self {
                chapter: TaskChapter {
                    task,
                    role: RecordedRole::Unrecorded,
                    status: FlowState::Queued,
                    entries: Vec::new(),
                },
            })
        }
        fn agent() -> AgentId {
            AgentId::Development(DevelopmentAgent::RustDev)
        }
        fn working(attempt: i64) -> anyhow::Result<TaskState> {
            Ok(TaskState::Active {
                assignment: Assignment {
                    agent: Self::agent(),
                    attempt: Attempt::try_from(attempt)?,
                    expires_at: Timestamp::try_from(9999)?,
                    phase: Phase::Working,
                },
            })
        }
        fn record(mut self, record: Record) -> anyhow::Result<Self> {
            let at = Timestamp::try_from(record.at)?;
            let revision = TaskRevision::try_from(i64::try_from(self.chapter.entries.len())? + 1)?;
            self.chapter.entries.push(FeedEntry {
                outcomes: Vec::new(),
                objective: Note::from("Historical objective".to_owned()),
                worker: record.worker,
                kind: EventKind::Progress,
                actor: Self::agent(),
                ownership: TaskOwnership::Unrecorded,
                state: record.state.clone(),
                note: Note::from("Waiting prose does not mean blocked".to_owned()),
                summary: Note::from(record.summary.to_owned()),
                at,
                revision,
                evidence: Vec::new(),
                checkpoint: Checkpoint::Unrecorded,
            });
            self.chapter.task.state = record.state;
            self.chapter.task.worker = record.worker;
            self.chapter.task.common.last_update = at;
            Ok(self)
        }
    }
    #[test]
    fn claims_coalesce_progress_keep_gaps_and_bound_terminal_history() -> anyhow::Result<()> {
        let worker = WorkerIdentity::Recorded {
            worker_id: WorkerId::EXAMPLE,
        };
        let mut scenario = Scenario::new("task")?;
        for record in [
            Record {
                at: 0,
                state: TaskState::Queued,
                worker,
                summary: "",
            },
            Record {
                at: 100,
                state: Scenario::working(1)?,
                worker,
                summary: "Starting",
            },
            Record {
                at: 200,
                state: Scenario::working(1)?,
                worker,
                summary: "Implementation in progress",
            },
            Record {
                at: 300,
                state: Scenario::working(1)?,
                worker,
                summary: "",
            },
            Record {
                at: 400,
                state: TaskState::Queued,
                worker,
                summary: "Requeued",
            },
            Record {
                at: 600,
                state: Scenario::working(2)?,
                worker,
                summary: "Resume",
            },
            Record {
                at: 800,
                state: TaskState::Ready {
                    agent: Scenario::agent(),
                    attempt: Attempt::try_from(2)?,
                },
                worker,
                summary: "Review ready",
            },
            Record {
                at: 900,
                state: TaskState::Completed {
                    agent: Scenario::agent(),
                    attempt: Attempt::try_from(2)?,
                },
                worker,
                summary: "Completed later",
            },
            Record {
                at: 1000,
                state: TaskState::Completed {
                    agent: Scenario::agent(),
                    attempt: Attempt::try_from(2)?,
                },
                worker,
                summary: "Final note",
            },
        ] {
            scenario = scenario.record(record)?;
        }
        let windows = ChapterWindows(&scenario.chapter).project();
        assert_eq!(
            windows
                .iter()
                .map(|window| window.start)
                .collect::<Vec<_>>(),
            [100, 600, 800, 900]
                .map(Timestamp::try_from)
                .into_iter()
                .collect::<Result<Vec<_>, _>>()?
        );
        assert_eq!(
            windows.iter().map(|window| window.end).collect::<Vec<_>>(),
            [400, 800, 900, 900]
                .map(Timestamp::try_from)
                .into_iter()
                .collect::<Result<Vec<_>, _>>()?
        );
        assert_eq!(windows[0].summary.to_string(), "Implementation in progress");
        assert_eq!(windows[0].summary_revision, TaskRevision::try_from(3)?);
        assert_eq!(windows[0].objective.to_string(), "Historical objective");
        assert_eq!(
            windows[0].duration_ms,
            Timestamp::try_from(400)?.elapsed_since(Timestamp::try_from(100)?)
        );
        assert_eq!(windows[0].status, FlowState::Working);
        Ok(())
    }
    #[test]
    fn blocked_reason_and_final_simultaneous_revision_are_authoritative() -> anyhow::Result<()> {
        let worker = WorkerIdentity::Unrecorded;
        let blocked = TaskState::Active {
            assignment: Assignment {
                agent: Scenario::agent(),
                attempt: Attempt::try_from(1)?,
                expires_at: Timestamp::try_from(300)?,
                phase: Phase::Blocked {
                    reason: Note::from("Waiting for review".to_owned()),
                },
            },
        };
        let mut renewed = blocked.clone();
        if let TaskState::Active { assignment } = &mut renewed {
            assignment.expires_at = Timestamp::try_from(9999)?;
        }
        let mut scenario = Scenario::new("blocked")?;
        for record in [
            Record {
                at: 100,
                state: Scenario::working(1)?,
                worker,
                summary: "",
            },
            Record {
                at: 200,
                state: blocked.clone(),
                worker,
                summary: "Blocked",
            },
            Record {
                at: 400,
                state: renewed,
                worker,
                summary: "Still blocked",
            },
            Record {
                at: 500,
                state: TaskState::Ready {
                    agent: Scenario::agent(),
                    attempt: Attempt::try_from(1)?,
                },
                worker,
                summary: "Ready",
            },
            Record {
                at: 600,
                state: TaskState::Integrated {
                    commit: CommitId::try_from("a".repeat(40))?,
                },
                worker,
                summary: "Integrated",
            },
            Record {
                at: 700,
                state: Scenario::working(2)?,
                worker,
                summary: "Superseded simultaneous",
            },
            Record {
                at: 700,
                state: TaskState::Cancelled {
                    reason: Note::from("Superseded".to_owned()),
                },
                worker,
                summary: "Cancelled",
            },
            Record {
                at: 800,
                state: TaskState::Cancelled {
                    reason: Note::from("Superseded".to_owned()),
                },
                worker,
                summary: "",
            },
        ] {
            scenario = scenario.record(record)?;
        }
        let windows = ChapterWindows(&scenario.chapter).project();
        assert_eq!(
            windows
                .iter()
                .map(|window| window.status)
                .collect::<Vec<_>>(),
            [
                FlowState::Working,
                FlowState::Blocked,
                FlowState::Ready,
                FlowState::Integrated,
                FlowState::Cancelled
            ]
        );
        assert_eq!(windows[1].state, blocked);
        assert_eq!(windows[1].end, Timestamp::try_from(500)?);
        assert_eq!(windows[4].revision, TaskRevision::try_from(7)?);
        assert_eq!(windows[4].end, Timestamp::try_from(700)?);
        Ok(())
    }
    #[test]
    fn groups_instances_across_tasks_and_splits_reassignment_and_legacy_roles() -> anyhow::Result<()>
    {
        let first = WorkerIdentity::Recorded {
            worker_id: WorkerId::EXAMPLE,
        };
        let second = WorkerIdentity::Recorded {
            worker_id: WorkerId::try_from("22222222-2222-4222-8222-222222222222".to_owned())?,
        };
        let mut chapters = Vec::new();
        for id in ["first", "resume", "separate", "legacy"] {
            let worker = match id {
                "separate" => second,
                "legacy" => WorkerIdentity::Unrecorded,
                _ => first,
            };
            let at = match id {
                "resume" => 400,
                _ => 100,
            };
            chapters.push(
                Scenario::new(id)?
                    .record(Record {
                        at,
                        state: Scenario::working(1)?,
                        worker,
                        summary: "Running",
                    })?
                    .record(Record {
                        at: at + 100,
                        state: TaskState::Queued,
                        worker,
                        summary: "",
                    })?
                    .chapter,
            );
        }
        let reassigned = Scenario::new("reassigned")?
            .record(Record {
                at: 50,
                state: Scenario::working(1)?,
                worker: first,
                summary: "First",
            })?
            .record(Record {
                at: 150,
                state: Scenario::working(1)?,
                worker: second,
                summary: "Second",
            })?
            .record(Record {
                at: 250,
                state: TaskState::Queued,
                worker: second,
                summary: "",
            })?;
        chapters.push(reassigned.chapter);
        chapters.insert(0, Scenario::new("queued")?.chapter);
        let timeline = RecordedTimeline::from(chapters.as_slice());
        assert_eq!(timeline.groups.len(), 4);
        assert_eq!(
            timeline.chapter_order[0],
            TaskId::try_from("reassigned".to_owned())?
        );
        assert_eq!(
            timeline.chapter_order.last(),
            Some(&TaskId::try_from("queued".to_owned())?)
        );
        assert_eq!(
            timeline.groups[0].identity,
            TimelineGroupIdentity::RecordedWorker {
                worker_id: WorkerId::EXAMPLE
            }
        );
        assert_eq!(timeline.groups[0].tasks.len(), 3);
        assert_eq!(timeline.groups[0].windows[0].end, Timestamp::try_from(150)?);
        assert_eq!(
            timeline.groups[0].windows[2].start,
            Timestamp::try_from(400)?
        );
        assert!(matches!(
            timeline.groups[2].identity,
            TimelineGroupIdentity::RoleHistory {
                role: RecordedRole::Recorded { .. }
            }
        ));
        assert!(matches!(
            timeline.groups[3].order,
            TimelineOrder::Unrecorded
        ));
        Ok(())
    }
    #[test]
    fn one_worker_retains_every_historical_role_and_ignores_blank_progress() -> anyhow::Result<()> {
        let worker = WorkerIdentity::Recorded {
            worker_id: WorkerId::EXAMPLE,
        };
        let other = AgentId::Development(DevelopmentAgent::TypescriptDev);
        let chapter = Scenario::new("roles")?
            .record(Record {
                at: 100,
                state: Scenario::working(1)?,
                worker,
                summary: "Earlier useful note",
            })?
            .record(Record {
                at: 200,
                state: Scenario::working(1)?,
                worker,
                summary: "  \n",
            })?
            .record(Record {
                at: 300,
                state: TaskState::Ready {
                    agent: other,
                    attempt: Attempt::try_from(1)?,
                },
                worker,
                summary: "Different role",
            })?
            .chapter;
        let timeline = RecordedTimeline::from([chapter].as_slice());
        assert_eq!(timeline.groups.len(), 1);
        assert_eq!(
            timeline.groups[0].roles,
            [
                RecordedRole::Recorded {
                    agent: Scenario::agent()
                },
                RecordedRole::Recorded { agent: other }
            ]
        );
        assert_eq!(
            timeline.groups[0].windows[0].summary.to_string(),
            "Earlier useful note"
        );
        assert_eq!(
            timeline.groups[0].windows[0].summary_revision,
            TaskRevision::INITIAL
        );
        Ok(())
    }
}
