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
    pub(crate) async fn prepare(path: PathBuf) -> Result<Self, LedgerError> {
        let observation = Self { path };
        match fs::metadata(&observation.path) {
            Ok(metadata) if metadata.is_file() && metadata.len() == 0 => {
                return Err(LedgerError::Uninitialized);
            }
            Ok(metadata) if metadata.is_file() => {}
            Ok(_) => return Err(LedgerError::Invalid("ledger path must be a regular file")),
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Err(LedgerError::Uninitialized);
            }
            Err(error) => return Err(error.into()),
        }
        let database = Builder::new_local(
            observation
                .path
                .to_str()
                .ok_or(LedgerError::Invalid("database path is not UTF-8"))?,
        )
        .with_io(PERSISTENT_IO)
        .experimental_multiprocess_wal(true)
        .build()
        .await?;
        let mut connection = database.connect()?;
        connection.busy_timeout(Duration::from_secs(10))?;
        // Turso shares the backing database by file identity, including its open mode.
        // Keep preparation on writable-capable handles throughout; overlapping read-only
        // preflights can otherwise lend their backing handle to another preparer's writer.
        match LedgerSchema::version(&connection).await? {
            StorageVersion::SequencedEventsV5 => {}
            StorageVersion::Empty => return Err(LedgerError::Uninitialized),
            StorageVersion::DocumentsV1
            | StorageVersion::IndexedV2
            | StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4 => {
                LedgerSchema::prepare_observation(&mut connection).await?;
            }
        }
        drop(connection);
        drop(database);
        Ok(observation)
    }

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
    use crate::store::relational::tests::Records;
    use crate::store::relational::{RecordWriter, RelationalSchema};
    use crate::versions::StorageVersion;
    use crate::{DataDirectory, LedgerError, Workbench};
    use sea_query::Iden;
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use tokio::runtime::Builder;
    use turso::Builder as DatabaseBuilder;
    use turso::Connection;

    #[derive(Iden)]
    enum Pragma {
        UserVersion,
    }
    struct PreparationFixture {
        directory: tempfile::TempDir,
        workbench: Workbench,
        path: PathBuf,
    }
    impl PreparationFixture {
        async fn new() -> anyhow::Result<Self> {
            let directory = tempfile::tempdir()?;
            let project = directory.path().join("project");
            git2::Repository::init(&project)?;
            let workbench = Workbench::discover(&project)?
                .with_data_directory(DataDirectory::from(directory.path().join("data")));
            workbench.initialize_repository()?;
            let path = workbench.repository.ledger_path()?;
            let fixture = Self {
                directory,
                workbench,
                path,
            };
            let connection = fixture.connect().await?;
            RelationalSchema::create(&connection).await?;
            connection
                .pragma_update(
                    &Pragma::UserVersion.to_string(),
                    i64::from(StorageVersion::CommonTasksV4),
                )
                .await?;
            let records = Records::new()?;
            let writer = RecordWriter {
                connection: &connection,
            };
            writer.feature(&records.feature).await?;
            writer.task(&records.task).await?;
            writer.event(&records.event).await?;
            Ok(fixture)
        }
        async fn connect(&self) -> anyhow::Result<Connection> {
            Ok(DatabaseBuilder::new_local(
                self.path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?,
            )
            .with_io(PERSISTENT_IO)
            .experimental_multiprocess_wal(true)
            .build()
            .await?
            .connect()?)
        }
    }
    #[test]
    fn preparation_migrates_existing_storage_and_keeps_observation_read_only() -> anyhow::Result<()>
    {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let fixture = PreparationFixture::new().await?;
                assert!(matches!(
                    fixture.workbench.observe().await,
                    Err(LedgerError::ObservationMigrationRequired(
                        StorageVersion::CommonTasksV4
                    ))
                ));
                let identity = fs::read_to_string(
                    fixture
                        .directory
                        .path()
                        .join("project/.meta-cortex/repository-id"),
                )?;
                let legacy = fixture
                    .directory
                    .path()
                    .join("data")
                    .join(identity.trim())
                    .join("features/untouched.db");
                fs::create_dir_all(
                    legacy
                        .parent()
                        .ok_or_else(|| anyhow::anyhow!("legacy parent"))?,
                )?;
                fs::write(&legacy, b"separate legacy storage must not be opened")?;
                let observation = fixture.workbench.prepare_observation().await?;
                assert_eq!(
                    fs::read(legacy)?,
                    b"separate legacy storage must not be opened"
                );
                assert_eq!(
                    observation.features(PageIndex::FIRST).await?.records.len(),
                    1
                );
                let before = fs::read(&fixture.path)?;
                let wal_before = fs::read(fixture.path.with_extension("db-wal"))?;
                fixture.workbench.prepare_observation().await?;
                fixture.workbench.observe().await?;
                assert_eq!(fs::read(&fixture.path)?, before);
                assert_eq!(fs::read(fixture.path.with_extension("db-wal"))?, wal_before);
                Ok(())
            })
    }
    #[test]
    fn concurrent_preparation_serializes_the_schema_decision() -> anyhow::Result<()> {
        use std::sync::{Arc, Barrier};
        use std::thread;
        let runtime = Builder::new_current_thread().enable_time().build()?;
        let fixture = runtime.block_on(PreparationFixture::new())?;
        let barrier = Arc::new(Barrier::new(2));
        let handles = (0..2)
            .map(|_| {
                let project = fixture.directory.path().join("project");
                let data = DataDirectory::from(fixture.directory.path().join("data"));
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || -> anyhow::Result<()> {
                    let workbench = Workbench::discover(&project)?.with_data_directory(data);
                    let runtime = Builder::new_current_thread().enable_time().build()?;
                    barrier.wait();
                    runtime.block_on(workbench.prepare_observation())?;
                    Ok(())
                })
            })
            .collect::<Vec<_>>();
        for handle in handles {
            handle
                .join()
                .map_err(|_| anyhow::anyhow!("preparation thread panicked"))??;
        }
        runtime.block_on(async {
            assert_eq!(
                fixture
                    .workbench
                    .observe()
                    .await?
                    .features(PageIndex::FIRST)
                    .await?
                    .records
                    .len(),
                1
            );
            anyhow::Ok(())
        })
    }
    #[test]
    fn preparation_rejects_missing_empty_and_unknown_without_initializing() -> anyhow::Result<()> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let directory = tempfile::tempdir()?;
                git2::Repository::init(directory.path())?;
                let workbench = Workbench::discover(directory.path())?
                    .with_data_directory(DataDirectory::from(directory.path().join("data")));
                assert!(matches!(
                    workbench.prepare_observation().await,
                    Err(LedgerError::Uninitialized)
                ));
                assert!(!directory.path().join(".meta-cortex").exists());
                assert!(!directory.path().join("data").exists());
                workbench.initialize_repository()?;
                assert!(matches!(
                    workbench.prepare_observation().await,
                    Err(LedgerError::Uninitialized)
                ));
                let path = workbench.repository.ledger_path()?;
                assert!(!path.exists());
                fs::write(&path, [])?;
                assert!(matches!(
                    workbench.prepare_observation().await,
                    Err(LedgerError::Uninitialized)
                ));
                assert!(fs::read(&path)?.is_empty());
                let database = DatabaseBuilder::new_local(
                    path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?,
                )
                .with_io(PERSISTENT_IO)
                .experimental_multiprocess_wal(true)
                .build()
                .await?;
                let mut connection = database.connect()?;
                assert!(matches!(
                    super::LedgerSchema::prepare_observation(&mut connection).await,
                    Err(LedgerError::Uninitialized)
                ));
                assert!(matches!(
                    workbench.prepare_observation().await,
                    Err(LedgerError::Uninitialized)
                ));
                assert_eq!(
                    super::LedgerSchema::version(&connection).await?,
                    StorageVersion::Empty
                );
                RelationalSchema::create(&connection).await?;
                connection
                    .pragma_update(&Pragma::UserVersion.to_string(), 999)
                    .await?;
                drop(connection);
                drop(database);
                let error = workbench
                    .prepare_observation()
                    .await
                    .err()
                    .ok_or_else(|| anyhow::anyhow!("unknown schema accepted"))?;
                assert!(
                    matches!(error, LedgerError::UnsupportedVersion(_)),
                    "{error:?}"
                );
                Ok(())
            })
    }
    #[test]
    #[ignore = "exports synthetic V4 storage for native startup acceptance; requires META_CORTEX_V4_FIXTURE"]
    fn export_native_preparation_fixture() -> anyhow::Result<()> {
        let destination = env::var_os("META_CORTEX_V4_FIXTURE")
            .ok_or_else(|| anyhow::anyhow!("fixture destination required"))?;
        let fixture = Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(PreparationFixture::new())?;
        fs::rename(fixture.directory.keep(), destination)?;
        Ok(())
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
