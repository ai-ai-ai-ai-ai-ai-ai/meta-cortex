use super::PERSISTENT_IO;
use super::catalog::FilePresence;
use super::legacy::LegacyImport;
use super::relational::FeatureTable;
use super::schema::LedgerSchema;
use super::sql::SqlStatement;
use super::{Documents, FeatureLoaded, InitializeLedger, Ledger, OpenLedger};
use crate::LedgerError;
use crate::model::Feature;
use crate::values::FeatureId;
use crate::versions::RecordVersion;
use sea_query::{OnConflict, Query};
use std::fs;
use std::time::Duration;
use turso::transaction::TransactionBehavior;
use turso::{Builder, Connection};

// The input is a validated Feature for initialization or a FeatureId for opening.
// Fields and constructors stay here so other modules cannot skip preparation.
struct Located<FeatureInput> {
    feature: FeatureInput,
}
struct Connected<FeatureInput> {
    connection: Connection,
    feature: FeatureInput,
}
struct SchemaReady<FeatureInput> {
    connection: Connection,
    feature: FeatureInput,
}

enum FeaturePreparation {
    Initialize,
    Existing,
}
struct MigrationRequest<'a> {
    selected: &'a FeatureId,
    mode: FeaturePreparation,
}

impl Ledger {
    pub(crate) async fn initialize(request: InitializeLedger) -> Result<Self, LedgerError> {
        let selected = request.input.feature.clone();
        Ledger::<Located<Feature>>::locate(request)?
            .connect()
            .await?
            .migrate(MigrationRequest {
                selected: &selected,
                mode: FeaturePreparation::Initialize,
            })
            .await?
            .initialize_feature()
            .await
    }

    pub(crate) async fn open(request: OpenLedger) -> Result<Self, LedgerError> {
        let selected = request.feature.clone();
        Ledger::<Located<FeatureId>>::locate(request)?
            .connect()
            .await?
            .migrate(MigrationRequest {
                selected: &selected,
                mode: FeaturePreparation::Existing,
            })
            .await?
            .load_feature()
            .await
    }
}

impl Ledger<Located<Feature>> {
    fn locate(request: InitializeLedger) -> Result<Self, LedgerError> {
        let feature = Feature {
            version: RecordVersion::CURRENT,
            id: request.input.feature,
            objective: request.input.objective,
            branch: request.input.branch,
            worktree: request.input.worktree.canonicalize()?,
        };
        request.repository.require_feature(&feature)?;
        request.repository.initialize()?;
        let path = request.repository.feature_path(&feature.id)?;
        fs::create_dir_all(
            path.parent()
                .ok_or(LedgerError::Invalid("ledger path has no parent"))?,
        )?;
        Ok(Self {
            state: Located { feature },
            path,
            repository: request.repository,
        })
    }
}

impl Ledger<Located<FeatureId>> {
    fn locate(request: OpenLedger) -> Result<Self, LedgerError> {
        let path = request.repository.feature_path(&request.feature)?;
        if let (FilePresence::Missing, FilePresence::Missing, FilePresence::Missing) = (
            FilePresence::from(path.try_exists()?),
            FilePresence::from(request.repository.ledger_path()?.try_exists()?),
            FilePresence::from(
                request
                    .repository
                    .historical_path(&request.feature)?
                    .try_exists()?,
            ),
        ) {
            return Err(LedgerError::Uninitialized);
        }

        fs::create_dir_all(
            path.parent()
                .ok_or(LedgerError::Invalid("ledger path has no parent"))?,
        )?;
        Ok(Self {
            state: Located {
                feature: request.feature,
            },
            path,
            repository: request.repository,
        })
    }
}

impl<FeatureInput> Ledger<Located<FeatureInput>> {
    async fn connect(self) -> Result<Ledger<Connected<FeatureInput>>, LedgerError> {
        let path = self
            .path
            .to_str()
            .ok_or(LedgerError::Invalid("ledger path must be UTF-8"))?;
        let database = Builder::new_local(path)
            .with_io(PERSISTENT_IO)
            .experimental_multiprocess_wal(true)
            .build()
            .await?;
        let connection = database.connect()?;
        connection.busy_timeout(Duration::from_secs(10))?;
        Ok(Ledger {
            state: Connected {
                connection,
                feature: self.state.feature,
            },
            path: self.path,
            repository: self.repository,
        })
    }
}

impl<FeatureInput> Ledger<Connected<FeatureInput>> {
    async fn migrate(
        mut self,
        request: MigrationRequest<'_>,
    ) -> Result<Ledger<SchemaReady<FeatureInput>>, LedgerError> {
        let selected = request.selected;
        // Schema creation/migration and the selected import commit together.
        // Turso's transaction API requires a mutable connection resource.
        LedgerSchema::configure(&self.state.connection).await?;
        let tx = self
            .state
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        LedgerSchema::migrate_transaction(&tx)
            .await
            .map_err(|error| error.in_feature(selected))?;
        Documents {
            connection: &tx,
            feature: selected,
        }
        .require_feature_scope()
        .await
        .map_err(|error| error.in_feature(selected))?;
        let importer = LegacyImport {
            connection: &tx,
            feature: selected,
        };
        importer
            .import(&self.repository.ledger_path()?)
            .await
            .map_err(|error| error.in_feature(selected))?;
        importer
            .import(&self.repository.historical_path(selected)?)
            .await
            .map_err(|error| error.in_feature(selected))?;
        if let FeaturePreparation::Existing = request.mode {
            Documents {
                connection: &tx,
                feature: selected,
            }
            .feature()
            .await?;
        }
        tx.commit().await?;
        Ok(Ledger {
            state: SchemaReady {
                connection: self.state.connection,
                feature: self.state.feature,
            },
            path: self.path,
            repository: self.repository,
        })
    }
}

