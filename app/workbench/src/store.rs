use crate::model::worker::WorkerIdentity;
pub(crate) mod catalog;
mod legacy;
mod lifecycle;
mod mutations;
pub(crate) mod observation;
mod record_fields;
mod relational;
mod schema;
mod sequence;
mod sql;

use super::LedgerError;
use super::git::Repository;
use super::git::TaskWorkspaceCheck;
use super::model::Workspace;
use super::model::workflow::TaskOwnership;
use super::model::{Checkpoint, Event, EventKind, Feature, Task, TaskCommon, TaskState, TaskView};
use super::request::{CreateTask, InitFeature};
use super::values::{Attempt, FeatureId, TaskId, TaskRevision, Timestamp};
use super::versions::{RecordVersion, StorageVersion, TaskRecordVersion};
use relational::{EventTable, FeatureTable, RecordWriter, TaskTable};
use sea_query::{Expr, ExprTrait, OnConflict, Order, Query};
use serde::Serialize;
use sql::SqlStatement;
use std::collections::BTreeSet;
use std::path::PathBuf;
use turso::transaction::TransactionBehavior;
use turso::{Connection, IoBackend};

// Windows multiprocess WAL requires Turso's IOCP backend.
#[cfg(windows)]
const PERSISTENT_IO: IoBackend = IoBackend::IOCP;
#[cfg(not(windows))]
const PERSISTENT_IO: IoBackend = IoBackend::Default;

/// A feature ledger whose task operations require a loaded feature.
///
/// Preparation consumes each internal stage: located, connected, schema ready,
/// then feature loaded. Workbench returns only the fully prepared default state.
/// A loaded ledger cannot reconnect or rerun preparation:
///
/// ```compile_fail
/// use meta_cortex_workbench::Ledger;
/// async fn reconnect(ledger: Ledger) {
///     ledger.connect().await;
/// }
/// ```
///
/// ```compile_fail
/// use meta_cortex_workbench::Ledger;
/// async fn remigrate(ledger: Ledger) {
///     ledger.migrate().await;
/// }
/// ```
pub struct Ledger<State = FeatureLoaded> {
    state: State,
    path: PathBuf,
    repository: Repository,
}

/// Successfully migrated storage with its feature record loaded and validated.
/// Constructed only by the ledger preparation transitions.
pub struct FeatureLoaded {
    connection: Connection,
    feature: Feature,
}

pub(crate) struct OpenLedger {
    pub repository: Repository,
    pub feature: FeatureId,
}
pub(crate) struct InitializeLedger {
    pub repository: Repository,
    pub input: InitFeature,
}

#[derive(Debug, Serialize, schemars::JsonSchema)]
pub struct LedgerInfo {
    pub path: PathBuf,
    pub storage_version: StorageVersion,
    pub feature: Feature,
}

struct Documents<'a> {
    feature: &'a FeatureId,
    connection: &'a Connection,
}

impl Ledger {
    pub fn info(&self) -> LedgerInfo {
        LedgerInfo {
            path: self.path.clone(),
            feature: self.state.feature.clone(),
            storage_version: StorageVersion::CURRENT,
        }
    }

    pub async fn create(&mut self, input: CreateTask) -> Result<Task, LedgerError> {
        if input.feature != self.state.feature.id {
            return Err(LedgerError::Invalid("feature mismatch"));
        }
        self.repository.require_task_workspace(TaskWorkspaceCheck {
            workspace: &input.workspace,
            feature: &self.state.feature,
        })?;
        if let Workspace::Git { branch, .. } = &input.workspace
            && branch == &self.state.feature.branch
        {
            return Err(LedgerError::Invalid(
                "write tasks require a branch distinct from the feature branch",
            ));
        }
        if input.acceptance.is_empty() {
            return Err(LedgerError::Invalid(
                "at least one completion criterion is required",
            ));
        }
        let tx = self
            .state
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        schema::LedgerSchema::require_current(&tx)
            .await
            .map_err(|error| error.in_feature(&self.state.feature.id))?;
        let documents = Documents {
            connection: &tx,
            feature: &self.state.feature.id,
        };
        let mut seen = BTreeSet::new();
        for dependency in &input.dependencies {
            if dependency == &input.task || !seen.insert(dependency) {
                return Err(LedgerError::Invalid("self or duplicate dependency"));
            }
            documents.task(dependency).await?;
        }
        let now = Timestamp::now()?;
        let task = Task {
            worker: WorkerIdentity::Unrecorded,
            version: TaskRecordVersion::CURRENT,
            common: TaskCommon {
                id: input.task,
                feature: input.feature,
                objective: input.objective,
                acceptance: input.acceptance,
                dependencies: input.dependencies,
                revision: TaskRevision::INITIAL,
                attempt: Attempt::UNCLAIMED,
                created_at: now,
                last_update: now,
                last_progress: now,
                checkpoint: Checkpoint::Unrecorded,
                progress: input.progress,
            },
            ownership: TaskOwnership::Unrecorded,
            workspace: input.workspace,
            state: TaskState::Queued,
        };
        let changed = SqlStatement::build(
            Query::insert()
                .into_table(TaskTable::Table)
                .columns([
                    TaskTable::FeatureId,
                    TaskTable::Id,
                    TaskTable::Revision,
                    TaskTable::Document,
                ])
                .values([
                    task.common.feature.to_string().into(),
                    task.common.id.to_string().into(),
                    i64::from(task.common.revision).into(),
                    serde_json::to_string(&task)?.into(),
                ])?
                .on_conflict(
                    OnConflict::columns([TaskTable::FeatureId, TaskTable::Id])
                        .do_nothing()
                        .to_owned(),
                )
                .to_owned(),
        )?
        .execute(&tx)
        .await?;
        if changed != 1 {
            return Err(LedgerError::AlreadyExists);
        }
        documents
            .event(&Event {
                version: RecordVersion::CURRENT,
                kind: EventKind::Created,
                actor: input.actor,
                note: task.common.objective.clone(),
                task: task.clone(),
            })
            .await?;
        tx.commit().await?;
        Ok(task)
    }

