//! Global storage browsing independent of Git and checkout availability.
use crate::values::FeatureId;
use crate::{DataDirectory, LedgerError, Observation, RepositoryId};
use derive_more::{Display, From};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::fs::{self, FileType};
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

/// Human-readable directory label retained by the existing storage layout.
#[derive(
    Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(try_from = "String", into = "String")]
#[schemars(with = "String")]
pub struct RepositoryName(String);
impl TryFrom<String> for RepositoryName {
    type Error = LedgerError;
    fn try_from(text: String) -> Result<Self, Self::Error> {
        let components: Vec<_> = Path::new(&text).components().collect();
        match components.as_slice() {
            [Component::Normal(name)] if *name == text.as_str() => Ok(Self(text)),
            [] | [_] | [_, _, ..] => Err(LedgerError::Invalid(
                "repository name must be one directory component",
            )),
        }
    }
}
impl From<RepositoryName> for String {
    fn from(name: RepositoryName) -> Self {
        let RepositoryName(text) = name;
        text
    }
}
/// Both components are required: equal names and feature IDs may belong to independent clones.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RepositorySelection {
    pub name: RepositoryName,
    pub repository_id: RepositoryId,
}
#[derive(Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(transparent)]
pub struct FeatureCount(usize);
impl FeatureCount {
    const EMPTY: Self = Self(0);
    #[must_use]
    fn record(self, recognition: FeatureRecognition) -> Self {
        match recognition {
            FeatureRecognition::Recorded => {
                let Self(count) = self;
                Self(count.saturating_add(1))
            }
            FeatureRecognition::Ignored => self,
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct RepositoryCard {
    pub repository: RepositorySelection,
    pub feature_count: FeatureCount,
}
/// Read-only catalog capability. Construction and discovery never create storage.
#[derive(Clone, From)]
pub struct StorageObservation {
    directory: DataDirectory,
}
impl StorageObservation {
    pub fn discover() -> Result<Self, LedgerError> {
        Ok(Self::from(DataDirectory::discover()?))
    }
    pub fn repositories(&self) -> Result<Vec<RepositoryCard>, LedgerError> {
        let mut cards = Vec::new();
        for path in Self::directories(self.directory.path())? {
            cards.extend(self.named_repositories(path)?);
        }
        cards.sort_by(|left, right| left.repository.cmp(&right.repository));
        Ok(cards)
    }
    fn named_repositories(&self, path: PathBuf) -> Result<Vec<RepositoryCard>, LedgerError> {
        let Some(label) = path.file_name().and_then(|name| name.to_str()) else {
            return Ok(Vec::new());
        };
        let name = RepositoryName::try_from(label.to_owned())?;
        let mut cards = Vec::new();
        for group in Self::directories(&path)? {
            match (RepositoryCandidate {
                name: name.clone(),
                path: group,
            })
            .card()?
            {
                RepositoryDiscovery::Recorded(card) => cards.push(card),
                RepositoryDiscovery::Ignored => {}
            }
        }
        Ok(cards)
    }
    pub fn observe(&self, repository: RepositorySelection) -> Result<Observation, LedgerError> {
        let path = self
            .directory
            .path()
            .join(repository.name.to_string())
            .join(repository.repository_id.to_string());
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_dir() => Ok(Observation { directory: path }),
            Ok(_) => Err(LedgerError::Invalid(
                "repository storage must be a directory",
            )),
            Err(error) if error.kind() == ErrorKind::NotFound => Err(LedgerError::NotFound),
            Err(error) => Err(error.into()),
        }
    }
    /// Explicitly upgrade only the selected existing feature, without Git or checkout discovery.
    pub async fn upgrade(
        &self,
        request: StoredFeatureSelection,
    ) -> Result<Observation, LedgerError> {
        let observation = self.observe(request.repository)?;
        observation.upgrade(&request.feature).await?;
        Ok(observation)
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct StoredFeatureSelection {
    pub repository: RepositorySelection,
    pub feature: FeatureId,
}
enum RepositoryDiscovery {
    Recorded(RepositoryCard),
    Ignored,
}
struct RepositoryCandidate {
    name: RepositoryName,
    path: PathBuf,
}
impl RepositoryCandidate {
    fn card(self) -> Result<RepositoryDiscovery, LedgerError> {
        let Some(text) = self.path.file_name().and_then(|name| name.to_str()) else {
            return Ok(RepositoryDiscovery::Ignored);
        };
        let repository_id = match RepositoryId::try_from(text.to_owned()) {
            Ok(id) if id.to_string() == text => id,
            Ok(_) | Err(_) => return Ok(RepositoryDiscovery::Ignored),
        };
        let features = self.path.join("features");
        match fs::symlink_metadata(&features) {
            Ok(metadata) if metadata.is_dir() => {}
            Ok(_) => return Ok(RepositoryDiscovery::Ignored),
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Ok(RepositoryDiscovery::Ignored);
            }
            Err(error) => return Err(error.into()),
        }
        Ok(RepositoryDiscovery::Recorded(RepositoryCard {
            repository: RepositorySelection {
                name: self.name,
                repository_id,
            },
            feature_count: FeatureFiles::count(&features)?,
        }))
    }
}
impl StorageObservation {
    fn directories(path: &Path) -> Result<Vec<PathBuf>, LedgerError> {
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(error.into()),
        };
        let mut directories = Vec::new();
        for entry in entries {
            let entry = entry?;
            let StorageEntryKind::Directory = StorageEntryKind::from(entry.file_type()?) else {
                continue;
            };
            directories.push(entry.path());
        }
        Ok(directories)
    }
}
enum StorageEntryKind {
    Directory,
    File,
    Ignored,
}
impl From<FileType> for StorageEntryKind {
    fn from(kind: FileType) -> Self {
        match kind.is_dir() {
            true => Self::Directory,
            false => match kind.is_file() {
                true => Self::File,
                false => Self::Ignored,
            },
        }
    }
}
enum FeatureRecognition {
    Recorded,
    Ignored,
}
struct FeatureFiles;
impl FeatureFiles {
    fn count(path: &Path) -> Result<FeatureCount, LedgerError> {
        let mut count = FeatureCount::EMPTY;
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let StorageEntryKind::File = StorageEntryKind::from(entry.file_type()?) else {
                continue;
            };
            count = count.record(Self::recognized(entry.path()));
        }
        Ok(count)
    }
    fn recognized(path: PathBuf) -> FeatureRecognition {
        let Some("db") = path.extension().and_then(|extension| extension.to_str()) else {
            return FeatureRecognition::Ignored;
        };
        let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
            return FeatureRecognition::Ignored;
        };
        match FeatureId::try_from(stem.to_owned()) {
            Ok(_) => FeatureRecognition::Recorded,
            Err(_) => FeatureRecognition::Ignored,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        FeatureCount, RepositoryName, RepositorySelection, StorageObservation,
        StoredFeatureSelection,
    };
    use crate::store::PERSISTENT_IO;
    use crate::store::relational::tests::Records;
    use crate::store::relational::{RecordWriter, RelationalSchema};
    use crate::store::sequence::SequenceSchema;
    use crate::values::{FeatureId, Note};
    use crate::versions::StorageVersion;
    use crate::{CatalogFeature, DataDirectory, FeatureCard, LedgerError, PageIndex, RepositoryId};
    use sea_query::Iden;
    use std::fs;
    use std::path::PathBuf;
    use tokio::runtime::Builder;
    use turso::Builder as DatabaseBuilder;
    #[derive(Iden)]
    enum Pragma {
        UserVersion,
    }
    enum RepositoryFixture {
        First,
        Second,
    }
    struct StorageFixture {
        directory: tempfile::TempDir,
        storage: StorageObservation,
    }
    struct Seed {
        repository: RepositorySelection,
        feature: FeatureId,
        version: StorageVersion,
        objective: Note,
    }
    impl StorageFixture {
        fn new() -> anyhow::Result<Self> {
            let directory = tempfile::tempdir()?;
            let storage =
                StorageObservation::from(DataDirectory::from(directory.path().join("data")));
            Ok(Self { directory, storage })
        }
        fn selection(identity: RepositoryFixture) -> anyhow::Result<RepositorySelection> {
            Ok(RepositorySelection {
                name: RepositoryName::try_from("same-name".to_owned())?,
                repository_id: match identity {
                    RepositoryFixture::First => {
                        RepositoryId::try_from("11111111-1111-4111-8111-111111111111".to_owned())?
                    }
                    RepositoryFixture::Second => {
                        RepositoryId::try_from("22222222-2222-4222-8222-222222222222".to_owned())?
                    }
                },
            })
        }
        async fn seed(&self, seed: Seed) -> anyhow::Result<PathBuf> {
            let path = self
                .directory
                .path()
                .join("data")
                .join(seed.repository.name.to_string())
                .join(seed.repository.repository_id.to_string())
                .join("features")
                .join(format!("{}.db", seed.feature));
            fs::create_dir_all(
                path.parent()
                    .ok_or_else(|| anyhow::anyhow!("database parent"))?,
            )?;
            let database = DatabaseBuilder::new_local(
                path.to_str()
                    .ok_or_else(|| anyhow::anyhow!("database path"))?,
            )
            .with_io(PERSISTENT_IO)
            .experimental_multiprocess_wal(true)
            .build()
            .await?;
            let connection = database.connect()?;
            RelationalSchema::create(&connection).await?;
            SequenceSchema::migrate(&connection).await?;
            let mut records = Records::new()?;
            records.feature.id = seed.feature;
            records.feature.objective = seed.objective.clone();
            records.feature.worktree = self.directory.path().join("deleted-checkout");
            records.task.common.feature = records.feature.id.clone();
            records.task.common.objective = seed.objective;
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
            Ok(path)
        }
    }
    #[test]
    fn missing_global_store_and_unrelated_home_entries_are_untouched() -> anyhow::Result<()> {
        let fixture = StorageFixture::new()?;
        assert!(fixture.storage.repositories()?.is_empty());
        assert!(!fixture.directory.path().join("data").exists());
        assert!(matches!(
            fixture
                .storage
                .observe(StorageFixture::selection(RepositoryFixture::First)?),
            Err(LedgerError::NotFound)
        ));
        assert!(!fixture.directory.path().join("data").exists());
        let data = fixture.directory.path().join("data");
        for name in [
            "bun/bin",
            "mise/shims",
            "same-name/not-a-uuid/features",
            "legacy",
        ] {
            fs::create_dir_all(data.join(name))?;
        }
        fs::write(
            data.join("legacy/workbench.db"),
            b"unsupported legacy storage",
        )?;
        fs::write(data.join("workbench.db"), b"unsupported shared storage")?;
        assert!(fixture.storage.repositories()?.is_empty());
        assert_eq!(
            fs::read(data.join("workbench.db"))?,
            b"unsupported shared storage"
        );
        assert!(!data.join("bun/features").exists());
        Ok(())
    }
    #[test]
    fn global_groups_and_identical_feature_ids_remain_isolated_without_checkouts()
    -> anyhow::Result<()> {
        let fixture = StorageFixture::new()?;
        let first = StorageFixture::selection(RepositoryFixture::First)?;
        let second = StorageFixture::selection(RepositoryFixture::Second)?;
        let feature = FeatureId::try_from("shared-id".to_owned())?;
        let checkout = fixture.directory.path().join("deleted-checkout");
        fs::create_dir_all(&checkout)?;
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let left = fixture
                    .seed(Seed {
                        repository: first.clone(),
                        feature: feature.clone(),
                        version: StorageVersion::CURRENT,
                        objective: Note::from("first clone".to_owned()),
                    })
                    .await?;
                let right = fixture
                    .seed(Seed {
                        repository: second.clone(),
                        feature: feature.clone(),
                        version: StorageVersion::CURRENT,
                        objective: Note::from("second clone".to_owned()),
                    })
                    .await?;
                fs::remove_dir_all(&checkout)?;
                let left_bytes = fs::read(&left)?;
                let right_bytes = fs::read(&right)?;
                let groups = fixture.storage.repositories()?;
                assert_eq!(groups.len(), 2);
                assert_eq!(groups[0].repository, first);
                assert_eq!(groups[1].repository, second);
                assert_eq!(groups[0].feature_count, FeatureCount(1));
                for group in groups {
                    let observation = fixture.storage.observe(group.repository.clone())?;
                    let cards = observation.summaries(PageIndex::FIRST).await?;
                    assert!(matches!(
                        cards.features.records.as_slice(),
                        [FeatureCard::Current { .. }]
                    ));
                    let workflow = observation.workflow(feature.clone()).await?;
                    assert_eq!(workflow.chapters.len(), 1);
                    assert_eq!(workflow.revision_log.len(), 1);
                }
                let first_workflow = fixture
                    .storage
                    .observe(first.clone())?
                    .workflow(feature.clone())
                    .await?;
                let second_workflow = fixture
                    .storage
                    .observe(second)?
                    .workflow(feature.clone())
                    .await?;
                assert_eq!(
                    first_workflow.chapters[0].task.common.objective,
                    Note::from("first clone".to_owned())
                );
                assert_eq!(
                    second_workflow.chapters[0].task.common.objective,
                    Note::from("second clone".to_owned())
                );
                assert_eq!(fixture.storage.repositories()?.len(), 2);
                assert_eq!(left_bytes, fs::read(&left)?);
                assert_eq!(right_bytes, fs::read(&right)?);
                assert!(!checkout.exists());
                Ok::<_, anyhow::Error>(())
            })
    }
    #[test]
    fn explicit_storage_upgrade_only_changes_the_selected_old_feature() -> anyhow::Result<()> {
        let fixture = StorageFixture::new()?;
        let first = StorageFixture::selection(RepositoryFixture::First)?;
        let second = StorageFixture::selection(RepositoryFixture::Second)?;
        let selected = FeatureId::try_from("selected".to_owned())?;
        let sibling = FeatureId::try_from("sibling".to_owned())?;
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let left = fixture
                    .seed(Seed {
                        repository: first.clone(),
                        feature: selected.clone(),
                        version: StorageVersion::SequencedEventsV5,
                        objective: Note::from("old selected".to_owned()),
                    })
                    .await?;
                let sibling_path = fixture
                    .seed(Seed {
                        repository: first.clone(),
                        feature: sibling.clone(),
                        version: StorageVersion::SequencedEventsV5,
                        objective: Note::from("old sibling".to_owned()),
                    })
                    .await?;
                let clone_path = fixture
                    .seed(Seed {
                        repository: second.clone(),
                        feature: selected.clone(),
                        version: StorageVersion::SequencedEventsV5,
                        objective: Note::from("old clone".to_owned()),
                    })
                    .await?;
                let retained = fs::read(&left)?;
                let sibling_bytes = fs::read(&sibling_path)?;
                let clone_bytes = fs::read(&clone_path)?;
                let observation = fixture.storage.observe(first.clone())?;
                assert!(observation.workflow(selected.clone()).await.is_err());
                assert_eq!(retained, fs::read(&left)?);
                let upgraded = fixture
                    .storage
                    .upgrade(StoredFeatureSelection {
                        repository: first.clone(),
                        feature: selected.clone(),
                    })
                    .await?;
                let workflow = upgraded.workflow(selected.clone()).await?;
                assert_eq!(workflow.chapters.len(), 1);
                assert_eq!(workflow.revision_log.len(), 1);
                assert!(matches!(
                    upgraded
                        .features(PageIndex::FIRST)
                        .await?
                        .features
                        .records
                        .as_slice(),
                    [
                        CatalogFeature::Current { .. },
                        CatalogFeature::UpgradeRequired { .. }
                    ]
                ));
                assert_eq!(sibling_bytes, fs::read(&sibling_path)?);
                assert_eq!(clone_bytes, fs::read(&clone_path)?);
                fixture
                    .storage
                    .upgrade(StoredFeatureSelection {
                        repository: first,
                        feature: selected,
                    })
                    .await?;
                assert!(!fixture.directory.path().join("deleted-checkout").exists());
                Ok::<_, anyhow::Error>(())
            })
    }
    #[test]
    fn missing_and_future_selected_storage_are_rejected_without_creation_or_writes()
    -> anyhow::Result<()> {
        let fixture = StorageFixture::new()?;
        let repository = StorageFixture::selection(RepositoryFixture::First)?;
        let feature = FeatureId::try_from("future".to_owned())?;
        Builder::new_current_thread().enable_time().build()?.block_on(async {
            let path = fixture.seed(Seed { repository: repository.clone(), feature: feature.clone(), version: StorageVersion::CURRENT, objective: Note::Empty }).await?;
            let database = DatabaseBuilder::new_local(path.to_str().ok_or_else(|| anyhow::anyhow!("database path"))?).with_io(PERSISTENT_IO).experimental_multiprocess_wal(true).build().await?;
            database.connect()?.pragma_update(&Pragma::UserVersion.to_string(), 99).await?;
            drop(database);
            let before = fs::read(&path)?;
            let observation = fixture.storage.observe(repository.clone())?;
            assert!(matches!(observation.summaries(PageIndex::FIRST).await?.features.records.as_slice(), [FeatureCard::Unavailable { .. }]));
            assert!(matches!(fixture.storage.upgrade(StoredFeatureSelection { repository: repository.clone(), feature }).await, Err(LedgerError::FeatureStorage { source, .. }) if matches!(*source, LedgerError::UnsupportedVersion(_))));
            assert_eq!(before, fs::read(&path)?);
            let missing = FeatureId::try_from("missing".to_owned())?;
            assert!(fixture.storage.upgrade(StoredFeatureSelection { repository, feature: missing }).await.is_err());
            assert!(!path.with_file_name("missing.db").exists());
            Ok::<_, anyhow::Error>(())
        })
    }

    #[test]
    fn repository_transport_rejects_traversal_nil_and_malformed_identity() -> anyhow::Result<()> {
        for name in ["", ".", "..", "../repository", "a/b", "/absolute", "a/"] {
            assert!(RepositoryName::try_from(name.to_owned()).is_err());
        }
        for id in ["bad-id", "00000000-0000-0000-0000-000000000000"] {
            assert!(RepositoryId::try_from(id.to_owned()).is_err());
        }
        let selection = StorageFixture::selection(RepositoryFixture::First)?;
        let decoded: RepositorySelection =
            serde_json::from_str(&serde_json::to_string(&selection)?)?;
        assert_eq!(selection, decoded);
        assert!(
            serde_json::from_str::<RepositorySelection>(
                r#"{"name":"../escape","repository_id":"11111111-1111-4111-8111-111111111111"}"#
            )
            .is_err()
        );
        Ok(())
    }
}
