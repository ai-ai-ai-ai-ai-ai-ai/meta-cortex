use super::{Documents, Ledger};
use crate::LedgerError;
use crate::git::{CheckpointCheck, IntegrationCheck, ReadyCheck, Repository, TaskWorkspaceCheck};
use crate::model::worker::WorkerIdentity;
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
        task.common.last_update = Timestamp::now()?;
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
        for dependency in &task.common.dependencies {
            documents.task(dependency).await?.require_dependency()?;
        }
        self.repository.require_task_workspace(TaskWorkspaceCheck {
            workspace: &task.workspace,
            feature: &self.state.feature,
        })?;
        let now = Timestamp::now()?;
        task = task.claim(ClaimAt {
            worker_id: input.worker_id,
            agent: input.agent,
            ttl: input.ttl_seconds,
            now,
        })?;
        task.common.last_update = now;
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
                worker_id: input.worker_id,
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
                self.task.common.progress = progress;
                self.task.common.last_progress = self.now;
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
                self.task.common.checkpoint = Checkpoint::Git { commit };
                self.task.common.progress = progress;
                self.task.common.last_progress = self.now;
                EventKind::Checkpoint
            }
            WorkerAction::Ready { progress } => {
                self.repository.ready(ReadyCheck {
                    workspace: &self.task.workspace,
                    checkpoint: &self.task.common.checkpoint,
                    feature: self.feature,
                })?;
                self.task = self.task.ready(WorkerAt {
                    worker_id: input.worker_id,
                    agent: &input.agent,
                    attempt: input.attempt,
                    now: self.now,
                })?;
                self.task.common.progress = progress;
                self.task.common.last_progress = self.now;
                EventKind::Ready
            }
        };
        self.task.worker = WorkerIdentity::Recorded {
            worker_id: input.worker_id,
        };
        self.task.common.last_update = self.now;
        Ok(Event {
            version: RecordVersion::CURRENT,
            kind,
            actor: input.agent,
            note: self.task.common.progress.summary.clone(),
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
                    checkpoint: &self.task.common.checkpoint,
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
        self.task.common.last_update = self.now;
        Ok(Event {
            version: RecordVersion::CURRENT,
            kind: details.kind,
            actor: input.actor,
            note: details.note,
            task: self.task,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::agents::{AgentId, DevelopmentAgent, GizmoAgent};
    use crate::model::worker::WorkerIdentity;
    use crate::model::workflow::TaskOwnership;
    use crate::model::{EventKind, Progress, Task, TaskCommon, TaskState, Workspace};
    use crate::request::{
        ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, InitFeature, StoppedExecution,
        WorkerAction, WorkerUpdate,
    };
    use crate::store::relational::{EventTable, TaskTable};
    use crate::store::sql::SqlStatement;
    use crate::values::{BranchName, FeatureId, LeaseSeconds, Note, TaskId, WorkerId};
    use crate::versions::{RecordVersion, StorageVersion, TaskRecordVersionV2};
    use crate::{DataDirectory, Ledger, LedgerError, Workbench};
    use sea_query::{Expr, ExprTrait, Query};
    use serde::Serialize;
    use tempfile::TempDir;
    use tokio::runtime::Builder;

    struct Scenario {
        directory: TempDir,
        data: TempDir,
    }
    #[derive(Serialize)]
    struct LegacyTask {
        version: TaskRecordVersionV2,
        common: TaskCommon,
        ownership: TaskOwnership,
        workspace: Workspace,
        state: TaskState,
    }
    impl From<Task> for LegacyTask {
        fn from(task: Task) -> Self {
            Self {
                version: TaskRecordVersionV2::V2,
                common: task.common,
                ownership: task.ownership,
                workspace: task.workspace,
                state: task.state,
            }
        }
    }
    #[derive(Serialize)]
    struct LegacyEvent {
        version: RecordVersion,
        kind: EventKind,
        actor: AgentId,
        note: Note,
        task: LegacyTask,
    }
    impl Scenario {
        fn create() -> anyhow::Result<Self> {
            let scenario = Self {
                directory: tempfile::tempdir()?,
                data: tempfile::tempdir()?,
            };
            let mut options = git2::RepositoryInitOptions::new();
            options.initial_head("codex/feature");
            let repository = git2::Repository::init_opts(scenario.directory.path(), &options)?;
            let signature = git2::Signature::now("Fixture", "fixture@example.invalid")?;
            let tree = repository.find_tree(repository.index()?.write_tree()?)?;
            repository.commit(Some("HEAD"), &signature, &signature, "fixture", &tree, &[])?;
            Ok(scenario)
        }
        fn workbench(&self) -> anyhow::Result<Workbench> {
            Ok(Workbench::discover(self.directory.path())?
                .with_data_directory(DataDirectory::from(self.data.path().to_owned())))
        }
        fn progress() -> Progress {
            Progress {
                summary: Note::Empty,
                findings: vec![],
                next_steps: vec![],
                checks: vec![],
                extensions: Default::default(),
            }
        }
        async fn ledger(&self) -> anyhow::Result<Ledger> {
            Ok(self
                .workbench()?
                .initialize(InitFeature {
                    feature: FeatureId::try_from("identity".to_owned())?,
                    objective: Note::Empty,
                    branch: BranchName::try_from("codex/feature".to_owned())?,
                    worktree: self.directory.path().to_owned(),
                })
                .await?)
        }
        async fn legacy_snapshot(ledger: &Ledger) -> anyhow::Result<()> {
            let event = ledger
                .history(&TaskId::try_from("first".to_owned())?)
                .await?
                .pop()
                .ok_or_else(|| anyhow::anyhow!("claim event missing"))?;
            let legacy = LegacyEvent {
                version: event.version,
                kind: event.kind,
                actor: event.actor,
                note: event.note,
                task: event.task.into(),
            };
            SqlStatement::build(
                Query::update()
                    .table(TaskTable::Table)
                    .value(TaskTable::Document, serde_json::to_string(&legacy.task)?)
                    .and_where(Expr::col(TaskTable::Id).eq(legacy.task.common.id.to_string()))
                    .to_owned(),
            )?
            .execute(&ledger.state.connection)
            .await?;
            SqlStatement::build(
                Query::update()
                    .table(EventTable::Table)
                    .value(EventTable::Document, serde_json::to_string(&legacy)?)
                    .and_where(Expr::col(EventTable::TaskId).eq(legacy.task.common.id.to_string()))
                    .and_where(
                        Expr::col(EventTable::Revision).eq(i64::from(legacy.task.common.revision)),
                    )
                    .to_owned(),
            )?
            .execute(&ledger.state.connection)
            .await?;
            Ok(())
        }
        fn heartbeat(task: &Task) -> WorkerUpdate {
            WorkerUpdate {
                worker_id: WorkerId::EXAMPLE,
                feature: task.common.feature.clone(),
                task: task.common.id.clone(),
                expected_revision: task.common.revision,
                agent: AgentId::Development(DevelopmentAgent::RustDev),
                attempt: task.common.attempt,
                action: WorkerAction::Heartbeat {
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                },
            }
        }
    }

    #[test]
    fn legacy_binding_rejects_mismatches_and_preserves_history_across_tasks() -> anyhow::Result<()>
    {
        let scenario = Scenario::create()?;
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let mut ledger = scenario.ledger().await?;
                let agent = AgentId::Development(DevelopmentAgent::RustDev);
                let actor = AgentId::Gizmo(GizmoAgent::Gizmo);
                let original = WorkerId::EXAMPLE;
                let other = WorkerId::generate();
                let mut tasks = Vec::new();
                for id in [
                    TaskId::try_from("first".to_owned())?,
                    TaskId::try_from("second".to_owned())?,
                ] {
                    let task = ledger
                        .create(CreateTask {
                            feature: ledger.info().feature.id,
                            task: id,
                            actor,
                            objective: Note::Empty,
                            acceptance: vec![Note::Empty],
                            dependencies: vec![],
                            workspace: Workspace::ReadOnly,
                            progress: Scenario::progress(),
                        })
                        .await?;
                    tasks.push(
                        ledger
                            .claim(ClaimTask {
                                worker_id: original,
                                feature: task.common.feature,
                                task: task.common.id,
                                expected_revision: task.common.revision,
                                agent,
                                ttl_seconds: LeaseSeconds::TEN_MINUTES,
                            })
                            .await?,
                    );
                }
                let [first, second]: [Task; 2] = tasks
                    .try_into()
                    .map_err(|_| anyhow::anyhow!("expected two tasks"))?;
                assert_eq!(first.worker, second.worker);
                Scenario::legacy_snapshot(&ledger).await?;
                let legacy = ledger.task(&first.common.id).await?.task;
                assert_eq!(legacy.worker, WorkerIdentity::Unrecorded);
                let wrong_role = WorkerUpdate {
                    agent: AgentId::Development(DevelopmentAgent::TypescriptDev),
                    ..Scenario::heartbeat(&legacy)
                };
                assert!(matches!(
                    ledger.update(wrong_role).await,
                    Err(LedgerError::AssignmentChanged)
                ));
                let wrong_attempt = WorkerUpdate {
                    attempt: legacy.common.attempt.advance()?,
                    ..Scenario::heartbeat(&legacy)
                };
                assert!(matches!(
                    ledger.update(wrong_attempt).await,
                    Err(LedgerError::AssignmentChanged)
                ));
                assert_eq!(ledger.task(&first.common.id).await?.task, legacy);
                let bound = ledger.update(Scenario::heartbeat(&legacy)).await?;
                assert_eq!(
                    bound.worker,
                    WorkerIdentity::Recorded {
                        worker_id: original
                    }
                );
                let wrong_worker = WorkerUpdate {
                    worker_id: other,
                    ..Scenario::heartbeat(&bound)
                };
                assert!(matches!(
                    ledger.update(wrong_worker).await,
                    Err(LedgerError::AssignmentChanged)
                ));
                assert_eq!(ledger.task(&first.common.id).await?.task, bound);
                let resumed = ledger.update(Scenario::heartbeat(&bound)).await?;
                let queued = ledger
                    .coordinate(CoordinatorUpdate {
                        feature: resumed.common.feature.clone(),
                        task: resumed.common.id.clone(),
                        expected_revision: resumed.common.revision,
                        actor,
                        action: CoordinatorAction::Requeue {
                            reason: Note::Empty,
                            previous_execution: StoppedExecution::StoppedOrFinished,
                        },
                    })
                    .await?;
                assert_eq!(queued.worker, WorkerIdentity::Unrecorded);
                let replacement = ledger
                    .claim(ClaimTask {
                        worker_id: other,
                        feature: queued.common.feature.clone(),
                        task: queued.common.id.clone(),
                        expected_revision: queued.common.revision,
                        agent,
                        ttl_seconds: LeaseSeconds::TEN_MINUTES,
                    })
                    .await?;
                let ready = ledger
                    .update(WorkerUpdate {
                        worker_id: other,
                        action: WorkerAction::Ready {
                            progress: Scenario::progress(),
                        },
                        ..Scenario::heartbeat(&replacement)
                    })
                    .await?;
                let completed = ledger
                    .coordinate(CoordinatorUpdate {
                        feature: ready.common.feature.clone(),
                        task: ready.common.id.clone(),
                        expected_revision: ready.common.revision,
                        actor,
                        action: CoordinatorAction::Complete,
                    })
                    .await?;
                assert_eq!(
                    completed.worker,
                    WorkerIdentity::Recorded { worker_id: other }
                );
                let history = ledger.history(&first.common.id).await?;
                assert_eq!(history.len(), 8);
                assert_eq!(history[1].task.worker, WorkerIdentity::Unrecorded);
                assert_eq!(
                    history[2].task.worker,
                    WorkerIdentity::Recorded {
                        worker_id: original
                    }
                );
                assert_eq!(history[4].task.worker, WorkerIdentity::Unrecorded);
                assert_eq!(
                    history[5].task.worker,
                    WorkerIdentity::Recorded { worker_id: other }
                );
                let workflow = scenario
                    .workbench()?
                    .observe()
                    .await?
                    .workflow(first.common.feature)
                    .await?;
                let chapter = workflow
                    .chapters
                    .iter()
                    .find(|chapter| chapter.task.common.id == first.common.id)
                    .ok_or_else(|| anyhow::anyhow!("chapter missing"))?;
                for (entry, event) in chapter.entries.iter().zip(&history) {
                    assert_eq!(entry.worker, event.task.worker);
                }
                assert_eq!(chapter.entries.len(), history.len());
                assert_eq!(ledger.info().storage_version, StorageVersion::CommonTasksV4);
                Ok(())
            })
    }
}
