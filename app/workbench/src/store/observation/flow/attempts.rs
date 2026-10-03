use super::{RecordedActor, TaskFlow};
use crate::model::workflow::TaskOwnership;
use crate::model::{Event, EventKind, Progress};
use crate::values::{Attempt, Timestamp};
use schemars::JsonSchema;
use serde::Serialize;

#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AttemptStart {
    Unrecorded,
    Recorded { at: Timestamp },
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AttemptProgress {
    Unrecorded,
    Recorded { progress: Progress },
}

/// One claim and its own contributions within the bounded event history.
#[derive(Debug, Serialize, JsonSchema)]
pub struct AttemptFlow {
    pub attempt: Attempt,
    pub worker: RecordedActor,
    pub ownership: TaskOwnership,
    pub started: AttemptStart,
    pub updated_at: Timestamp,
    pub last_event: EventKind,
    pub progress: AttemptProgress,
}

impl AttemptFlow {
    fn new(event: &Event) -> Self {
        Self {
            attempt: event.task.common.attempt,
            worker: RecordedActor::from_state(&event.task.state),
            ownership: event.task.ownership.clone(),
            started: AttemptStart::Unrecorded,
            updated_at: event.task.common.last_update,
            last_event: event.kind.clone(),
            progress: AttemptProgress::Unrecorded,
        }
    }

    #[must_use]
    fn recording(mut self, event: &Event) -> Self {
        self.worker = self.worker.observing(&event.task.state);
        match event.kind {
            EventKind::Claimed => {
                self.started = AttemptStart::Recorded {
                    at: event.task.common.last_update,
                };
            }
            EventKind::Progress | EventKind::Checkpoint | EventKind::Ready => {
                // A new claim inherits the previous snapshot's progress. Only
                // an explicit worker update establishes this attempt's result.
                match self.progress {
                    AttemptProgress::Unrecorded => {
                        self.progress = AttemptProgress::Recorded {
                            progress: event.task.common.progress.clone(),
                        }
                    }
                    AttemptProgress::Recorded { .. } => {}
                }
            }
            EventKind::Created
            | EventKind::Assigned
            | EventKind::Heartbeat
            | EventKind::Integrated
            | EventKind::Completed
            | EventKind::Requeued
            | EventKind::Cancelled => {}
        }
        self
    }
}

impl TaskFlow {
    #[must_use]
    pub(super) fn recording_attempt(mut self, event: &Event) -> Self {
        // Assignment edits while queued still carry the old attempt number.
        match event.task.common.attempt {
            Attempt::UNCLAIMED => return self,
            _attempt => {}
        }
        match event.kind {
            EventKind::Created | EventKind::Assigned => return self,
            EventKind::Claimed
            | EventKind::Progress
            | EventKind::Checkpoint
            | EventKind::Ready
            | EventKind::Heartbeat
            | EventKind::Integrated
            | EventKind::Completed
            | EventKind::Requeued
            | EventKind::Cancelled => {}
        }
        match self
            .attempts
            .iter()
            .position(|attempt| attempt.attempt == event.task.common.attempt)
        {
            Some(index) => {
                let attempt = self.attempts.remove(index).recording(event);
                self.attempts.insert(index, attempt);
            }
            None => self.attempts.push(AttemptFlow::new(event).recording(event)),
        }
        self
    }
}
