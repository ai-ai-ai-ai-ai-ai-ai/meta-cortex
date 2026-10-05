//! Durable task coordination, Git checkpoints, and per-feature Turso storage.
//!
//! [`Workbench`] identifies a repository through Git and opens its user-owned ledgers.
//! Command-line transport and framework installation belong to the application.

pub mod agents;
mod data_directory;
mod git;
pub mod model;
mod repository_id;
pub mod request;
mod store;
pub mod values;
pub mod versions;

pub use data_directory::DataDirectory;
use git::Repository;
use request::InitFeature;
use sea_query::error;
use std::path::Path;
use std::{io, time::SystemTimeError};
pub use store::observation::{
    ActiveWork, Blocker, Completion, FeatureActivity, FeatureOutcome, FeatureSummary,
    FeatureWorkflow, FeedEntry, FlowCount, FlowState, HistoryPage, LatestDelivery, Observation,
    Page, PageEnd, PageIndex, PullRequest, RecordedRole, RecordedTimeline, RecordedWindow,
    RevisionLogEntry, SequenceProvenance, StateMeaning, TaskChapter, TaskCount, TaskPage,
    TimelineExtent, TimelineGroup, TimelineGroupIdentity, TimelineOrder, WorkflowCondition,
    WorkflowTiming, WorkflowTotals,
};
pub use store::{FeatureLoaded, Ledger, LedgerInfo};
use store::{InitializeLedger, OpenLedger};
use thiserror::Error;
use values::FeatureId;

/// A consuming repository shared by all of its linked Git worktrees.
pub struct Workbench {
    repository: Repository,
}

impl Workbench {
    #[must_use]
    pub fn with_data_directory(mut self, directory: DataDirectory) -> Self {
        self.repository = self.repository.with_data_directory(directory);
        self
    }

    pub fn discover(project: &Path) -> Result<Self, LedgerError> {
        Ok(Self {
            repository: Repository::discover(project)?,
        })
    }

    /// Create or reuse the main checkout's local identity and data directory.
    pub fn initialize_repository(&self) -> Result<(), LedgerError> {
        self.repository.initialize()
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

    /// Observe existing current-schema storage without initialization or migration.
    pub async fn observe(&self) -> Result<Observation, LedgerError> {
        Observation::open(self.repository.clone()).await
    }

    pub async fn features(&self) -> Result<Vec<LedgerInfo>, LedgerError> {
        match self.repository.observed_features().await {
            Err(LedgerError::Uninitialized) => Ok(Vec::new()),
            result => result,
        }
    }
}

#[derive(Debug, Error)]
pub enum LedgerError {
    #[error("feature {feature} (current database schema {current}): {source}")]
    FeatureStorage {
        feature: FeatureId,
        current: versions::StorageVersion,
        #[source]
        source: Box<LedgerError>,
    },
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
    TaskRevision(#[from] values::RevisionParseError),
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
    #[error("role, worker, or attempt no longer matches this assignment")]
    AssignmentChanged,
    #[error("assignment expired; ask Gizmo to inspect and reassign it")]
    Expired,
    #[error("dependency is not ready or integrated")]
    DependencyPending,
    #[error("Git operation failed: {0}")]
    Git(#[from] git2::Error),
    #[error("ledger has not been initialized; run Feature / Initialize")]
    Uninitialized,
    #[error(
        "Workbench database version {0} requires migration; open the selected feature with the current meta-cortex before observing"
    )]
    ObservationMigrationRequired(versions::StorageVersion),
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

impl LedgerError {
    pub(crate) fn in_feature(self, feature: &FeatureId) -> Self {
        Self::FeatureStorage {
            feature: feature.clone(),
            current: versions::StorageVersion::CURRENT,
            source: Box::new(self),
        }
    }
}
