//! Explicit included implementation outcomes. No Git reads or lifecycle-summary inference.
use super::SequenceProvenance;
use super::revision_log::SequencedEvent;
use crate::agents::AgentId;
use crate::model::checkpoint_outcome::OutcomeId;
use crate::model::{Checkpoint, EventKind, Task, TaskState, Workspace};
use crate::values::{CommitId, EventSequence, Note, TaskId, TaskRevision, Timestamp};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct FeatureLogEvidence {
    pub at: Timestamp,
    /// The agent that recorded this evidence, never Git authorship.
    pub actor: AgentId,
    pub revision: TaskRevision,
    pub sequence: EventSequence,
    pub provenance: SequenceProvenance,
}
impl From<&SequencedEvent> for FeatureLogEvidence {
    fn from(record: &SequencedEvent) -> Self {
        Self {
            at: record.event.task.common.last_update,
            actor: record.event.actor,
            revision: record.event.task.common.revision,
            sequence: record.sequence,
            provenance: record.provenance,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct FeatureLogCheckpoint {
    pub commit: CommitId,
    pub recorded: FeatureLogEvidence,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct FeatureLogEntry {
    pub id: OutcomeId,
    pub task: TaskId,
    pub summary: Note,
    pub detail: Note,
    /// Earliest declaration of this stable task-local milestone identity.
    pub first_recorded: FeatureLogEvidence,
    /// Latest complete-set reaffirmation, including the final checkpoint SHA.
    pub checkpoint: FeatureLogCheckpoint,
    /// Actual recorded integration completion, independently of milestone time.
    pub integration: FeatureLogCheckpoint,
}
pub(super) struct TaskLogSource<'a> {
    pub task: &'a Task,
    pub records: &'a [SequencedEvent],
}
struct IncludedCheckpoint<'a> {
    task: &'a Task,
    checkpoint: &'a SequencedEvent,
    integration: &'a SequencedEvent,
    records: &'a [SequencedEvent],
}
enum TaskLogInclusion<'a> {
    MissingEvidence,
    Included(IncludedCheckpoint<'a>),
}
impl<'a> From<TaskLogSource<'a>> for TaskLogInclusion<'a> {
    fn from(source: TaskLogSource<'a>) -> Self {
        let Workspace::Git { .. } = source.task.workspace else {
            return Self::MissingEvidence;
        };
        let TaskState::Integrated { .. } = &source.task.state else {
            return Self::MissingEvidence;
        };
        let Checkpoint::Git {
            commit: checkpoint_commit,
        } = &source.task.common.checkpoint
        else {
            return Self::MissingEvidence;
        };
        let Some(integration) = source.records.iter().rev().find(|record| {
            matches!(&record.event.kind, EventKind::Integrated)
                && record.event.task.state == source.task.state
        }) else {
            return Self::MissingEvidence;
        };
        let Some(checkpoint) = source.records.iter().rev().find(|record| {
            matches!(&record.event.kind, EventKind::Checkpoint)
                && record.event.task.common.revision < integration.event.task.common.revision
        }) else {
            return Self::MissingEvidence;
        };
        match &checkpoint.event.task.common.checkpoint {
            Checkpoint::Git { commit: recorded } if recorded == checkpoint_commit => {}
            Checkpoint::Git { .. } | Checkpoint::Unrecorded => return Self::MissingEvidence,
        }
        // The integrated event's checkpoint must itself reaffirm the same recorded SHA.
        match &integration.event.task.common.checkpoint {
            Checkpoint::Git { commit: recorded } if recorded == checkpoint_commit => {}
            Checkpoint::Git { .. } | Checkpoint::Unrecorded => return Self::MissingEvidence,
        }
        Self::Included(IncludedCheckpoint {
            task: source.task,
            checkpoint,
            integration,
            records: source.records,
        })
    }
}
struct OutcomeDeclaration {
    recorded: FeatureLogEvidence,
    position: OutcomePosition,
}
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, derive_more::From)]
struct OutcomePosition(usize);
struct DeclaredMilestone {
    entry: FeatureLogEntry,
    position: OutcomePosition,
}
impl IncludedCheckpoint<'_> {
    fn declarations(&self) -> BTreeMap<OutcomeId, OutcomeDeclaration> {
        let mut declarations = BTreeMap::new();
        for record in self.records.iter().filter(|record| {
            matches!(record.event.kind, EventKind::Checkpoint)
                && record.event.task.common.revision <= self.checkpoint.event.task.common.revision
        }) {
            for (position, outcome) in record.event.envelope.outcomes().iter().enumerate() {
                declarations
                    .entry(outcome.id.clone())
                    .or_insert(OutcomeDeclaration {
                        recorded: FeatureLogEvidence::from(record),
                        position: OutcomePosition::from(position),
                    });
            }
        }
        declarations
    }
    fn entries(self) -> Vec<FeatureLogEntry> {
        let Checkpoint::Git { commit } = &self.task.common.checkpoint else {
            return Vec::new();
        };
        let TaskState::Integrated { commit: integrated } = &self.task.state else {
            return Vec::new();
        };
        let declarations = self.declarations();
        let mut milestones = Vec::new();
        for outcome in self.checkpoint.event.envelope.outcomes() {
            let Some(declaration) = declarations.get(&outcome.id) else {
                continue;
            };
            milestones.push(DeclaredMilestone {
                entry: FeatureLogEntry {
                    id: outcome.id.clone(),
                    task: self.task.common.id.clone(),
                    summary: outcome.summary.clone(),
                    detail: outcome.detail.clone(),
                    first_recorded: declaration.recorded.clone(),
                    checkpoint: FeatureLogCheckpoint {
                        commit: commit.clone(),
                        recorded: FeatureLogEvidence::from(self.checkpoint),
                    },
                    integration: FeatureLogCheckpoint {
                        commit: integrated.clone(),
                        recorded: FeatureLogEvidence::from(self.integration),
                    },
                },
                position: declaration.position,
            });
        }
        milestones.sort_by(|left, right| {
            left.entry
                .first_recorded
                .sequence
                .cmp(&right.entry.first_recorded.sequence)
                .then(left.position.cmp(&right.position))
        });
        milestones
            .into_iter()
            .map(|milestone| milestone.entry)
            .collect()
    }
}
/// Already ordered newest integration first, then original declaration order.
#[derive(Debug, Default, Serialize, JsonSchema)]
#[serde(transparent)]
pub struct FeatureLog(Vec<FeatureLogEntry>);
impl FeatureLog {
    #[must_use]
    pub(super) fn include(mut self, source: TaskLogSource<'_>) -> Self {
        match TaskLogInclusion::from(source) {
            TaskLogInclusion::MissingEvidence => {}
            TaskLogInclusion::Included(checkpoint) => self.0.extend(checkpoint.entries()),
        }
        self
    }
    #[must_use]
    pub(super) fn ordered(mut self) -> Self {
        self.0.sort_by(|left, right| {
            right
                .integration
                .recorded
                .sequence
                .cmp(&left.integration.recorded.sequence)
        });
        self
    }
    pub fn entries(&self) -> &[FeatureLogEntry] {
        let Self(entries) = self;
        entries
    }
}

