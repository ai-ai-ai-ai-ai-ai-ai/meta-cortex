mod mutations;
mod schema;
mod sql;

use super::LedgerError;
use super::git::Repository;
use super::model::Workspace;
use super::model::{Checkpoint, Event, EventKind, Feature, Task, TaskState, TaskView};
use super::request::{CreateTask, InitFeature};
use super::values::{Attempt, FeatureId, Revision, TaskId, Timestamp};
use super::versions::{RecordVersion, StorageVersion};
use schema::{EventTable, FeatureTable, LedgerSchema, TaskTable};
use sea_query::{Expr, ExprTrait, OnConflict, Order, Query};
use serde::Serialize;
use sql::SqlStatement;
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use turso::transaction::TransactionBehavior;
use turso::{Builder, Connection};

pub struct Ledger {
    connection: Connection,
    feature: Feature,
    path: PathBuf,
    repository: Repository,
}

pub(crate) struct OpenLedger {
    pub repository: Repository,
    pub feature: FeatureId,
}
pub(crate) struct InitializeLedger {
    pub repository: Repository,
    pub input: InitFeature,
}

#[derive(Serialize)]
pub struct LedgerInfo {
    pub path: PathBuf,
    pub storage_version: StorageVersion,
    pub feature: Feature,
}

struct Documents<'a> {
    connection: &'a Connection,
}

impl Ledger {
    async fn connect(path: &Path) -> Result<Connection, LedgerError> {
        let path = path
            .to_str()
            .ok_or(LedgerError::Invalid("ledger path must be UTF-8"))?;
        let database = Builder::new_local(path)
            .experimental_multiprocess_wal(true)
            .build()
            .await?;
        let mut connection = database.connect()?;
        connection.busy_timeout(Duration::from_secs(10))?;
        LedgerSchema::migrate(&mut connection).await?;
        Ok(connection)
    }

    pub(crate) async fn initialize(request: InitializeLedger) -> Result<Self, LedgerError> {
        let feature = Feature {
            version: RecordVersion::CURRENT,
            id: request.input.feature,
            objective: request.input.objective,
            branch: request.input.branch,
            worktree: request.input.worktree.canonicalize()?,
        };
        request.repository.require_feature(&feature)?;
        let path = request.repository.ledger_path(&feature.id);
        fs::create_dir_all(
            path.parent()
                .ok_or(LedgerError::Invalid("ledger path has no parent"))?,
        )?;
        let mut connection = Self::connect(&path).await?;
        let tx = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        SqlStatement::build(
            Query::insert()
                .into_table(FeatureTable::Table)
                .columns([FeatureTable::Singleton, FeatureTable::Document])
                .values([1.into(), serde_json::to_string(&feature)?.into()])?
                .on_conflict(
                    OnConflict::column(FeatureTable::Singleton)
                        .do_nothing()
                        .to_owned(),
                )
                .to_owned(),
        )?
        .execute(&tx)
        .await?;
        let stored = Documents { connection: &tx }.feature().await?;
        if stored != feature {
            return Err(LedgerError::AlreadyExists);
        }
        tx.commit().await?;
        Ok(Self {
            connection,
            feature,
            path,
            repository: request.repository,
        })
    }

    pub(crate) async fn open(request: OpenLedger) -> Result<Self, LedgerError> {
        let path = request.repository.ledger_path(&request.feature);
        if !path.is_file() {
            return Err(LedgerError::Uninitialized);
        }
        let connection = Self::connect(&path).await?;
        let feature = Documents {
            connection: &connection,
        }
        .feature()
        .await?;
        if feature.id != request.feature {
            return Err(LedgerError::Invalid(
                "feature document does not match ledger location",
            ));
        }
        Ok(Self {
            connection,
            feature,
            path,
            repository: request.repository,
        })
    }

    pub fn info(&self) -> LedgerInfo {
        LedgerInfo {
            path: self.path.clone(),
            feature: self.feature.clone(),
            storage_version: StorageVersion::CURRENT,
        }
    }

