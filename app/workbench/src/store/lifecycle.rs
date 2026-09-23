use super::schema::{FeatureTable, LedgerSchema};
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

impl Ledger {
    pub(crate) async fn initialize(request: InitializeLedger) -> Result<Self, LedgerError> {
        Ledger::<Located<Feature>>::locate(request)?
            .connect()
            .await?
            .migrate()
            .await?
            .initialize_feature()
            .await
    }

    pub(crate) async fn open(request: OpenLedger) -> Result<Self, LedgerError> {
        Ledger::<Located<FeatureId>>::locate(request)?
            .connect()
            .await?
            .migrate()
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
        let path = request.repository.ledger_path(&feature.id);
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
        let path = request.repository.ledger_path(&request.feature);
        if !path.is_file() {
            return Err(LedgerError::Uninitialized);
        }
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
    async fn migrate(mut self) -> Result<Ledger<SchemaReady<FeatureInput>>, LedgerError> {
        // Turso's transaction API borrows its connection mutably; the owner is consumed.
        LedgerSchema::migrate(&mut self.state.connection).await?;
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
        SqlStatement::build(
            Query::insert()
                .into_table(FeatureTable::Table)
                .columns([FeatureTable::Singleton, FeatureTable::Document])
                .values([1.into(), serde_json::to_string(&self.state.feature)?.into()])?
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
mod tests {
    use super::{InitializeLedger, Ledger, OpenLedger};
    use crate::LedgerError;
    use crate::git::Repository;
    use crate::request::InitFeature;
    use crate::store::schema::FeatureTable;
    use crate::store::sql::SqlStatement;
    use crate::values::{BranchNameParse, FeatureIdParse, Note};
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
        let repository = Repository::discover(directory.path())?;
        let feature = match FeatureIdParse::from("feature".to_owned()) {
            FeatureIdParse::Parsed(feature) => feature,
            FeatureIdParse::Invalid(error) => return Err(error.into()),
        };
        let branch = match BranchNameParse::from("codex/feature".to_owned()) {
            BranchNameParse::Parsed(branch) => branch,
            BranchNameParse::Invalid(error) => return Err(error.into()),
        };
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
                .experimental_multiprocess_wal(true)
                .build()
                .await?;
                let connection = database.connect()?;
                let mut mismatched = info.feature;
                mismatched.id = match FeatureIdParse::from("another-feature".to_owned()) {
                    FeatureIdParse::Parsed(feature) => feature,
                    FeatureIdParse::Invalid(error) => return Err(error.into()),
                };
                SqlStatement::build(
                    Query::update()
                        .table(FeatureTable::Table)
                        .value(FeatureTable::Document, serde_json::to_string(&mismatched)?)
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                assert!(matches!(
                    Ledger::open(OpenLedger {
                        repository: repository.clone(),
                        feature: feature.clone()
                    })
                    .await,
                    Err(LedgerError::Invalid(
                        "feature document does not match ledger location"
                    ))
                ));
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
