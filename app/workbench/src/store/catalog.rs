//! Observational discovery of the repository’s feature files. No source is mutated.
use super::LedgerInfo;
use super::PERSISTENT_IO;
use super::legacy::LegacyFeature;
use super::relational::FeatureTable;
use super::schema::LedgerSchema;
use super::sql::SqlStatement;
use crate::LedgerError;
use crate::git::Repository;
use crate::model::Feature;
use crate::values::{FeatureId, Note};
use crate::versions::StorageVersion;
use schemars::JsonSchema;
use sea_query::Query;
use serde::Serialize;
use std::collections::{BTreeMap, btree_map::Entry};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::Duration;
use turso::{Builder, Connection};

/// Metadata-only discovery: unsupported sources never require record decoding.
#[derive(Debug, Serialize, JsonSchema)]
pub struct FeatureCatalog {
    pub features: Vec<CatalogFeature>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CatalogFeature {
    Current { ledger: LedgerInfo },
    UpgradeRequired { ledger: LedgerInfo },
    Unavailable { feature: FeatureId, message: Note },
}
impl CatalogFeature {
    pub fn id(&self) -> &FeatureId {
        match self {
            Self::Current { ledger } | Self::UpgradeRequired { ledger } => &ledger.feature.id,
            Self::Unavailable { feature, .. } => feature,
        }
    }
    fn from_ledger(ledger: LedgerInfo) -> Self {
        match ledger.storage_version {
            StorageVersion::FeatureHistoryV6 => Self::Current { ledger },
            StorageVersion::Empty
            | StorageVersion::DocumentsV1
            | StorageVersion::IndexedV2
            | StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4
            | StorageVersion::SequencedEventsV5 => Self::UpgradeRequired { ledger },
        }
    }
}

pub(super) enum FilePresence {
    Missing,
    Present,
}
impl From<bool> for FilePresence {
    fn from(present: bool) -> Self {
        match present {
            true => Self::Present,
            false => Self::Missing,
        }
    }
}

pub(super) struct FeatureFile {
    pub feature: FeatureId,
    pub path: PathBuf,
}
impl FeatureFile {
    pub(super) fn from_path(path: PathBuf) -> Result<Self, LedgerError> {
        let feature = FeatureId::try_from(
            path.file_stem()
                .and_then(|stem| stem.to_str())
                .ok_or(LedgerError::Invalid("invalid feature database filename"))?
                .to_owned(),
        )?;
        Ok(Self { feature, path })
    }
    pub(super) fn error(&self, source: LedgerError) -> LedgerError {
        source.in_feature(&self.feature)
    }
    pub(super) async fn reader(&self) -> Result<Connection, LedgerError> {
        let connection = Self::connect(&self.path)
            .await
            .map_err(|error| self.error(error))?;
        LedgerSchema::require_current(&connection)
            .await
            .map_err(|error| self.error(error))?;
        Ok(connection)
    }
    pub(super) async fn connect(path: &Path) -> Result<Connection, LedgerError> {
        match fs::metadata(path) {
            Ok(metadata) if metadata.is_file() => {}
            Ok(_) => return Err(LedgerError::Invalid("ledger path must be a regular file")),
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Err(LedgerError::Uninitialized);
            }
            Err(error) => return Err(error.into()),
        }
        let database = Builder::new_local(
            path.to_str()
                .ok_or(LedgerError::Invalid("database path is not UTF-8"))?,
        )
        .read_only(true)
        .with_io(PERSISTENT_IO)
        .experimental_multiprocess_wal(true)
        .build()
        .await?;
        let connection = database.connect()?;
        connection.busy_timeout(Duration::from_millis(250))?;
        LedgerSchema::configure(&connection).await?;
        Ok(connection)
    }
}
impl Repository {
    pub(super) fn observation_file(&self, feature: &FeatureId) -> Result<FeatureFile, LedgerError> {
        Ok(FeatureFile {
            feature: feature.clone(),
            path: self.feature_path(feature)?,
        })
    }
    pub(crate) async fn observed_features(&self) -> Result<FeatureCatalog, LedgerError> {
        let catalog = ObservedCatalog {
            features: BTreeMap::new(),
        }
        .directory(self.repository_directory()?.join("features"))
        .await?;
        Ok(FeatureCatalog {
            features: catalog.features.into_values().collect(),
        })
    }
}