    pub async fn create(&mut self, input: CreateTask) -> Result<Task, LedgerError> {
        if input.feature != self.feature.id {
            return Err(LedgerError::Invalid("feature mismatch"));
        }
        self.repository.require_workspace(&input.workspace)?;
        if let Workspace::Git { branch, .. } = &input.workspace
            && branch == &self.feature.branch
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
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let documents = Documents { connection: &tx };
        let mut seen = BTreeSet::new();
        for dependency in &input.dependencies {
            if dependency == &input.task || !seen.insert(dependency) {
                return Err(LedgerError::Invalid("self or duplicate dependency"));
            }
            documents.task(dependency).await?;
        }
        let now = Timestamp::now()?;
        let task = Task {
            version: RecordVersion::CURRENT,
            id: input.task,
            feature: input.feature,
            objective: input.objective,
            acceptance: input.acceptance,
            dependencies: input.dependencies,
            workspace: input.workspace,
            revision: Revision::INITIAL,
            attempt: Attempt::UNCLAIMED,
            state: TaskState::Queued,
            created_at: now,
            last_update: now,
            last_progress: now,
            checkpoint: Checkpoint::Unrecorded,
            progress: input.progress,
        };
        let changed = SqlStatement::build(
            Query::insert()
                .into_table(TaskTable::Table)
                .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                .values([
                    task.id.to_string().into(),
                    i64::from(task.revision).into(),
                    serde_json::to_string(&task)?.into(),
                ])?
                .on_conflict(OnConflict::column(TaskTable::Id).do_nothing().to_owned())
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
                note: task.objective.clone(),
                task: task.clone(),
            })
            .await?;
        tx.commit().await?;
        Ok(task)
    }

    pub async fn task(&self, id: &TaskId) -> Result<TaskView, LedgerError> {
        Ok(Documents {
            connection: &self.connection,
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
                .order_by(TaskTable::Id, Order::Asc)
                .to_owned(),
        )?
        .query(&self.connection)
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
            connection: &self.connection,
        }
        .task(id)
        .await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(EventTable::Document)
                .from(EventTable::Table)
                .and_where(Expr::col(EventTable::TaskId).eq(id.to_string()))
                .order_by(EventTable::Revision, Order::Asc)
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut events = Vec::new();
        while let Some(row) = rows.next().await? {
            events.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(events)
    }
}

impl Documents<'_> {
    async fn feature(&self) -> Result<Feature, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Document)
                .from(FeatureTable::Table)
                .and_where(Expr::col(FeatureTable::Singleton).eq(1))
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
                .and_where(Expr::col(TaskTable::Id).eq(id.to_string()))
                .to_owned(),
        )?
        .query(self.connection)
        .await?;
        let row = rows.next().await?.ok_or(LedgerError::NotFound)?;
        Ok(serde_json::from_str(&row.get::<String>(0)?)?)
    }

    async fn event(&self, event: &Event) -> Result<(), LedgerError> {
        SqlStatement::build(
            Query::insert()
                .into_table(EventTable::Table)
                .columns([
                    EventTable::TaskId,
                    EventTable::Revision,
                    EventTable::Document,
                ])
                .values([
                    event.task.id.to_string().into(),
                    i64::from(event.task.revision).into(),
                    serde_json::to_string(event)?.into(),
                ])?
                .to_owned(),
        )?
        .execute(self.connection)
        .await?;
        Ok(())
    }

    async fn save(&self, mut event: Event) -> Result<Task, LedgerError> {
        let previous = event.task.revision;
        event.task.revision = previous.advance()?;
        let changed = SqlStatement::build(
            Query::update()
                .table(TaskTable::Table)
                .value(TaskTable::Revision, i64::from(event.task.revision))
                .value(TaskTable::Document, serde_json::to_string(&event.task)?)
                .and_where(Expr::col(TaskTable::Id).eq(event.task.id.to_string()))
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
