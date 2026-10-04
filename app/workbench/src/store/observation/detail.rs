//! Complete, read-only task chapters for a selected feature. Pagination is consumed
//! between short-lived WAL reads; no transaction is held while the UI is open.
use super::timeline::RecordedTimeline;
use super::{FlowState, HistoryPage, Observation, PageEnd, PageIndex, TaskPage};
use crate::LedgerError;
use crate::agents::AgentId;
use crate::model::worker::WorkerIdentity;
use crate::model::workflow::TaskOwnership;
use crate::model::{Checkpoint, Event, EventKind, Progress, Task, TaskState};
use crate::values::{FeatureId, Note, Revision, Timestamp};
use schemars::JsonSchema;
use serde::Serialize;

#[derive(Debug, Serialize, JsonSchema)]
pub struct FeatureWorkflow {
    pub timeline: RecordedTimeline,
    pub feature: FeatureId,
    pub chapters: Vec<TaskChapter>,
    pub timing: WorkflowTiming,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "kind")]
pub enum WorkflowTiming {
    Empty,
    Running {
        started: Timestamp,
    },
    Finished {
        started: Timestamp,
        finished: Timestamp,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind")]
pub enum RecordedRole {
    Unrecorded,
    Recorded { agent: AgentId },
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct TaskChapter {
    pub task: Task,
    pub role: RecordedRole,
    pub status: FlowState,
    pub entries: Vec<FeedEntry>,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct FeedEntry {
    pub objective: Note,
    /// Worker identity from this event snapshot, never inferred from its actor.
    pub worker: WorkerIdentity,
    pub kind: EventKind,
    pub actor: AgentId,
    /// Ownership recorded in this event snapshot, independent of its actor.
    pub ownership: TaskOwnership,
    /// Task state recorded in this event snapshot, independent of later revisions.
    pub state: TaskState,
    pub note: Note,
    pub summary: Note,
    pub at: Timestamp,
    pub revision: Revision,
    /// Only evidence changed since the previous revision of this task.
    pub evidence: Vec<Progress>,
    pub checkpoint: Checkpoint,
}
impl Observation {
    pub async fn workflow(&self, feature: FeatureId) -> Result<FeatureWorkflow, LedgerError> {
        let mut tasks = Vec::new();
        let mut page = PageIndex::FIRST;
        loop {
            let result = self
                .tasks(TaskPage {
                    feature: feature.clone(),
                    page,
                })
                .await?;
            tasks.extend(result.records);
            match result.end {
                PageEnd::Complete => break,
                PageEnd::More => page = page.next(),
            }
        }
        tasks.sort_by_key(|task| task.common.created_at);
        let mut chapters = Vec::new();
        for task in tasks {
            let mut events = Vec::new();
            let mut page = PageIndex::FIRST;
            loop {
                let result = self
                    .history(HistoryPage {
                        feature: feature.clone(),
                        task: task.common.id.clone(),
                        page,
                    })
                    .await?;
                events.extend(result.records);
                match result.end {
                    PageEnd::Complete => break,
                    PageEnd::More => page = page.next(),
                }
            }
            // A concurrent writer can add revisions between pages. Deduplicate and
            // bound history to the task snapshot that this read is presenting.
            events.sort_by_key(|event| event.task.common.revision);
            events.dedup_by_key(|event| event.task.common.revision);
            events.retain(|event| event.task.common.revision <= task.common.revision);
            chapters.push(TaskChapter::from(ChapterSource { task, events }));
        }
        let timing = WorkflowTiming::from(chapters.as_slice());
        Ok(FeatureWorkflow {
            timeline: RecordedTimeline::from(chapters.as_slice()),
            feature,
            chapters,
            timing,
        })
    }
}
struct ChapterSource {
    task: Task,
    events: Vec<Event>,
}
impl From<ChapterSource> for TaskChapter {
    fn from(source: ChapterSource) -> Self {
        let ChapterSource { task, events } = source;
        let role = match &task.ownership {
            TaskOwnership::Assigned { assignment } => RecordedRole::Recorded {
                agent: assignment.agent,
            },
            TaskOwnership::Unrecorded => match events
                .iter()
                .rev()
                .find(|event| matches!(event.kind, EventKind::Claimed))
            {
                Some(event) => RecordedRole::Recorded { agent: event.actor },
                None => RecordedRole::Unrecorded,
            },
        };
        let mut entries = Vec::new();
        let mut previous = Progress {
            summary: Note::Empty,
            findings: Vec::new(),
            next_steps: Vec::new(),
            checks: Vec::new(),
            extensions: Default::default(),
        };
        let mut checkpoint = Checkpoint::Unrecorded;
        for event in events {
            let progress = &event.task.common.progress;
            let evidence = Progress {
                summary: match progress.summary == previous.summary {
                    true => Note::Empty,
                    false => progress.summary.clone(),
                },
                findings: progress
                    .findings
                    .iter()
                    .filter(|item| !previous.findings.contains(item))
                    .cloned()
                    .collect(),
                next_steps: progress
                    .next_steps
                    .iter()
                    .filter(|item| !previous.next_steps.contains(item))
                    .cloned()
                    .collect(),
                checks: progress
                    .checks
                    .iter()
                    .filter(|item| !previous.checks.contains(item))
                    .cloned()
                    .collect(),
                extensions: match progress.extensions == previous.extensions {
                    true => Default::default(),
                    false => progress.extensions.clone(),
                },
            };
            previous = progress.clone();
            let recorded = match checkpoint == event.task.common.checkpoint {
                true => Checkpoint::Unrecorded,
                false => event.task.common.checkpoint.clone(),
            };
            checkpoint = event.task.common.checkpoint;
            entries.push(FeedEntry {
                objective: event.task.common.objective,
                worker: event.task.worker,
                kind: event.kind,
                actor: event.actor,
                ownership: event.task.ownership,
                state: event.task.state,
                note: event.note,
                summary: event.task.common.progress.summary.clone(),
                at: event.task.common.last_update,
                revision: event.task.common.revision,
                evidence: vec![evidence],
                checkpoint: recorded,
            });
        }
        Self {
            status: FlowState::from(&task.state),
            task,
            role,
            entries,
        }
    }
}
impl From<&[TaskChapter]> for WorkflowTiming {
    fn from(chapters: &[TaskChapter]) -> Self {
        let Some(started) = chapters
            .iter()
            .map(|chapter| chapter.task.common.created_at)
            .min()
        else {
            return Self::Empty;
        };
        let mut finished = started;
        for chapter in chapters {
            match chapter.task.state {
                TaskState::Queued | TaskState::Active { .. } | TaskState::Ready { .. } => {
                    return Self::Running { started };
                }
                TaskState::Integrated { .. }
                | TaskState::Completed { .. }
                | TaskState::Cancelled { .. } => {}
            }
            // Terminal annotations can be later than completion. Use the actual
            // terminal event, never last_update as a made-up completion timestamp.
            match chapter.entries.iter().rev().find(|entry| {
                matches!(
                    entry.kind,
                    EventKind::Integrated | EventKind::Completed | EventKind::Cancelled
                )
            }) {
                Some(entry) => finished = finished.max(entry.at),
                None => return Self::Running { started },
            }
        }
        Self::Finished { started, finished }
    }
}

#[cfg(test)]
mod tests {
    use super::{ChapterSource, FeatureWorkflow, RecordedRole, TaskChapter, WorkflowTiming};
    use crate::agents::{AgentId, DevelopmentAgent};
    use crate::model::worker::WorkerIdentity;
    use crate::model::workflow::{TaskAssignment, TaskOwnership};
    use crate::model::{
        Assignment, Check, CheckOutcome, Checkpoint, Event, EventKind, Phase, Progress, Task,
        TaskCommon, TaskState, Workspace,
    };
    use crate::values::{
        Attempt, CommitId, Extensions, FeatureId, Note, Revision, TaskId, Timestamp,
    };
    use crate::versions::{RecordVersion, TaskRecordVersion};
    use std::collections::BTreeMap;

    #[test]
    fn empty_workflow_exposes_an_explicit_empty_recorded_timeline() -> anyhow::Result<()> {
        let workflow = FeatureWorkflow {
            timeline: super::RecordedTimeline::from([].as_slice()),
            feature: FeatureId::try_from("feature".to_owned())?,
            chapters: Vec::new(),
            timing: WorkflowTiming::Empty,
        };
        let serialized = serde_json::to_value(workflow)?;
        assert_eq!(serialized["timeline"]["extent"]["kind"], "Empty");
        assert_eq!(
            serialized["timeline"]["groups"],
            serde_json::to_value(Vec::<TaskId>::new())?
        );
        Ok(())
    }

    struct Scenario;
    impl Scenario {
        fn agent() -> AgentId {
            AgentId::Development(DevelopmentAgent::RustDev)
        }
        fn task() -> anyhow::Result<Task> {
            Ok(Task {
                worker: WorkerIdentity::Unrecorded,
                version: TaskRecordVersion::CURRENT,
                common: TaskCommon {
                    id: TaskId::try_from("task".to_owned())?,
                    feature: FeatureId::try_from("feature".to_owned())?,
                    objective: Note::from("Review storage".to_owned()),
                    acceptance: vec![],
                    dependencies: vec![],
                    revision: Revision::INITIAL,
                    attempt: Attempt::UNCLAIMED,
                    created_at: Timestamp::try_from(1000)?,
                    last_update: Timestamp::try_from(1000)?,
                    last_progress: Timestamp::try_from(1000)?,
                    checkpoint: Checkpoint::Unrecorded,
                    progress: Progress {
                        summary: Note::Empty,
                        findings: vec![],
                        next_steps: vec![],
                        checks: vec![],
                        extensions: Extensions::default(),
                    },
                },
                ownership: TaskOwnership::Unrecorded,
                workspace: Workspace::ReadOnly,
                state: TaskState::Queued,
            })
        }
        fn event(task: Task) -> Event {
            Event {
                version: RecordVersion::CURRENT,
                kind: EventKind::Progress,
                actor: Self::agent(),
                note: Note::Empty,
                task,
            }
        }
    }
    #[derive(serde::Deserialize)]
    struct FeedSnapshot {
        kind: EventKind,
        state: TaskState,
    }

    #[test]
    fn entries_preserve_historical_state_through_blocking_and_requeue() -> anyhow::Result<()> {
        let first_attempt = Attempt::UNCLAIMED.advance()?;
        let assignment = Assignment {
            agent: Scenario::agent(),
            attempt: first_attempt,
            expires_at: Timestamp::try_from(5000)?,
            phase: Phase::Working,
        };
        let working = TaskState::Active {
            assignment: assignment.clone(),
        };
        let blocked = TaskState::Active {
            assignment: Assignment {
                phase: Phase::Blocked {
                    reason: Note::from("Waiting for contract review".to_owned()),
                },
                ..assignment.clone()
            },
        };
        let reclaimed = TaskState::Active {
            assignment: Assignment {
                agent: AgentId::Development(DevelopmentAgent::TypescriptDev),
                attempt: first_attempt.advance()?,
                ..assignment
            },
        };
        let snapshots = [
            FeedSnapshot {
                kind: EventKind::Claimed,
                state: working.clone(),
            },
            FeedSnapshot {
                kind: EventKind::Progress,
                state: blocked,
            },
            FeedSnapshot {
                kind: EventKind::Progress,
                state: working,
            },
            FeedSnapshot {
                kind: EventKind::Requeued,
                state: TaskState::Queued,
            },
            FeedSnapshot {
                kind: EventKind::Claimed,
                state: reclaimed,
            },
        ];
        let mut task = Scenario::task()?;
        let mut events = Vec::new();
        for snapshot in &snapshots {
            task.common.revision = task.common.revision.advance()?;
            task.state = snapshot.state.clone();
            events.push(Event {
                kind: snapshot.kind.clone(),
                ..Scenario::event(task.clone())
            });
        }
        let chapter = TaskChapter::from(ChapterSource { task, events });
        assert_eq!(chapter.entries.len(), snapshots.len());
        for (entry, snapshot) in chapter.entries.iter().zip(snapshots) {
            let recorded: FeedSnapshot = serde_json::from_str(&serde_json::to_string(entry)?)?;
            assert_eq!(recorded.kind, snapshot.kind);
            assert_eq!(recorded.state, snapshot.state);
        }
        Ok(())
    }
    #[test]
    fn entries_preserve_historical_ownership_through_reassignment() -> anyhow::Result<()> {
        let mut task = Scenario::task()?;
        let legacy = Scenario::event(task.clone());
        let original = TaskOwnership::Assigned {
            assignment: TaskAssignment::from(Scenario::agent()),
        };
        task.common.revision = task.common.revision.advance()?;
        task.ownership = original.clone();
        let assigned = Event {
            kind: EventKind::Assigned,
            ..Scenario::event(task.clone())
        };
        task.common.revision = task.common.revision.advance()?;
        task.ownership = TaskOwnership::Assigned {
            assignment: TaskAssignment::from(AgentId::Development(DevelopmentAgent::TypescriptDev)),
        };
        let reassigned = Event {
            kind: EventKind::Assigned,
            ..Scenario::event(task.clone())
        };
        let current = task.ownership.clone();
        let chapter = TaskChapter::from(ChapterSource {
            task,
            events: vec![legacy, assigned, reassigned],
        });
        assert_eq!(chapter.entries[0].ownership, TaskOwnership::Unrecorded);
        assert_eq!(chapter.entries[1].ownership, original);
        assert_eq!(chapter.entries[2].ownership, current);
        assert_eq!(chapter.entries[2].actor, Scenario::agent());
        Ok(())
    }
    #[test]
    fn chapters_keep_changes_once_and_preserve_updated_evidence() -> anyhow::Result<()> {
        let mut task = Scenario::task()?;
        let created = Event {
            kind: EventKind::Created,
            ..Scenario::event(task.clone())
        };
        task.common.revision = task.common.revision.advance()?;
        let claimed = Event {
            kind: EventKind::Claimed,
            ..Scenario::event(task.clone())
        };
        task.common.revision = task.common.revision.advance()?;
        task.common.checkpoint = Checkpoint::Git {
            commit: CommitId::try_from("a".repeat(40))?,
        };
        let check = Check {
            command: Note::from("cargo test".to_owned()),
            outcome: CheckOutcome::Failed,
            evidence: Note::from("one failure".to_owned()),
        };
        task.common.progress = Progress {
            summary: Note::from("Test report".to_owned()),
            findings: vec![Note::from("Needs repair".to_owned())],
            next_steps: vec![Note::from("Fix it".to_owned())],
            checks: vec![check.clone()],
            extensions: Extensions::from(BTreeMap::from([(
                "report".to_owned(),
                serde_json::json!("review"),
            )])),
        };
        let first = Scenario::event(task.clone());
        task.common.revision = task.common.revision.advance()?;
        let repeat = Scenario::event(task.clone());
        task.common.revision = task.common.revision.advance()?;
        task.common.progress.checks = vec![Check {
            outcome: CheckOutcome::Passed,
            evidence: Note::from("34 passed".to_owned()),
            ..check
        }];
        let changed = Scenario::event(task.clone());
        let chapter = TaskChapter::from(ChapterSource {
            task,
            events: vec![created, claimed, first, repeat, changed],
        });
        assert!(
            matches!(chapter.role,RecordedRole::Recorded {agent} if agent == Scenario::agent())
        );
        assert_eq!(chapter.entries.len(), 5);
        let original = &chapter.entries[2];
        assert_eq!(original.evidence[0].checks.len(), 1);
        assert_eq!(original.evidence[0].findings.len(), 1);
        assert!(matches!(original.checkpoint, Checkpoint::Git { .. }));
        let repeated = &chapter.entries[3];
        assert!(repeated.evidence[0].checks.is_empty());
        assert!(repeated.evidence[0].findings.is_empty());
        assert!(repeated.evidence[0].next_steps.is_empty());
        assert_eq!(repeated.evidence[0].extensions, Extensions::default());
        assert_eq!(repeated.evidence[0].summary, Note::Empty);
        assert!(matches!(repeated.checkpoint, Checkpoint::Unrecorded));
        assert_eq!(
            chapter.entries[4].evidence[0].checks[0].outcome,
            CheckOutcome::Passed
        );
        Ok(())
    }
    #[test]
    fn timing_uses_terminal_events_not_later_annotations_and_never_invents_missing_completion()
    -> anyhow::Result<()> {
        assert!(matches!(
            WorkflowTiming::from([].as_slice()),
            WorkflowTiming::Empty
        ));
        let mut task = Scenario::task()?;
        task.ownership = TaskOwnership::Assigned {
            assignment: TaskAssignment::from(Scenario::agent()),
        };
        let open = TaskChapter::from(ChapterSource {
            task: task.clone(),
            events: vec![],
        });
        assert!(matches!(open.role, RecordedRole::Recorded { .. }));
        assert!(matches!(
            WorkflowTiming::from([open].as_slice()),
            WorkflowTiming::Running { .. }
        ));
        task.state = TaskState::Completed {
            agent: Scenario::agent(),
            attempt: Attempt::UNCLAIMED,
        };
        task.common.last_update = Timestamp::try_from(2000)?;
        let completed = Event {
            kind: EventKind::Completed,
            ..Scenario::event(task.clone())
        };
        task.common.last_update = Timestamp::try_from(9000)?;
        let annotation = Scenario::event(task.clone());
        let chapter = TaskChapter::from(ChapterSource {
            task: task.clone(),
            events: vec![completed, annotation],
        });
        assert!(
            matches!(WorkflowTiming::from([chapter].as_slice()),WorkflowTiming::Finished {started,finished} if started == Timestamp::try_from(1000)? && finished == Timestamp::try_from(2000)?)
        );
        let unknown = TaskChapter::from(ChapterSource {
            task,
            events: vec![],
        });
        assert!(matches!(
            WorkflowTiming::from([unknown].as_slice()),
            WorkflowTiming::Running { .. }
        ));
        let task = Scenario::task()?;
        let chapter = TaskChapter::from(ChapterSource {
            task,
            events: vec![],
        });
        assert!(matches!(chapter.role, RecordedRole::Unrecorded));
        Ok(())
    }
}
