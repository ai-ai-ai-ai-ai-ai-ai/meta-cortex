use super::checkpoint_outcome::CheckpointOutcome;
use super::{Event, EventKind, Task};
use crate::LedgerError;
use crate::agents::AgentId;
use crate::values::Note;
use crate::versions::{
    EventRecordVersion, RecordVersion, VersionFamily, VersionNumber, VersionParseError,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Released V1 envelope, retained without synthesizing outcome evidence.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EventV1 {
    pub version: RecordVersion,
    pub kind: EventKind,
    pub actor: AgentId,
    pub note: Note,
    pub task: Task,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct EventV2 {
    pub version: EventVersionV2,
    pub outcomes: Vec<CheckpointOutcome>,
    pub kind: EventKind,
    pub actor: AgentId,
    pub note: Note,
    pub task: Task,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EventRecord {
    V2(EventV2),
    V1(EventV1),
}

impl EventV2 {
    fn require_outcomes(&self) -> Result<(), LedgerError> {
        CheckpointOutcome::require_distinct(&self.outcomes)?;
        match self.kind {
            EventKind::Checkpoint => {}
            EventKind::Created
            | EventKind::Claimed
            | EventKind::Assigned
            | EventKind::Heartbeat
            | EventKind::Progress
            | EventKind::Ready
            | EventKind::Integrated
            | EventKind::Completed
            | EventKind::Requeued
            | EventKind::Cancelled => match self.outcomes.as_slice() {
                [] => {}
                _ => {
                    return Err(LedgerError::Invalid("outcomes require a checkpoint event"));
                }
            },
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum EventEnvelope {
    V1,
    V2 { outcomes: Vec<CheckpointOutcome> },
}
impl EventEnvelope {
    pub fn version(&self) -> EventRecordVersion {
        match self {
            Self::V1 => EventRecordVersion::V1,
            Self::V2 { .. } => EventRecordVersion::V2,
        }
    }
    pub fn outcomes(&self) -> &[CheckpointOutcome] {
        match self {
            Self::V1 => &[],
            Self::V2 { outcomes } => outcomes,
        }
    }
}

impl From<Event> for EventRecord {
    fn from(event: Event) -> Self {
        match event.envelope {
            EventEnvelope::V1 => Self::V1(EventV1 {
                version: RecordVersion::V1,
                kind: event.kind,
                actor: event.actor,
                note: event.note,
                task: event.task,
            }),
            EventEnvelope::V2 { outcomes } => Self::V2(EventV2 {
                version: EventVersionV2::V2,
                outcomes,
                kind: event.kind,
                actor: event.actor,
                note: event.note,
                task: event.task,
            }),
        }
    }
}
impl TryFrom<EventRecord> for Event {
    type Error = LedgerError;
    fn try_from(record: EventRecord) -> Result<Self, Self::Error> {
        match record {
            EventRecord::V1(event) => Ok(Self {
                envelope: EventEnvelope::V1,
                kind: event.kind,
                actor: event.actor,
                note: event.note,
                task: event.task,
            }),
            EventRecord::V2(event) => {
                event.require_outcomes()?;
                Ok(Self {
                    envelope: EventEnvelope::V2 {
                        outcomes: event.outcomes,
                    },
                    kind: event.kind,
                    actor: event.actor,
                    note: event.note,
                    task: event.task,
                })
            }
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64", into = "i64")]
#[schemars(with = "i64", extend("const" = i64::from(Self::V2)))]
pub enum EventVersionV2 {
    V2,
}
impl TryFrom<i64> for EventVersionV2 {
    type Error = VersionParseError;
    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match EventRecordVersion::try_from(version)? {
            EventRecordVersion::V2 => Ok(Self::V2),
            EventRecordVersion::V1 => Err(Self::Error::Unsupported {
                schema: VersionFamily::EventRecord,
                version: VersionNumber::from(version),
            }),
        }
    }
}
impl From<EventVersionV2> for i64 {
    fn from(version: EventVersionV2) -> Self {
        match version {
            EventVersionV2::V2 => 2,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{EventEnvelope, EventRecord, EventV1, EventVersionV2};
    use crate::agents::{AgentId, DevelopmentAgent};
    use crate::model::checkpoint_outcome::{CheckpointOutcome, OutcomeId};
    use crate::model::worker::WorkerIdentity;
    use crate::model::workflow::TaskOwnership;
    use crate::model::{
        Checkpoint, Event, EventKind, Progress, Task, TaskCommon, TaskState, Workspace,
    };
    use crate::values::{Attempt, FeatureId, Note, TaskId, TaskRevision, Timestamp};
    use crate::versions::{EventRecordVersion, RecordVersion, TaskRecordVersion};

    struct Scenario;
    impl Scenario {
        fn event() -> anyhow::Result<Event> {
            Ok(Event {
                envelope: EventEnvelope::V2 {
                    outcomes: vec![CheckpointOutcome {
                        id: OutcomeId::try_from("implemented".to_owned())?,
                        summary: Note::from("Implemented the behavior".to_owned()),
                        detail: Note::Empty,
                    }],
                },
                kind: EventKind::Checkpoint,
                actor: AgentId::Development(DevelopmentAgent::RustDev),
                note: Note::Empty,
                task: Task {
                    version: TaskRecordVersion::CURRENT,
                    worker: WorkerIdentity::Unrecorded,
                    common: TaskCommon {
                        id: TaskId::try_from("task".to_owned())?,
                        feature: FeatureId::try_from("feature".to_owned())?,
                        objective: Note::Empty,
                        acceptance: vec![Note::Empty],
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
                            extensions: Default::default(),
                        },
                    },
                    ownership: TaskOwnership::Unrecorded,
                    workspace: Workspace::ReadOnly,
                    state: TaskState::Queued,
                },
            })
        }
        fn legacy(event: Event) -> EventV1 {
            EventV1 {
                version: RecordVersion::V1,
                kind: event.kind,
                actor: event.actor,
                note: event.note,
                task: event.task,
            }
        }
    }
    #[test]
    fn v1_retains_version_and_missing_evidence_and_v2_round_trips_outcomes() -> anyhow::Result<()> {
        let event = Scenario::event()?;
        let encoded = serde_json::to_string(&event)?;
        let decoded: Event = serde_json::from_str(&encoded)?;
        assert_eq!(decoded, event);
        assert_eq!(decoded.envelope.version(), EventRecordVersion::V2);
        let legacy = Scenario::legacy(event);
        let encoded = serde_json::to_string(&legacy)?;
        let decoded: Event = serde_json::from_str(&encoded)?;
        assert_eq!(decoded.envelope.version(), EventRecordVersion::V1);
        assert!(decoded.envelope.outcomes().is_empty());
        assert_eq!(serde_json::to_string(&decoded)?, encoded);
        Ok(())
    }
    #[test]
    fn decoder_rejects_future_versions_wrong_version_shapes_and_invalid_outcome_sets()
    -> anyhow::Result<()> {
        let event = Scenario::event()?;
        let EventRecord::V2(mut record) = EventRecord::from(event) else {
            anyhow::bail!("expected V2");
        };
        record.outcomes.extend(record.outcomes.clone());
        assert!(serde_json::from_str::<Event>(&serde_json::to_string(&record)?).is_err());
        record.outcomes.truncate(1);
        record.kind = EventKind::Progress;
        assert!(serde_json::from_str::<Event>(&serde_json::to_string(&record)?).is_err());
        for version in [1, 99] {
            // Deliberately unsupported/wrong-shape external input at the decoder boundary.
            let mut invalid = serde_json::to_value(&record)?;
            invalid["version"] = serde_json::Value::from(version);
            assert!(serde_json::from_value::<Event>(invalid).is_err());
        }
        assert!(EventVersionV2::try_from(1).is_err());
        assert!(EventVersionV2::try_from(99).is_err());
        assert!(EventRecordVersion::try_from(99).is_err());
        let EventRecord::V2(mut record) = EventRecord::from(Scenario::event()?) else {
            anyhow::bail!("expected V2");
        };
        record.outcomes.clear();
        record.kind = EventKind::Progress;
        let decoded: Event = serde_json::from_str(&serde_json::to_string(&record)?)?;
        assert!(decoded.envelope.outcomes().is_empty());
        Ok(())
    }
}