#[cfg(test)]
mod tests {
    use super::{FeatureLog, TaskLogSource};
    use crate::agents::{AgentId, DevelopmentAgent, GizmoAgent};
    use crate::model::checkpoint_outcome::{CheckpointOutcome, OutcomeId};
    use crate::model::event_record::EventEnvelope;
    use crate::model::worker::WorkerIdentity;
    use crate::model::workflow::TaskOwnership;
    use crate::model::{
        Checkpoint, Event, EventKind, Progress, Task, TaskCommon, TaskState, Workspace,
    };
    use crate::store::observation::SequenceProvenance;
    use crate::store::observation::revision_log::SequencedEvent;
    use crate::values::{
        Attempt, BranchName, CommitId, EventSequence, FeatureId, LeaseSeconds, Note, TaskId,
        TaskRevision, Timestamp,
    };
    use crate::versions::TaskRecordVersion;
    use std::path::PathBuf;

    struct Scenario {
        task: Task,
        records: Vec<SequencedEvent>,
    }
    struct MilestoneCheckpoint {
        commit: CommitId,
        outcomes: Vec<CheckpointOutcome>,
    }
    struct RecordedChange {
        kind: EventKind,
        outcomes: Vec<CheckpointOutcome>,
    }
    impl Scenario {
        fn new() -> anyhow::Result<Self> {
            Ok(Self {
                task: Task {
                    version: TaskRecordVersion::CURRENT,
                    worker: WorkerIdentity::Unrecorded,
                    common: TaskCommon {
                        id: TaskId::try_from("implementation".to_owned())?,
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
                            summary: Note::from("Lifecycle noise".to_owned()),
                            findings: Vec::new(),
                            next_steps: Vec::new(),
                            checks: Vec::new(),
                            extensions: Default::default(),
                        },
                    },
                    ownership: TaskOwnership::Unrecorded,
                    workspace: Workspace::Git {
                        branch: BranchName::try_from("codex/task".to_owned())?,
                        path: PathBuf::from("/task"),
                    },
                    state: TaskState::Queued,
                },
                records: Vec::new(),
            })
        }
        fn outcome(id: OutcomeId) -> CheckpointOutcome {
            CheckpointOutcome {
                id,
                summary: Note::from("A real completed change".to_owned()),
                detail: Note::from("Implemented behavior and checked it".to_owned()),
            }
        }
        fn checkpoint(mut self, input: MilestoneCheckpoint) -> anyhow::Result<Self> {
            self.task.common.checkpoint = Checkpoint::Git {
                commit: input.commit,
            };
            self.record(RecordedChange {
                kind: EventKind::Checkpoint,
                outcomes: input.outcomes,
            })
        }
        fn record(mut self, input: RecordedChange) -> anyhow::Result<Self> {
            self.task.common.revision = self.task.common.revision.advance()?;
            self.task.common.last_update = self
                .task
                .common
                .last_update
                .expires(LeaseSeconds::TEN_MINUTES)?;
            self.records.push(SequencedEvent {
                sequence: EventSequence::from(i64::from(self.task.common.revision)),
                provenance: SequenceProvenance::CommittedAppend,
                event: Event {
                    envelope: EventEnvelope::V2 {
                        outcomes: input.outcomes,
                    },
                    kind: input.kind,
                    actor: AgentId::Development(DevelopmentAgent::RustDev),
                    note: Note::Empty,
                    task: self.task.clone(),
                },
            });
            Ok(self)
        }
        fn integrate(mut self) -> anyhow::Result<Self> {
            self.task.state = TaskState::Integrated {
                commit: CommitId::try_from("f".repeat(40))?,
            };
            let mut integrated = self.record(RecordedChange {
                kind: EventKind::Integrated,
                outcomes: Vec::new(),
            })?;
            let Some(record) = integrated.records.last_mut() else {
                anyhow::bail!("integration event missing");
            };
            record.event.actor = AgentId::Gizmo(GizmoAgent::Gizmo);
            Ok(integrated)
        }
        fn log(&self) -> FeatureLog {
            FeatureLog::default()
                .include(TaskLogSource {
                    task: &self.task,
                    records: &self.records,
                })
                .ordered()
        }
    }
    #[test]
    fn two_milestones_survive_reaffirmation_without_text_dedup_or_private_sha_inclusion()
    -> anyhow::Result<()> {
        let first = Scenario::outcome(OutcomeId::try_from("first".to_owned())?);
        let second = Scenario::outcome(OutcomeId::try_from("second".to_owned())?);
        let private = CommitId::try_from("a".repeat(40))?;
        let final_sha = CommitId::try_from("b".repeat(40))?;
        let scenario = Scenario::new()?
            .checkpoint(MilestoneCheckpoint {
                commit: private,
                outcomes: vec![first.clone()],
            })?
            .checkpoint(MilestoneCheckpoint {
                commit: final_sha.clone(),
                outcomes: vec![second.clone(), first.clone()],
            })?
            .checkpoint(MilestoneCheckpoint {
                commit: final_sha.clone(),
                outcomes: vec![second, first],
            })?
            .integrate()?;
        let log = scenario.log();
        let [first, second] = log.entries() else {
            anyhow::bail!("expected distinct milestones");
        };
        assert_eq!(first.id.to_string(), "first");
        assert_eq!(second.id.to_string(), "second");
        assert_eq!(first.summary, second.summary);
        assert_eq!(first.checkpoint.commit, final_sha);
        assert_eq!(second.checkpoint.commit, final_sha);
        assert!(first.first_recorded.sequence < second.first_recorded.sequence);
        assert!(first.first_recorded.at < first.checkpoint.recorded.at);
        assert!(first.checkpoint.recorded.at < first.integration.recorded.at);
        assert_eq!(
            first.integration.recorded.actor,
            AgentId::Gizmo(GizmoAgent::Gizmo)
        );
        assert_eq!(
            first.checkpoint.recorded.actor,
            AgentId::Development(DevelopmentAgent::RustDev)
        );
        Ok(())
    }
    #[test]
    fn latest_set_replaces_earlier_set_and_ready_has_no_visible_outcomes() -> anyhow::Result<()> {
        let checkpoint = CommitId::try_from("a".repeat(40))?;
        let mut scenario = Scenario::new()?
            .checkpoint(MilestoneCheckpoint {
                commit: checkpoint.clone(),
                outcomes: vec![Scenario::outcome(OutcomeId::try_from(
                    "removed".to_owned(),
                )?)],
            })?
            .checkpoint(MilestoneCheckpoint {
                commit: checkpoint,
                outcomes: vec![Scenario::outcome(OutcomeId::try_from(
                    "included".to_owned(),
                )?)],
            })?;
        scenario.task.state = TaskState::Ready {
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            attempt: Attempt::UNCLAIMED,
        };
        assert!(scenario.log().entries().is_empty());
        let scenario = scenario.integrate()?;
        let log = scenario.log();
        assert_eq!(log.entries().len(), 1);
        assert_eq!(log.entries()[0].id.to_string(), "included");
        let mut empty = Scenario::new()?
            .checkpoint(MilestoneCheckpoint {
                commit: CommitId::try_from("a".repeat(40))?,
                outcomes: vec![Scenario::outcome(OutcomeId::try_from(
                    "removed".to_owned(),
                )?)],
            })?
            .checkpoint(MilestoneCheckpoint {
                commit: CommitId::try_from("b".repeat(40))?,
                outcomes: Vec::new(),
            })?
            .integrate()?;
        assert!(empty.log().entries().is_empty());
        empty.task.common.checkpoint = Checkpoint::Unrecorded;
        assert!(empty.log().entries().is_empty());
        Ok(())
    }
    #[test]
    fn missing_integration_or_checkpoint_and_read_only_activity_are_never_inferred()
    -> anyhow::Result<()> {
        let mut scenario = Scenario::new()?
            .checkpoint(MilestoneCheckpoint {
                commit: CommitId::try_from("a".repeat(40))?,
                outcomes: vec![Scenario::outcome(OutcomeId::try_from(
                    "implemented".to_owned(),
                )?)],
            })?
            .integrate()?;
        scenario.records.pop();
        assert!(scenario.log().entries().is_empty());
        scenario.task.common.checkpoint = Checkpoint::Git {
            commit: CommitId::try_from("b".repeat(40))?,
        };
        scenario = scenario.integrate()?;
        assert!(scenario.log().entries().is_empty());
        scenario.task.workspace = Workspace::ReadOnly;
        assert!(scenario.log().entries().is_empty());
        let unrecorded = Scenario::new()?.integrate()?;
        assert!(unrecorded.log().entries().is_empty());
        Ok(())
    }
    #[test]
    fn lifecycle_noise_is_excluded_and_integration_sequence_controls_order_over_timestamps()
    -> anyhow::Result<()> {
        let checkpoint = CommitId::try_from("a".repeat(40))?;
        let mut early = Scenario::new()?.checkpoint(MilestoneCheckpoint {
            commit: checkpoint.clone(),
            outcomes: vec![Scenario::outcome(OutcomeId::try_from("early".to_owned())?)],
        })?;
        for kind in [
            EventKind::Heartbeat,
            EventKind::Progress,
            EventKind::Assigned,
            EventKind::Requeued,
            EventKind::Ready,
        ] {
            early = early.record(RecordedChange {
                kind,
                outcomes: Vec::new(),
            })?;
        }
        early = early.integrate()?;
        let mut later = Scenario::new()?
            .checkpoint(MilestoneCheckpoint {
                commit: checkpoint,
                outcomes: vec![Scenario::outcome(OutcomeId::try_from("later".to_owned())?)],
            })?
            .integrate()?;
        later.task.common.id = TaskId::try_from("other".to_owned())?;
        for record in &mut later.records {
            record.event.task.common.id = later.task.common.id.clone();
        }
        let Some(integration) = later.records.last_mut() else {
            anyhow::bail!("integration event missing");
        };
        integration.sequence = EventSequence::from(99);
        integration.event.task.common.last_update = Timestamp::EPOCH;
        let log = FeatureLog::default()
            .include(TaskLogSource {
                task: &early.task,
                records: &early.records,
            })
            .include(TaskLogSource {
                task: &later.task,
                records: &later.records,
            })
            .ordered();
        assert_eq!(log.entries().len(), 2);
        assert_eq!(log.entries()[0].id.to_string(), "later");
        assert!(
            log.entries()[0].integration.recorded.at < log.entries()[1].integration.recorded.at
        );
        Ok(())
    }
}