struct SourceMetadata {
    version: StorageVersion,
    features: Vec<Feature>,
}
impl SourceMetadata {
    async fn read(path: &Path) -> Result<Self, LedgerError> {
        let connection = FeatureFile::connect(path).await?;
        let version = LedgerSchema::version(&connection).await?;
        let mut query = Query::select();
        match version {
            StorageVersion::DocumentsV1 | StorageVersion::IndexedV2 => {
                query
                    .column(LegacyFeature::Document)
                    .from(LegacyFeature::Table);
            }
            StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4
            | StorageVersion::SequencedEventsV5
            | StorageVersion::FeatureHistoryV6 => {
                query
                    .column(FeatureTable::Document)
                    .from(FeatureTable::Table);
            }
            StorageVersion::Empty => {
                return Ok(Self {
                    version,
                    features: Vec::new(),
                });
            }
        }
        let mut rows = SqlStatement::build(query)?.query(&connection).await?;
        let mut features = Vec::new();
        while let Some(row) = rows.next().await? {
            features.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(Self { version, features })
    }
}

struct ObservedCatalog {
    features: BTreeMap<FeatureId, CatalogFeature>,
}
impl ObservedCatalog {
    async fn directory(mut self, path: PathBuf) -> Result<Self, LedgerError> {
        let entries = match fs::read_dir(&path) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(self),
            Err(error) => return Err(error.into()),
        };
        let mut paths = Vec::new();
        for entry in entries {
            paths.push(entry?.path());
        }
        paths.sort();
        for path in paths {
            if let Some("db") = path.extension().and_then(|extension| extension.to_str()) {
                self = self.feature_file(FeatureFile::from_path(path)?).await;
            }
        }
        Ok(self)
    }
    async fn feature_file(mut self, file: FeatureFile) -> Self {
        let Entry::Vacant(entry) = self.features.entry(file.feature.clone()) else {
            return self;
        };
        let result = async {
            let metadata = SourceMetadata::read(&file.path).await?;
            match metadata.version {
                StorageVersion::Empty => return Err(LedgerError::Uninitialized),
                StorageVersion::DocumentsV1
                | StorageVersion::IndexedV2
                | StorageVersion::RelationalV3
                | StorageVersion::CommonTasksV4
                | StorageVersion::SequencedEventsV5
                | StorageVersion::FeatureHistoryV6 => {}
            }
            let feature = match metadata.features.as_slice() {
                [feature] if feature.id == file.feature => feature.clone(),
                [] | [_] | [_, _, ..] => {
                    return Err(LedgerError::Invalid(
                        "feature file must contain only its named feature",
                    ));
                }
            };
            Ok::<_, LedgerError>(LedgerInfo {
                path: file.path.clone(),
                storage_version: metadata.version,
                feature,
            })
        }
        .await;
        match result {
            Ok(ledger) => {
                entry.insert(CatalogFeature::from_ledger(ledger));
            }
            Err(error) => {
                entry.insert(CatalogFeature::Unavailable {
                    feature: file.feature.clone(),
                    message: Note::from(file.error(error).to_string()),
                });
            }
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::{FeatureFile, PERSISTENT_IO};
    use crate::git::Repository;
    use crate::values::FeatureId;
    use crate::versions::StorageVersion;
    use crate::{DataDirectory, LedgerError, PageIndex, Workbench};
    use sea_query::Iden;
    use std::fs;
    use std::io;
    use std::path::{Path, PathBuf};
    use tokio::runtime::Builder;
    use turso::Builder as DatabaseBuilder;
    #[derive(Iden)]
    enum Pragma {
        UserVersion,
    }
    #[test]
    fn observation_rejects_missing_nonfile_old_and_unknown_storage_without_changing_it()
    -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        Builder::new_current_thread().enable_time().build()?.block_on(async {
            assert!(matches!(FeatureFile::connect(&directory.path().join("missing")).await, Err(LedgerError::Uninitialized)));
            assert!(matches!(FeatureFile::connect(directory.path()).await, Err(LedgerError::Invalid(_))));
            for version in [StorageVersion::Empty, StorageVersion::DocumentsV1, StorageVersion::IndexedV2, StorageVersion::RelationalV3, StorageVersion::CommonTasksV4] {
                let path = directory.path().join(format!("version-{version}.db"));
                let database = DatabaseBuilder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?).with_io(PERSISTENT_IO).build().await?;
                let connection = database.connect()?;
                connection.pragma_update(&Pragma::UserVersion.to_string(), i64::from(version)).await?;
                drop(connection); drop(database);
                let bytes = fs::read(&path)?;
                assert!(matches!(FeatureFile::from_path(path.clone())?.reader().await, Err(LedgerError::FeatureStorage { source, .. }) if matches!(*source, LedgerError::ObservationMigrationRequired(found) if found == version)));
                assert_eq!(bytes, fs::read(path)?);
            }
            let path = directory.path().join("future.db");
            let database = DatabaseBuilder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?).with_io(PERSISTENT_IO).build().await?;
            let connection = database.connect()?;
            connection.pragma_update(&Pragma::UserVersion.to_string(), 99).await?;
            drop(connection); drop(database);
            let bytes = fs::read(&path)?;
            assert!(matches!(FeatureFile::from_path(path.clone())?.reader().await, Err(LedgerError::FeatureStorage { source, .. }) if matches!(*source, LedgerError::UnsupportedVersion(_))));
            assert_eq!(bytes, fs::read(path)?);
            Ok::<_, anyhow::Error>(())
        })
    }
    struct CatalogFixture {
        directory: tempfile::TempDir,
        repository: Repository,
        workbench: Workbench,
    }
    struct Seed {
        path: PathBuf,
        feature: FeatureId,
        version: StorageVersion,
    }
    impl CatalogFixture {
        fn new() -> anyhow::Result<Self> {
            let directory = tempfile::tempdir()?;
            let project = directory.path().join("project");
            git2::Repository::init(&project)?;
            let data = DataDirectory::from(directory.path().join("data"));
            let workbench = Workbench::discover(&project)?.with_data_directory(data.clone());
            workbench.initialize_repository()?;
            let repository = Repository::discover(&project)?.with_data_directory(data);
            Ok(Self {
                directory,
                repository,
                workbench,
            })
        }
        async fn database(&self, path: &Path) -> anyhow::Result<turso::Database> {
            fs::create_dir_all(
                path.parent()
                    .ok_or_else(|| anyhow::anyhow!("database parent"))?,
            )?;
            Ok(DatabaseBuilder::new_local(
                path.to_str()
                    .ok_or_else(|| anyhow::anyhow!("database path"))?,
            )
            .with_io(PERSISTENT_IO)
            .experimental_multiprocess_wal(true)
            .build()
            .await?)
        }
        async fn seed(&self, seed: Seed) -> anyhow::Result<()> {
            use crate::store::relational::tests::Records;
            use crate::store::relational::{RecordWriter, RelationalSchema};
            use crate::store::sequence::SequenceSchema;
            let database = self.database(&seed.path).await?;
            let connection = database.connect()?;
            RelationalSchema::create(&connection).await?;
            SequenceSchema::migrate(&connection).await?;
            let mut records = Records::new()?;
            records.feature.id = seed.feature;
            records.feature.worktree = self.directory.path().join("project");
            records.task.common.feature = records.feature.id.clone();
            records.event.task = records.task.clone();
            let writer = RecordWriter {
                connection: &connection,
            };
            writer.feature(&records.feature).await?;
            writer.task(&records.task).await?;
            writer.event(&records.event).await?;
            connection
                .pragma_update(&Pragma::UserVersion.to_string(), i64::from(seed.version))
                .await?;
            Ok(())
        }
    }
    #[test]
    fn mixed_catalog_localizes_failures_and_only_selected_upgrade_mutates() -> anyhow::Result<()> {
        use crate::store::relational::tests::Records;
        use crate::store::relational::{EventTable, RecordWriter};
        use crate::{FeatureCard, PageIndex};
        use sea_query::{SqliteQueryBuilder, Table};
        let fixture = CatalogFixture::new()?;
        Builder::new_current_thread().enable_time().build()?.block_on(async {
            let current = FeatureId::try_from("current".to_owned())?;
            let old = FeatureId::try_from("old".to_owned())?;
            let other = FeatureId::try_from("other".to_owned())?;
            let broken = FeatureId::try_from("broken".to_owned())?;
            let future = FeatureId::try_from("future".to_owned())?;
            let multiple = FeatureId::try_from("multiple".to_owned())?;
            for (feature, version) in [(&current, StorageVersion::CURRENT), (&old, StorageVersion::SequencedEventsV5), (&other, StorageVersion::SequencedEventsV5), (&broken, StorageVersion::CURRENT), (&multiple, StorageVersion::CURRENT)] {
                fixture.seed(Seed { path: fixture.repository.feature_path(feature)?, feature: feature.clone(), version }).await?;
            }
            let multiple_path = fixture.repository.feature_path(&multiple)?;
            let multiple_database = fixture.database(&multiple_path).await?;
            let records = Records::new()?;
            RecordWriter { connection: &multiple_database.connect()? }.feature(&records.feature).await?;
            drop(multiple_database);
            let broken_database = fixture.database(&fixture.repository.feature_path(&broken)?).await?;
            broken_database.connect()?.execute(Table::drop().table(EventTable::Table).to_string(SqliteQueryBuilder), ()).await?;
            drop(broken_database);
            let future_path = fixture.repository.feature_path(&future)?;
            let shared = fixture.repository.repository_directory()?.join("workbench.db");
            for path in [&future_path, &shared] {
                let database = fixture.database(path).await?;
                database.connect()?.pragma_update(&Pragma::UserVersion.to_string(), 99).await?;
            }
            let current_path = fixture.repository.feature_path(&current)?;
            let old_path = fixture.repository.feature_path(&old)?;
            let other_path = fixture.repository.feature_path(&other)?;
            let retained = [&current_path, &old_path, &other_path, &future_path, &shared, &multiple_path].into_iter().map(|path| Ok((path, fs::read(path)?))).collect::<io::Result<Vec<_>>>()?;
            let observation = fixture.workbench.observe().await?;
            let cards = observation.summaries(PageIndex::FIRST).await?;
            assert_eq!(cards.features.records.len(), 6);
            assert!(cards.features.records.iter().any(|card| matches!(card, FeatureCard::Unavailable { feature, .. } if feature == &multiple)));
            assert!(fixture.workbench.open(multiple).await.is_err());
            assert!(cards.features.records.iter().any(|card| matches!(card, FeatureCard::Current { summary } if summary.feature.id == current)));
            assert!(cards.features.records.iter().any(|card| matches!(card, FeatureCard::UpgradeRequired { feature, storage_version: StorageVersion::SequencedEventsV5 } if feature.id == old)));
            assert!(cards.features.records.iter().any(|card| matches!(card, FeatureCard::Unavailable { feature, .. } if feature == &broken)));
            assert!(cards.features.records.iter().any(|card| matches!(card, FeatureCard::Unavailable { feature, message } if feature == &future && message.to_string().contains("99") && message.to_string().contains("schema 6"))));
            assert!(observation.workflow(old.clone()).await.is_err());
            assert!(fixture.workbench.open(future.clone()).await.is_err());
            for (path, bytes) in &retained { assert_eq!(*bytes, fs::read(path)?); }
            let ledger = fixture.workbench.open(old.clone()).await?;
            assert_eq!(ledger.info().storage_version, StorageVersion::CURRENT);
            assert_eq!(ledger.status().await?.len(), 1);
            drop(ledger);
            let workflow = fixture.workbench.observe().await?.workflow(old).await?;
            assert_eq!(workflow.chapters.len(), 1);
            for (path, bytes) in retained.into_iter().filter(|(path, _)| *path != &old_path) { assert_eq!(bytes, fs::read(path)?); }
            let cards = fixture.workbench.observe().await?.summaries(PageIndex::FIRST).await?;
            assert!(cards.features.records.iter().any(|card| matches!(card, FeatureCard::UpgradeRequired { feature, .. } if feature.id == other)));
            Ok::<_, anyhow::Error>(())
        })
    }
    #[test]
    fn old_locations_are_ignored_and_missing_features_directory_is_empty() -> anyhow::Result<()> {
        let fixture = CatalogFixture::new()?;
        let project = fixture.directory.path().join("project");
        let id = fs::read_to_string(project.join(".meta-cortex/repository-id"))?;
        let historical = fixture
            .directory
            .path()
            .join("data")
            .join(id.trim())
            .join("features/ignored.db");
        fs::create_dir_all(
            historical
                .parent()
                .ok_or_else(|| anyhow::anyhow!("parent"))?,
        )?;
        let shared = fixture
            .repository
            .repository_directory()?
            .join("workbench.db");
        for path in [&shared, &historical] {
            fs::write(path, b"ignored unsupported former storage")?;
        }
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                assert!(fixture.workbench.features().await?.features.is_empty());
                let observation = fixture.workbench.observe().await?;
                assert!(
                    observation
                        .features(PageIndex::FIRST)
                        .await?
                        .features
                        .records
                        .is_empty()
                );
                assert!(
                    observation
                        .summaries(PageIndex::FIRST)
                        .await?
                        .features
                        .records
                        .is_empty()
                );
                assert!(matches!(
                    fixture
                        .workbench
                        .open(FeatureId::try_from("ignored".to_owned())?)
                        .await,
                    Err(LedgerError::Uninitialized)
                ));
                Ok::<_, anyhow::Error>(())
            })?;
        for path in [&shared, &historical] {
            assert_eq!(fs::read(path)?, b"ignored unsupported former storage");
        }
        assert!(
            !fixture
                .repository
                .repository_directory()?
                .join("features")
                .exists()
        );
        Ok(())
    }
    #[test]
    #[ignore = "explicit native GUI acceptance fixture export"]
    fn export_native_catalog_fixture() -> anyhow::Result<()> {
        let fixture = CatalogFixture::new()?;
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                for (name, version) in [
                    ("current", StorageVersion::CURRENT),
                    ("upgrade-me", StorageVersion::SequencedEventsV5),
                ] {
                    let feature = FeatureId::try_from(name.to_owned())?;
                    fixture
                        .seed(Seed {
                            path: fixture.repository.feature_path(&feature)?,
                            feature,
                            version,
                        })
                        .await?;
                }
                let future = FeatureId::try_from("future".to_owned())?;
                let database = fixture
                    .database(&fixture.repository.feature_path(&future)?)
                    .await?;
                database
                    .connect()?
                    .pragma_update(&Pragma::UserVersion.to_string(), 99)
                    .await?;
                Ok::<_, anyhow::Error>(())
            })?;
        let path = fixture.directory.keep();
        println!("Native fixture project: {}", path.join("project").display());
        println!(
            "Native fixture META_CORTEX_HOME: {}",
            path.join("data").display()
        );
        Ok(())
    }
}
