//! Observational path discovery. A feature file wins over shared storage, which
//! wins over the historical unnamed repository directory. No source is mutated.
use super::LedgerInfo;
use super::PERSISTENT_IO;
use super::legacy::LegacyFeature;
use super::relational::FeatureTable;
use super::schema::LedgerSchema;
use super::sql::SqlStatement;
use crate::LedgerError;
use crate::git::Repository;
use crate::model::Feature;
use crate::values::FeatureId;
use crate::versions::StorageVersion;
use sea_query::Query;
use std::cmp::Ordering;
use std::collections::{BTreeMap, btree_map::Entry};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::Duration;
use turso::{Builder, Connection};

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
    pub(super) fn feature_files(&self) -> Result<Vec<FeatureFile>, LedgerError> {
        let directory = self.repository_directory()?.join("features");
        let entries = match fs::read_dir(directory) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(error.into()),
        };
        let mut files = Vec::new();
        for entry in entries {
            let path = entry?.path();
            if let Some("db") = path.extension().and_then(|extension| extension.to_str()) {
                files.push(FeatureFile::from_path(path)?);
            }
        }
        files.sort_by(|left, right| left.feature.cmp(&right.feature));
        Ok(files)
    }
    pub(super) async fn observation_file(
        &self,
        feature: &FeatureId,
    ) -> Result<FeatureFile, LedgerError> {
        let file = FeatureFile {
            feature: feature.clone(),
            path: self.feature_path(feature)?,
        };
        match file.presence().await? {
            FeaturePresence::Committed => return Ok(file),
            FeaturePresence::Absent => {}
        }
        let shared = self.ledger_path()?;
        for stored in Self::source_features(&shared)
            .await
            .map_err(|error| file.error(error))?
        {
            match stored.id.cmp(feature) {
                Ordering::Equal => {
                    return Ok(FeatureFile {
                        feature: feature.clone(),
                        path: shared,
                    });
                }
                Ordering::Less | Ordering::Greater => {}
            }
        }
        Ok(FeatureFile {
            feature: feature.clone(),
            path: self.historical_path(feature)?,
        })
    }
    pub(crate) async fn observed_features(&self) -> Result<Vec<LedgerInfo>, LedgerError> {
        let mut catalog = ObservedCatalog {
            features: BTreeMap::new(),
        };
        for file in self.feature_files()? {
            catalog = catalog.feature_file(file).await?;
        }
        let shared = self.ledger_path()?;
        for feature in Self::source_features(&shared).await? {
            catalog = catalog
                .shared_feature(SharedFeature {
                    path: shared.clone(),
                    feature,
                })
                .await?;
        }
        for path in self.legacy_ledgers()? {
            catalog = catalog.feature_file(FeatureFile::from_path(path)?).await?;
        }
        Ok(catalog.features.into_values().collect())
    }
    async fn source_features(path: &Path) -> Result<Vec<Feature>, LedgerError> {
        let FilePresence::Present = FilePresence::from(path.try_exists()?) else {
            return Ok(Vec::new());
        };
        let connection = FeatureFile::connect(path).await?;
        let mut query = Query::select();
        match LedgerSchema::version(&connection).await? {
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
                return Err(LedgerError::ObservationMigrationRequired(
                    StorageVersion::Empty,
                ));
            }
        }
        let mut rows = SqlStatement::build(query)?.query(&connection).await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(serde_json::from_str(&row.get::<String>(0)?)?);
        }
        Ok(records)
    }
}

enum FeaturePresence {
    Absent,
    Committed,
}
impl FeatureFile {
    async fn presence(&self) -> Result<FeaturePresence, LedgerError> {
        let FilePresence::Present = FilePresence::from(self.path.try_exists()?) else {
            return Ok(FeaturePresence::Absent);
        };
        let connection = Self::connect(&self.path)
            .await
            .map_err(|error| self.error(error))?;
        match LedgerSchema::version(&connection)
            .await
            .map_err(|error| self.error(error))?
        {
            // An import that rolled back may leave an empty engine file. It never
            // takes precedence over the retained source and can be retried safely.
            StorageVersion::Empty => Ok(FeaturePresence::Absent),
            StorageVersion::DocumentsV1
            | StorageVersion::IndexedV2
            | StorageVersion::RelationalV3
            | StorageVersion::CommonTasksV4
            | StorageVersion::SequencedEventsV5
            | StorageVersion::FeatureHistoryV6 => Ok(FeaturePresence::Committed),
        }
    }
}
struct SharedFeature {
    path: PathBuf,
    feature: Feature,
}
struct ObservedCatalog {
    features: BTreeMap<FeatureId, LedgerInfo>,
}
impl ObservedCatalog {
    async fn feature_file(mut self, file: FeatureFile) -> Result<Self, LedgerError> {
        let Entry::Vacant(entry) = self.features.entry(file.feature.clone()) else {
            return Ok(self);
        };
        match file.presence().await? {
            FeaturePresence::Absent => return Ok(self),
            FeaturePresence::Committed => {}
        }
        let connection = file.reader().await?;
        let feature = super::Documents {
            connection: &connection,
            feature: &file.feature,
        }
        .feature()
        .await
        .map_err(|error| file.error(error))?;
        entry.insert(LedgerInfo {
            path: file.path,
            storage_version: StorageVersion::CURRENT,
            feature,
        });
        Ok(self)
    }
    async fn shared_feature(mut self, source: SharedFeature) -> Result<Self, LedgerError> {
        let Entry::Vacant(entry) = self.features.entry(source.feature.id.clone()) else {
            return Ok(self);
        };
        let file = FeatureFile {
            feature: source.feature.id.clone(),
            path: source.path,
        };
        file.reader().await?;
        entry.insert(LedgerInfo {
            path: file.path,
            storage_version: StorageVersion::CURRENT,
            feature: source.feature,
        });
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::{FeatureFile, PERSISTENT_IO};
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
}
