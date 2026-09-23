//! Durable task coordination, Git checkpoints, and per-feature Turso storage.
//!
//! [`Workbench`] discovers a project's shared Git directory and opens its ledgers.
//! Command-line transport and framework installation belong to the application.

pub mod agents;
mod git;
pub mod model;
pub mod request;
mod store;
pub mod values;
pub mod versions;

use git::Repository;
use request::InitFeature;
use sea_query::error;
use std::path::Path;
use std::{io, time::SystemTimeError};
pub use store::{FeatureLoaded, Ledger, LedgerInfo};
use store::{InitializeLedger, OpenLedger};
use thiserror::Error;
use values::FeatureId;

/// A consuming repository shared by all of its linked Git worktrees.
pub struct Workbench {
    repository: Repository,
}

impl Workbench {
    pub fn discover(project: &Path) -> Result<Self, LedgerError> {
        Ok(Self {
            repository: Repository::discover(project)?,
        })
    }

    pub async fn initialize(&self, input: InitFeature) -> Result<Ledger, LedgerError> {
        Ledger::initialize(InitializeLedger {
            repository: self.repository.clone(),
            input,
        })
        .await
    }

    pub async fn open(&self, feature: FeatureId) -> Result<Ledger, LedgerError> {
        Ledger::open(OpenLedger {
            repository: self.repository.clone(),
            feature,
        })
        .await
    }

    pub async fn features(&self) -> Result<Vec<LedgerInfo>, LedgerError> {
        let mut ledgers = Vec::new();
        for feature in self.repository.features()? {
            ledgers.push(self.open(feature).await?.info());
        }
        Ok(ledgers)
    }
}

#[derive(Debug, Error)]
pub enum LedgerError {
    #[error("invalid ledger input: {0}")]
    Invalid(&'static str),
    #[error(transparent)]
    UnsupportedVersion(#[from] versions::VersionParseError),
    #[error(transparent)]
    Identifier(#[from] values::IdentifierParseError),
    #[error(transparent)]
    BranchName(#[from] values::BranchNameParseError),
    #[error(transparent)]
    CommitId(#[from] values::CommitIdParseError),
    #[error(transparent)]
    Revision(#[from] values::RevisionParseError),
    #[error(transparent)]
    Attempt(#[from] values::AttemptParseError),
    #[error(transparent)]
    Timestamp(#[from] values::TimestampParseError),
    #[error(transparent)]
    LeaseSeconds(#[from] values::LeaseSecondsParseError),
    #[error("revision conflict; read the task again before retrying")]
    Conflict,
    #[error("task or feature already exists")]
    AlreadyExists,
    #[error("task or feature was not found")]
    NotFound,
    #[error("operation is not valid in the current task state")]
    InvalidTransition,
    #[error("owner or attempt no longer matches this assignment")]
    AssignmentChanged,
    #[error("assignment expired; ask Gizmo to inspect and reassign it")]
    Expired,
    #[error("dependency is not ready or integrated")]
    DependencyPending,
    #[error("Git operation failed: {0}")]
    Git(#[from] git2::Error),
    #[error("ledger has not been initialized; run Feature / Initialize")]
    Uninitialized,
    #[error("file operation failed: {0}")]
    Io(#[from] io::Error),
    #[error("unsupported Workbench SQL binding type")]
    UnsupportedSqlBinding,
    #[error("SQL construction failed: {0}")]
    SqlBuild(#[from] error::Error),
    #[error("database operation failed: {0}")]
    Database(#[from] turso::Error),
    #[error("invalid stored document: {0}")]
    Json(#[from] serde_json::Error),
    #[error("clock is before the Unix epoch: {0}")]
    Clock(#[from] SystemTimeError),
}
