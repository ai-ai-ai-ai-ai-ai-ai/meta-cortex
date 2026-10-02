use super::{Documents, Ledger};
use crate::LedgerError;
use crate::git::{CheckpointCheck, IntegrationCheck, ReadyCheck, Repository, TaskWorkspaceCheck};
use crate::model::{
    Checkpoint, ClaimAt, Event, EventKind, Feature, Phase, Task, TaskState, WorkerAt,
};
use crate::request::{
    AssignTask, ClaimTask, CoordinatorAction, CoordinatorUpdate, WorkerAction, WorkerUpdate,
};
use crate::values::{Note, Timestamp};
use crate::versions::RecordVersion;
use turso::transaction::TransactionBehavior;

struct TaskChange<'a> {
    task: Task,
    repository: &'a Repository,
    feature: &'a Feature,
    now: Timestamp,
}

struct EventDetails {
    kind: EventKind,
    note: Note,
}

impl Ledger {
    /// Turso transactions require a mutable borrow of the connection resource.
    pub async fn assign(&mut self, input: AssignTask) -> Result<Task, LedgerError> {
        match input.feature == self.state.feature.id {
            true => {}
            false => return Err(LedgerError::Invalid("feature mismatch")),
        }
        let tx = self
            .state
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents {
            connection: &tx,
            feature: &self.state.feature.id,
        };
        let task = documents.task(&input.task).await?;
        task.require_revision(input.expected_revision)?;
        let mut task = task.assign(input.assignment)?;
        task.last_update = Timestamp::now()?;
        let task = documents
            .save(Event {
                version: RecordVersion::CURRENT,
                kind: EventKind::Assigned,
                actor: input.actor,
                note: Note::from("Agent and reporting coordinator assigned".to_owned()),
                task,
            })
            .await?;
        tx.commit().await?;
        Ok(task)
    }

    pub async fn claim(&mut self, input: ClaimTask) -> Result<Task, LedgerError> {
        match input.feature == self.state.feature.id {
            true => {}
            false => return Err(LedgerError::Invalid("feature mismatch")),
        }
        let tx = self
            .state
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents {
            connection: &tx,
            feature: &self.state.feature.id,
        };
        let mut task = documents.task(&input.task).await?;
        task.require_revision(input.expected_revision)?;
        for dependency in &task.dependencies {
            documents.task(dependency).await?.require_dependency()?;
        }
        self.repository.require_task_workspace(TaskWorkspaceCheck {
            workspace: &task.workspace,
            feature: &self.state.feature,
        })?;
        let now = Timestamp::now()?;
        task = task.claim(ClaimAt {
            agent: input.agent,
            ttl: input.ttl_seconds,
            now,
        })?;
        task.last_update = now;
        let task = documents
            .save(Event {
                version: RecordVersion::CURRENT,
                kind: EventKind::Claimed,
                actor: input.agent,
                note: Note::from("Assignment claimed".to_owned()),
                task,
            })
            .await?;
        tx.commit().await?;
        Ok(task)
    }

    pub async fn update(&mut self, input: WorkerUpdate) -> Result<Task, LedgerError> {
        match input.feature == self.state.feature.id {
            true => {}
            false => return Err(LedgerError::Invalid("feature mismatch")),
        }
        let tx = self
            .state
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents {
            connection: &tx,
            feature: &self.state.feature.id,
        };
        let task = documents.task(&input.task).await?;
        task.require_revision(input.expected_revision)?;
        let change = TaskChange {
            task,
            repository: &self.repository,
            feature: &self.state.feature,
            now: Timestamp::now()?,
        };
        let task = documents.save(change.worker(input)?).await?;
        tx.commit().await?;
        Ok(task)
    }

