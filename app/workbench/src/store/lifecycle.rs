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
mod tests;
