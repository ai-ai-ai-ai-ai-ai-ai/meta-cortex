mod state_meaning;
pub use state_meaning::StateMeaning;
mod timeline;
pub use timeline::{
    RecordedTimeline, RecordedWindow, TimelineExtent, TimelineGroup, TimelineGroupIdentity,
    TimelineOrder,
};
mod detail;
mod revision_log;
pub use revision_log::{RevisionLogEntry, SequenceProvenance};
mod workflow;
use super::PERSISTENT_IO;
use super::relational::{EventTable, FeatureTable, TaskTable};
use super::schema::LedgerSchema;
use super::sql::SqlStatement;
use crate::LedgerError;
use crate::model::{Event, Feature, Task};
use crate::request::TaskQuery;
use crate::values::{FeatureId, TaskId};
use crate::versions::StorageVersion;
use derive_more::Display;
pub use detail::{FeatureWorkflow, FeedEntry, RecordedRole, TaskChapter, WorkflowTiming};
use schemars::JsonSchema;
use sea_query::{Expr, ExprTrait, Iden, Order, Query};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::time::Duration;
use turso::{Builder, Connection};
pub use workflow::{
    ActiveWork, Blocker, Completion, FeatureActivity, FeatureOutcome, FeatureSummary, FlowCount,
    FlowState, LatestDelivery, PullRequest, TaskCount, WorkflowCondition, WorkflowTotals,
};

/// A page of bounded records. Each operation releases its connection before returning.
#[derive(Debug, Serialize, JsonSchema)]
pub struct Page<T> {
    pub records: Vec<T>,
    pub end: PageEnd,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub enum PageEnd {
    Complete,
    More,
}
#[derive(
    Clone, Copy, Debug, Default, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(transparent)]
pub struct PageIndex(u32);
impl PageIndex {
    pub const FIRST: Self = Self(0);
    #[must_use]
    pub fn next(self) -> Self {
        let Self(value) = self;
        Self(value.saturating_add(1))
    }
    #[must_use]
    pub fn previous(self) -> Self {
        let Self(value) = self;
        Self(value.saturating_sub(1))
    }
    fn offset(self) -> u64 {
        let Self(value) = self;
        u64::from(value) * RecordLimit::PAGE.sql_count()
    }
}
/// The most records one read returns; one extra probe row detects a further page.
#[derive(Clone, Copy)]
struct RecordLimit(usize);
impl RecordLimit {
    const PAGE: Self = Self(100);
    const FEATURE_TASKS: Self = Self(2000);
    fn sql_count(self) -> u64 {
        let Self(count) = self;
        count as u64
    }
    fn probe(self) -> u64 {
        self.sql_count() + 1
    }
    fn bound<T>(self, mut records: Vec<T>) -> Page<T> {
        let Self(limit) = self;
        let end = match records.len() > limit {
            true => PageEnd::More,
            false => PageEnd::Complete,
        };
        records.truncate(limit);
        Page { records, end }
    }
}
pub struct TaskPage {
    pub feature: FeatureId,
    pub page: PageIndex,
}
pub struct HistoryPage {
    pub feature: FeatureId,
    pub task: TaskId,
    pub page: PageIndex,
}

#[derive(Iden)]
enum ConnectionPragma {
    ForeignKeys,
}

/// Read-only capability: never initializes identity/storage, imports, migrates or coordinates.
/// Only existing repository identity/path discovery uses Git; content comes exclusively from Turso.
pub struct Observation {
    path: PathBuf,
}
/// One open read-only connection shared by every query of a single observation.
struct LedgerReader {
    connection: Connection,
}
impl Observation {
    pub(crate) async fn open(path: PathBuf) -> Result<Self, LedgerError> {
        let observation = Self { path };
        observation.reader().await?;
        Ok(observation)
    }
    async fn reader(&self) -> Result<LedgerReader, LedgerError> {
        match fs::metadata(&self.path) {
            Ok(metadata) if metadata.is_file() => {}
            Ok(_) => return Err(LedgerError::Invalid("ledger path must be a regular file")),
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Err(LedgerError::Uninitialized);
            }
            Err(error) => return Err(error.into()),
        }
        let database = Builder::new_local(
            self.path
                .to_str()
                .ok_or(LedgerError::Invalid("database path is not UTF-8"))?,
        )
        .read_only(true)
        .with_io(PERSISTENT_IO)
        .experimental_multiprocess_wal(true)
        .build()
        .await?;
        let connection = database.connect()?;
        connection.busy_timeout(Duration::from_millis(250))?;
        connection
            .pragma_update(&ConnectionPragma::ForeignKeys.to_string(), 1)
            .await?;
        match LedgerSchema::version(&connection).await? {
            StorageVersion::SequencedEventsV5 => Ok(LedgerReader { connection }),
            version @ (StorageVersion::Empty
            | StorageVersion::DocumentsV1
            | StorageVersion::IndexedV2
            | StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4) => {
                Err(LedgerError::ObservationMigrationRequired(version))
            }
        }
    }
    pub async fn features(&self, page: PageIndex) -> Result<Page<Feature>, LedgerError> {
        self.reader().await?.features(page).await
    }
    pub async fn tasks(&self, request: TaskPage) -> Result<Page<Task>, LedgerError> {
        self.reader().await?.tasks(request).await
    }
    pub async fn task(&self, request: TaskQuery) -> Result<Task, LedgerError> {
        self.reader().await?.task(request).await
    }
    pub async fn history(&self, request: HistoryPage) -> Result<Page<Event>, LedgerError> {
        self.reader().await?.history(request).await
    }
}
impl LedgerReader {
    async fn features(&self, page: PageIndex) -> Result<Page<Feature>, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Document)
                .from(FeatureTable::Table)
                .order_by(FeatureTable::Id, Order::Asc)
                .offset(page.offset())
                .limit(RecordLimit::PAGE.probe())
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(RecordLimit::PAGE.bound(records))
    }
    async fn tasks(&self, request: TaskPage) -> Result<Page<Task>, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Document)
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(request.feature.to_string()))
                .order_by(TaskTable::Id, Order::Asc)
                .offset(request.page.offset())
                .limit(RecordLimit::PAGE.probe())
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(RecordLimit::PAGE.bound(records))
    }
    async fn task(&self, request: TaskQuery) -> Result<Task, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Document)
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(request.feature.to_string()))
                .and_where(Expr::col(TaskTable::Id).eq(request.task.to_string()))
                .limit(1)
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let row = rows.next().await?.ok_or(LedgerError::NotFound)?;
        Ok(serde_json::from_str(&row.get::<String>(0)?)?)
    }
    async fn history(&self, request: HistoryPage) -> Result<Page<Event>, LedgerError> {
        let mut rows = SqlStatement::build(
            Query::select()
                .column(EventTable::Document)
                .from(EventTable::Table)
                .and_where(Expr::col(EventTable::FeatureId).eq(request.feature.to_string()))
                .and_where(Expr::col(EventTable::TaskId).eq(request.task.to_string()))
                .order_by(EventTable::Revision, Order::Desc)
                .offset(request.page.offset())
                .limit(RecordLimit::PAGE.probe())
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(RecordLimit::PAGE.bound(records))
    }
}