    pub async fn coordinate(&mut self, input: CoordinatorUpdate) -> Result<Task, LedgerError> {
        match input.feature == self.state.feature.id {
            true => {}
            false => return Err(LedgerError::Invalid("feature mismatch")),
        }
        let tx = self
            .state
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents {
            connection: &tx,
            feature: &self.state.feature.id,
        };
        let task = documents.task(&input.task).await?;
        task.require_revision(input.expected_revision)?;
        let change = TaskChange {
            task,
            repository: &self.repository,
            feature: &self.state.feature,
            now: Timestamp::now()?,
        };
        let task = documents.save(change.coordinate(input)?).await?;
        tx.commit().await?;
        Ok(task)
    }
}

impl TaskChange<'_> {
    fn worker(mut self, input: WorkerUpdate) -> Result<Event, LedgerError> {
        let mut assignment = self
            .task
            .worker(WorkerAt {
                agent: &input.agent,
                attempt: input.attempt,
                now: self.now,
            })?
            .clone();
        let kind = match input.action {
            WorkerAction::Heartbeat { ttl_seconds } => {
                assignment.expires_at = self.now.expires(ttl_seconds)?;
                self.task.state = TaskState::Active { assignment };
                EventKind::Heartbeat
            }
            WorkerAction::Progress {
                ttl_seconds,
                phase,
                progress,
            } => {
                assignment.expires_at = self.now.expires(ttl_seconds)?;
                assignment.phase = phase;
                self.task.state = TaskState::Active { assignment };
                self.task.progress = progress;
                self.task.last_progress = self.now;
                EventKind::Progress
            }
            WorkerAction::Checkpoint {
                ttl_seconds,
                commit,
                progress,
            } => {
                self.repository.checkpoint(CheckpointCheck {
                    workspace: &self.task.workspace,
                    commit: &commit,
                })?;
                assignment.expires_at = self.now.expires(ttl_seconds)?;
                assignment.phase = Phase::Working;
                self.task.state = TaskState::Active { assignment };
                self.task.checkpoint = Checkpoint::Git { commit };
                self.task.progress = progress;
                self.task.last_progress = self.now;
                EventKind::Checkpoint
            }
            WorkerAction::Ready { progress } => {
                self.repository.ready(ReadyCheck {
                    workspace: &self.task.workspace,
                    checkpoint: &self.task.checkpoint,
                    feature: self.feature,
                })?;
                self.task = self.task.ready(WorkerAt {
                    agent: &input.agent,
                    attempt: input.attempt,
                    now: self.now,
                })?;
                self.task.progress = progress;
                self.task.last_progress = self.now;
                EventKind::Ready
            }
        };
        self.task.last_update = self.now;
        Ok(Event {
            version: RecordVersion::CURRENT,
            kind,
            actor: input.agent,
            note: self.task.progress.summary.clone(),
            task: self.task,
        })
    }

    fn coordinate(mut self, input: CoordinatorUpdate) -> Result<Event, LedgerError> {
        let details = match input.action {
            CoordinatorAction::Complete => {
                self.task = self.task.complete()?;
                EventDetails {
                    kind: EventKind::Completed,
                    note: Note::from("Activity accepted by its coordinator".to_owned()),
                }
            }
            CoordinatorAction::Integrate { commit } => {
                self.repository.integrated(IntegrationCheck {
                    feature: self.feature,
                    checkpoint: &self.task.checkpoint,
                    commit: &commit,
                })?;
                self.task = self.task.integrate(commit)?;
                EventDetails {
                    kind: EventKind::Integrated,
                    note: Note::from("Integration recorded by the integration owner".to_owned()),
                }
            }
            CoordinatorAction::Requeue {
                reason,
                previous_execution: _,
            } => {
                self.task = self.task.requeue()?;
                EventDetails {
                    kind: EventKind::Requeued,
                    note: reason,
                }
            }
            CoordinatorAction::Cancel { reason } => {
                self.task = self.task.cancel(reason.clone())?;
                EventDetails {
                    kind: EventKind::Cancelled,
                    note: reason,
                }
            }
        };
        self.task.last_update = self.now;
        Ok(Event {
            version: RecordVersion::CURRENT,
            kind: details.kind,
            actor: input.actor,
            note: details.note,
            task: self.task,
        })
    }
}
