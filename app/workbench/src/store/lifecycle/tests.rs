use super::{InitializeLedger, Ledger, OpenLedger};
use crate::LedgerError;
use crate::git::Repository;
use crate::request::InitFeature;
use crate::store::schema::FeatureTable;
use crate::store::sql::SqlStatement;
use crate::values::{BranchName, FeatureId, Note};
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
            .experimental_multiprocess_wal(true)
            .build()
            .await?;
            let connection = database.connect()?;
            let mut mismatched = info.feature;
            mismatched.id = FeatureId::try_from("another-feature".to_owned())?;
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