    pub async fn task(&self, id: &TaskId) -> Result<TaskView, LedgerError> {
        Ok(Documents {
            connection: &self.state.connection,
            feature: &self.state.feature.id,
        }
        .task(id)
        .await?
        .view(Timestamp::now()?))
    }

    pub async fn status(&self) -> Result<Vec<TaskView>, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Document)
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(self.state.feature.id.to_string()))
                .order_by(TaskTable::Id, Order::Asc)
                .to_owned(),
        )?
        .query(&self.state.connection)
        .await?;
        let now = Timestamp::now()?;
        let mut tasks = Vec::new();
        while let Some(row) = rows.next().await? {
            let task: Task = serde_json::from_str(&row.get::<String>(0)?)?;
            tasks.push(task.view(now));
        }
        Ok(tasks)
    }

    pub async fn history(&self, id: &TaskId) -> Result<Vec<Event>, LedgerError> {
        Documents {
            connection: &self.state.connection,
            feature: &self.state.feature.id,
        }
        .task(id)
        .await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(EventTable::Document)
                .from(EventTable::Table)
                .and_where(Expr::col(EventTable::FeatureId).eq(self.state.feature.id.to_string()))
                .and_where(Expr::col(EventTable::TaskId).eq(id.to_string()))
                .order_by(EventTable::Revision, Order::Asc)
                .to_owned(),
        )?
        .query(&self.state.connection)
        .await?;
        let mut events = Vec::new();
        while let Some(row) = rows.next().await? {
            events.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(events)
    }
}

impl Documents<'_> {
    async fn require_feature_scope(&self) -> Result<(), LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Id)
                .from(FeatureTable::Table)
                .and_where(Expr::col(FeatureTable::Id).ne(self.feature.to_string()))
                .limit(1)
                .to_owned(),
        )?
        .query(self.connection)
        .await?;
        match rows.next().await? {
            Some(_) => Err(LedgerError::Invalid(
                "feature database contains an unrelated feature",
            )),
            None => Ok(()),
        }
    }

    async fn feature(&self) -> Result<Feature, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Document)
                .from(FeatureTable::Table)
                .and_where(Expr::col(FeatureTable::Id).eq(self.feature.to_string()))
                .to_owned(),
        )?
        .query(self.connection)
        .await?;
        let row = rows.next().await?.ok_or(LedgerError::Uninitialized)?;
        Ok(serde_json::from_str(&row.get::<String>(0)?)?)
    }

    async fn task(&self, id: &TaskId) -> Result<Task, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Document)
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(self.feature.to_string()))
                .and_where(Expr::col(TaskTable::Id).eq(id.to_string()))
                .to_owned(),
        )?
        .query(self.connection)
        .await?;
        let row = rows.next().await?.ok_or(LedgerError::NotFound)?;
        Ok(serde_json::from_str(&row.get::<String>(0)?)?)
    }

    async fn event(&self, event: &Event) -> Result<(), LedgerError> {
        RecordWriter {
            connection: self.connection,
        }
        .event(event)
        .await
    }

    async fn save(&self, mut event: Event) -> Result<Task, LedgerError> {
        let previous = event.task.common.revision;
        event.task.common.revision = previous.advance()?;
        let changed = SqlStatement::build(
            Query::update()
                .table(TaskTable::Table)
                .value(TaskTable::Revision, i64::from(event.task.common.revision))
                .value(TaskTable::Document, serde_json::to_string(&event.task)?)
                .and_where(Expr::col(TaskTable::FeatureId).eq(self.feature.to_string()))
                .and_where(Expr::col(TaskTable::Id).eq(event.task.common.id.to_string()))
                .and_where(Expr::col(TaskTable::Revision).eq(i64::from(previous)))
                .to_owned(),
        )?
        .execute(self.connection)
        .await?;
        if changed != 1 {
            return Err(LedgerError::Conflict);
        }
        self.event(&event).await?;
        Ok(event.task)
    }
}
