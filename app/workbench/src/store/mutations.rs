use super::{Documents, Ledger};
use crate::LedgerError;
use crate::git::{CheckpointCheck, IntegrationCheck, ReadyCheck, Repository};
use crate::model::{Checkpoint, ClaimAt, Event, EventKind, Feature, Phase, Task, WorkerAt};
use crate::request::{ClaimTask, CoordinatorAction, CoordinatorUpdate, WorkerAction, WorkerUpdate};
use crate::values::{Note, Timestamp};
use crate::versions::RecordVersion;
use turso::transaction::TransactionBehavior;

struct TaskChange<'a> {
    task: Task,
    repository: &'a Repository,
    feature: &'a Feature,
    now: Timestamp,
}

impl Ledger {
    pub async fn claim(&mut self, input: ClaimTask) -> Result<Task, LedgerError> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents { connection: &tx };
        let mut task = documents.task(&input.task).await?;
        task.require_revision(input.expected_revision)?;
        for dependency in &task.dependencies {
            documents.task(dependency).await?.require_dependency()?;
        }
        self.repository.require_workspace(&task.workspace)?;
        let now = Timestamp::now()?;
        task.claim(ClaimAt {
            agent: input.agent.clone(),
            ttl: input.ttl_seconds,
            now,
        })?;
        task.last_update = now;
        let task = documents
            .save(Event {
                version: RecordVersion::CURRENT,
                kind: EventKind::Claimed,
                actor: input.agent,
                note: Note::try_from("Assignment claimed".to_owned())?,
                task,
            })
            .await?;
        tx.commit().await?;
        Ok(task)
    }

    pub async fn update(&mut self, input: WorkerUpdate) -> Result<Task, LedgerError> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents { connection: &tx };
        let task = documents.task(&input.task).await?;
        task.require_revision(input.expected_revision)?;
        let change = TaskChange {
            task,
            repository: &self.repository,
            feature: &self.feature,
            now: Timestamp::now()?,
        };
        let task = documents.save(change.worker(input)?).await?;
        tx.commit().await?;
        Ok(task)
    }

    pub async fn coordinate(&mut self, input: CoordinatorUpdate) -> Result<Task, LedgerError> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents { connection: &tx };
        let task = documents.task(&input.task).await?;
        task.require_revision(input.expected_revision)?;
        let change = TaskChange {
            task,
            repository: &self.repository,
            feature: &self.feature,
            now: Timestamp::now()?,
        };
        let task = documents.save(change.coordinate(input)?).await?;
        tx.commit().await?;
        Ok(task)
    }
}

impl TaskChange<'_> {
    fn worker(mut self, input: WorkerUpdate) -> Result<Event, LedgerError> {
        self.task.worker(WorkerAt {
            agent: &input.agent,
            attempt: input.attempt,
            now: self.now,
        })?;
        let kind = self.apply_worker(&input)?;
        self.task.last_update = self.now;
        Ok(Event {
            version: RecordVersion::CURRENT,
            kind,
            actor: input.agent,
            note: self.task.progress.summary.clone(),
            task: self.task,
        })
    }

    fn apply_worker(&mut self, input: &WorkerUpdate) -> Result<EventKind, LedgerError> {
        let assignment = self.task.worker(WorkerAt {
            agent: &input.agent,
            attempt: input.attempt,
            now: self.now,
        })?;
        match &input.action {
            WorkerAction::Heartbeat { ttl_seconds } => {
                assignment.expires_at = self.now.expires(*ttl_seconds)?;
                Ok(EventKind::Heartbeat)
            }
            WorkerAction::Progress {
                ttl_seconds,
                phase,
                progress,
            } => {
                assignment.expires_at = self.now.expires(*ttl_seconds)?;
                assignment.phase = phase.clone();
                self.task.progress = progress.clone();
                self.task.last_progress = self.now;
                Ok(EventKind::Progress)
            }
            WorkerAction::Checkpoint {
                ttl_seconds,
                commit,
                progress,
            } => {
                assignment.expires_at = self.now.expires(*ttl_seconds)?;
                assignment.phase = Phase::Working;
                self.repository.checkpoint(CheckpointCheck {
                    workspace: &self.task.workspace,
                    commit,
                })?;
                self.task.checkpoint = Checkpoint::Git {
                    commit: commit.clone(),
                };
                self.task.progress = progress.clone();
                self.task.last_progress = self.now;
                Ok(EventKind::Checkpoint)
            }
            WorkerAction::Ready { progress } => {
                self.repository.ready(ReadyCheck {
                    workspace: &self.task.workspace,
                    checkpoint: &self.task.checkpoint,
                })?;
                self.task.ready(WorkerAt {
                    agent: &input.agent,
                    attempt: input.attempt,
                    now: self.now,
                })?;
                self.task.progress = progress.clone();
                self.task.last_progress = self.now;
                Ok(EventKind::Ready)
            }
        }
    }

    fn coordinate(mut self, input: CoordinatorUpdate) -> Result<Event, LedgerError> {
        let (kind, note) = match input.action {
            CoordinatorAction::Integrate { commit } => {
                self.repository.integrated(IntegrationCheck {
                    feature: self.feature,
                    checkpoint: &self.task.checkpoint,
                    commit: &commit,
                })?;
                self.task.integrate(commit)?;
                (
                    EventKind::Integrated,
                    Note::try_from("Integration recorded by the integration owner".to_owned())?,
                )
            }
            CoordinatorAction::Requeue {
                reason,
                previous_execution: _,
            } => {
                self.task.requeue()?;
                (EventKind::Requeued, reason)
            }
            CoordinatorAction::Cancel { reason } => {
                self.task.cancel(reason.clone())?;
                (EventKind::Cancelled, reason)
            }
        };
        self.task.last_update = self.now;
        Ok(Event {
            version: RecordVersion::CURRENT,
            kind,
            actor: input.actor,
            note,
            task: self.task,
        })
    }
}
