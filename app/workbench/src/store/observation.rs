use super::relational::{EventTable, FeatureTable, TaskTable};
use super::schema::LedgerSchema;
use super::sql::SqlStatement;
use crate::LedgerError;
use crate::model::{Event, Feature, Task};
use crate::request::TaskQuery;
use crate::values::{FeatureId, TaskId};
use crate::versions::StorageVersion;
use derive_more::Display;
use schemars::JsonSchema;
use sea_query::{Expr, ExprTrait, Iden, Order, Query};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::time::Duration;
use turso::{Builder, Connection};

/// A page of at most 100 records. Each operation releases its connection before returning.
#[derive(Debug, Serialize)]
pub struct Page<T> {
    pub records: Vec<T>,
    pub end: PageEnd,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
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
        u64::from(value) * RecordCount::PAGE.sql_count()
    }
}
#[derive(derive_more::From)]
struct RecordCount(usize);
impl RecordCount {
    const PAGE: Self = Self(100);
    fn sql_count(self) -> u64 {
        let Self(count) = self;
        count as u64
    }
    fn page_end(self) -> PageEnd {
        let Self(count) = self;
        let Self(limit) = Self::PAGE;
        match count > limit {
            true => PageEnd::More,
            false => PageEnd::Complete,
        }
    }
}
impl<T> Page<T> {
    fn from_records(mut records: Vec<T>) -> Self {
        let end = RecordCount::from(records.len()).page_end();
        match end {
            PageEnd::More => {
                records.pop();
            }
            PageEnd::Complete => {}
        }
        Self { records, end }
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
impl Observation {
    pub(crate) async fn open(path: PathBuf) -> Result<Self, LedgerError> {
        let observation = Self { path };
        observation.connect().await?;
        Ok(observation)
    }
    async fn connect(&self) -> Result<Connection, LedgerError> {
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
        .experimental_multiprocess_wal(true)
        .build()
        .await?;
        let connection = database.connect()?;
        connection.busy_timeout(Duration::from_millis(250))?;
        connection
            .pragma_update(&ConnectionPragma::ForeignKeys.to_string(), 1)
            .await?;
        match LedgerSchema::version(&connection).await? {
            StorageVersion::CommonTasksV4 => Ok(connection),
            version @ (StorageVersion::Empty
            | StorageVersion::DocumentsV1
            | StorageVersion::IndexedV2
            | StorageVersion::RelationalV3) => {
                Err(LedgerError::ObservationMigrationRequired(version))
            }
        }
    }
    pub async fn features(&self, page: PageIndex) -> Result<Page<Feature>, LedgerError> {
        let connection = self.connect().await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(FeatureTable::Document)
                .from(FeatureTable::Table)
                .order_by(FeatureTable::Id, Order::Asc)
                .offset(page.offset())
                .limit(RecordCount::PAGE.sql_count() + 1)
                .to_owned(),
        )?
        .query(&connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(Page::from_records(records))
    }
    pub async fn tasks(&self, request: TaskPage) -> Result<Page<Task>, LedgerError> {
        let connection = self.connect().await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Document)
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(request.feature.to_string()))
                .order_by(TaskTable::Id, Order::Asc)
                .offset(request.page.offset())
                .limit(RecordCount::PAGE.sql_count() + 1)
                .to_owned(),
        )?
        .query(&connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(Page::from_records(records))
    }
    pub async fn task(&self, request: TaskQuery) -> Result<Task, LedgerError> {
        let connection = self.connect().await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Document)
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(request.feature.to_string()))
                .and_where(Expr::col(TaskTable::Id).eq(request.task.to_string()))
                .limit(1)
                .to_owned(),
        )?
        .query(&connection)
        .await?;
        let row = rows.next().await?.ok_or(LedgerError::NotFound)?;
        Ok(serde_json::from_str(&row.get::<String>(0)?)?)
    }
    pub async fn history(&self, request: HistoryPage) -> Result<Page<Event>, LedgerError> {
        let connection = self.connect().await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .column(EventTable::Document)
                .from(EventTable::Table)
                .and_where(Expr::col(EventTable::FeatureId).eq(request.feature.to_string()))
                .and_where(Expr::col(EventTable::TaskId).eq(request.task.to_string()))
                .order_by(EventTable::Revision, Order::Desc)
                .offset(request.page.offset())
                .limit(RecordCount::PAGE.sql_count() + 1)
                .to_owned(),
        )?
        .query(&connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(Page::from_records(records))
    }
}

#[cfg(test)]
pub mod tests {
    use super::{Observation, Page, PageEnd, PageIndex, RecordCount};
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
            RecordCount::PAGE.sql_count()
        );
        let page = Page::from_records(vec![PageIndex::FIRST; 101]);
        assert_eq!(page.records.len(), 100);
        assert_eq!(page.end, PageEnd::More);
        assert_eq!(
            Page::from_records(Vec::<PageIndex>::new()).end,
            PageEnd::Complete
        );
    }
    #[test]
    fn observation_rejects_missing_nonfile_old_and_unknown_storage_without_changing_it()
    -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        Builder::new_current_thread().enable_time().build()?.block_on(async {
            assert!(matches!(Observation::open(directory.path().join("missing")).await, Err(LedgerError::Uninitialized)));
            assert!(matches!(Observation::open(directory.path().to_owned()).await, Err(LedgerError::Invalid(_))));
            for version in [StorageVersion::Empty, StorageVersion::DocumentsV1, StorageVersion::IndexedV2, StorageVersion::RelationalV3] {
                let path = directory.path().join(format!("version-{version}.db"));
                let database = DatabaseBuilder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?).build().await?;
                let connection = database.connect()?;
                connection.pragma_update(&Pragma::UserVersion.to_string(), i64::from(version)).await?;
                drop(connection); drop(database);
                let bytes = fs::read(&path)?;
                assert!(matches!(Observation::open(path.clone()).await, Err(LedgerError::ObservationMigrationRequired(found)) if found == version));
                assert_eq!(bytes, fs::read(path)?);
            }
            let path = directory.path().join("future.db");
            let database = DatabaseBuilder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?).build().await?;
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