impl Ledger<SchemaReady<Feature>> {
    async fn initialize_feature(mut self) -> Result<Ledger, LedgerError> {
        let tx = self
            .state
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        LedgerSchema::require_current(&tx)
            .await
            .map_err(|error| error.in_feature(&self.state.feature.id))?;
        SqlStatement::build(
            Query::insert()
                .into_table(FeatureTable::Table)
                .columns([FeatureTable::Id, FeatureTable::Document])
                .values([
                    self.state.feature.id.to_string().into(),
                    serde_json::to_string(&self.state.feature)?.into(),
                ])?
                .on_conflict(OnConflict::column(FeatureTable::Id).do_nothing().to_owned())
                .to_owned(),
        )?
        .execute(&tx)
        .await?;
        let stored = Documents {
            connection: &tx,
            feature: &self.state.feature.id,
        }
        .feature()
        .await?;
        if stored != self.state.feature {
            return Err(LedgerError::AlreadyExists);
        }
        tx.commit().await?;
        Ok(Ledger {
            state: FeatureLoaded {
                connection: self.state.connection,
                feature: stored,
            },
            path: self.path,
            repository: self.repository,
        })
    }
}

impl Ledger<SchemaReady<FeatureId>> {
    async fn load_feature(self) -> Result<Ledger, LedgerError> {
        let feature = Documents {
            connection: &self.state.connection,
            feature: &self.state.feature,
        }
        .feature()
        .await?;
        if feature.id != self.state.feature {
            return Err(LedgerError::Invalid(
                "feature document does not match ledger location",
            ));
        }
        Ok(Ledger {
            state: FeatureLoaded {
                connection: self.state.connection,
                feature,
            },
            path: self.path,
            repository: self.repository,
        })
    }
}

#[cfg(test)]
pub mod tests {
    use super::PERSISTENT_IO;
    use super::{InitializeLedger, Ledger, OpenLedger};
    use crate::git::Repository;
    use crate::request::InitFeature;
    use crate::store::relational::FeatureTable;
    use crate::store::sql::SqlStatement;
    use crate::values::{BranchName, FeatureId, Note};
    use crate::{DataDirectory, LedgerError};
    use sea_query::Query;
    use tokio::runtime;
    use turso::Builder;

    #[test]
    fn failed_feature_preparation_preserves_existing_data() -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        let mut options = git2::RepositoryInitOptions::new();
        options.initial_head("codex/feature");
        let git = git2::Repository::init_opts(directory.path(), &options)?;
        let signature = git2::Signature::now("Ledger Test", "ledger@example.invalid")?;
        let tree_id = git.index()?.write_tree()?;
        let tree = git.find_tree(tree_id)?;
        git.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])?;
        let data = tempfile::tempdir()?;
        let repository = Repository::discover(directory.path())?
            .with_data_directory(DataDirectory::from(data.path().to_owned()));
        let feature = FeatureId::try_from("feature".to_owned())?;
        let branch = BranchName::try_from("codex/feature".to_owned())?;
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                assert!(matches!(
                    Ledger::open(OpenLedger {
                        repository: repository.clone(),
                        feature: feature.clone()
                    })
                    .await,
                    Err(LedgerError::Uninitialized)
                ));
                let loaded = Ledger::initialize(InitializeLedger {
                    repository: repository.clone(),
                    input: InitFeature {
                        feature: feature.clone(),
                        branch,
                        objective: Note::from("original".to_owned()),
                        worktree: directory.path().to_owned(),
                    },
                })
                .await?;
                let info = loaded.info();
                drop(loaded);
                assert!(matches!(
                    Ledger::initialize(InitializeLedger {
                        repository: repository.clone(),
                        input: InitFeature {
                            feature: feature.clone(),
                            branch: info.feature.branch.clone(),
                            objective: Note::from("conflicting objective".to_owned()),
                            worktree: directory.path().to_owned(),
                        },
                    })
                    .await,
                    Err(LedgerError::AlreadyExists)
                ));
                let reopened = Ledger::open(OpenLedger {
                    repository: repository.clone(),
                    feature: feature.clone(),
                })
                .await?;
                assert_eq!(reopened.info().feature, info.feature);
                drop(reopened);
                let database = Builder::new_local(
                    info.path
                        .to_str()
                        .ok_or_else(|| anyhow::anyhow!("database path"))?,
                )
                .with_io(PERSISTENT_IO)
                .experimental_multiprocess_wal(true)
                .build()
                .await?;
                let connection = database.connect()?;
                let mut mismatched = info.feature;
                mismatched.id = FeatureId::try_from("another-feature".to_owned())?;
                assert!(
                    SqlStatement::build(
                        Query::update()
                            .table(FeatureTable::Table)
                            .value(FeatureTable::Document, serde_json::to_string(&mismatched)?)
                            .to_owned(),
                    )?
                    .execute(&connection)
                    .await
                    .is_err()
                );
                SqlStatement::build(Query::delete().from_table(FeatureTable::Table).to_owned())?
                    .execute(&connection)
                    .await?;
                assert!(matches!(
                    Ledger::open(OpenLedger {
                        repository,
                        feature
                    })
                    .await,
                    Err(LedgerError::Uninitialized)
                ));
                anyhow::Ok(())
            })
    }
}