#[cfg(test)]
mod tests {
    use super::PERSISTENT_IO;
    use super::{Observation, PageEnd, PageIndex, RecordLimit};
    use crate::LedgerError;
    use crate::versions::StorageVersion;
    use sea_query::Iden;
    use std::fs;
    use tokio::runtime::Builder;
    use turso::Builder as DatabaseBuilder;

    #[derive(Iden)]
    enum Pragma {
        UserVersion,
    }
    #[test]
    fn bounded_pages_and_index_arithmetic() {
        assert_eq!(PageIndex::FIRST.previous(), PageIndex::FIRST);
        assert_eq!(PageIndex::FIRST.next().previous(), PageIndex::FIRST);
        assert_eq!(
            PageIndex::FIRST.next().offset(),
            RecordLimit::PAGE.sql_count()
        );
        assert_eq!(RecordLimit::PAGE.probe(), 101);
        let page = RecordLimit::PAGE.bound(vec![PageIndex::FIRST; 101]);
        assert_eq!(page.records.len(), 100);
        assert_eq!(page.end, PageEnd::More);
        let exact = RecordLimit::PAGE.bound(vec![PageIndex::FIRST; 100]);
        assert_eq!(exact.records.len(), 100);
        assert_eq!(exact.end, PageEnd::Complete);
        assert_eq!(
            RecordLimit::PAGE.bound(Vec::<PageIndex>::new()).end,
            PageEnd::Complete
        );
        let tasks = RecordLimit::FEATURE_TASKS.bound(vec![PageIndex::FIRST; 2001]);
        assert_eq!(tasks.records.len(), 2000);
        assert_eq!(tasks.end, PageEnd::More);
    }
    #[test]
    fn observation_rejects_missing_nonfile_old_and_unknown_storage_without_changing_it()
    -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        Builder::new_current_thread().enable_time().build()?.block_on(async {
            assert!(matches!(Observation::open(directory.path().join("missing")).await, Err(LedgerError::Uninitialized)));
            assert!(matches!(Observation::open(directory.path().to_owned()).await, Err(LedgerError::Invalid(_))));
            for version in [StorageVersion::Empty, StorageVersion::DocumentsV1, StorageVersion::IndexedV2, StorageVersion::RelationalV3, StorageVersion::CommonTasksV4] {
                let path = directory.path().join(format!("version-{version}.db"));
                let database = DatabaseBuilder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?).with_io(PERSISTENT_IO).build().await?;
                let connection = database.connect()?;
                connection.pragma_update(&Pragma::UserVersion.to_string(), i64::from(version)).await?;
                drop(connection); drop(database);
                let bytes = fs::read(&path)?;
                assert!(matches!(Observation::open(path.clone()).await, Err(LedgerError::ObservationMigrationRequired(found)) if found == version));
                assert_eq!(bytes, fs::read(path)?);
            }
            let path = directory.path().join("future.db");
            let database = DatabaseBuilder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?).with_io(PERSISTENT_IO).build().await?;
            let connection = database.connect()?;
            connection.pragma_update(&Pragma::UserVersion.to_string(), 99).await?;
            drop(connection); drop(database);
            let bytes = fs::read(&path)?;
            assert!(matches!(Observation::open(path.clone()).await, Err(LedgerError::UnsupportedVersion(_))));
            assert_eq!(bytes, fs::read(path)?);
            Ok::<_, anyhow::Error>(())
        })
    }
}
