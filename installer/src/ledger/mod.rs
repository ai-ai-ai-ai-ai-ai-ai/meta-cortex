pub mod git;
pub mod model;
pub mod request;
pub mod store;
pub mod values;
pub mod versions;

use std::{io, time::SystemTimeError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LedgerError {
    #[error("invalid ledger input: {0}")]
    Invalid(&'static str),
    #[error("unsupported {schema} version {version}; upgrade meta-cortex")]
    UnsupportedVersion { schema: &'static str, version: i64 },
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
    Git(String),
    #[error("ledger has not been initialized; run ledger.init")]
    Uninitialized,
    #[error("file operation failed: {0}")]
    Io(#[from] io::Error),
    #[error("database operation failed: {0}")]
    Database(#[from] turso::Error),
    #[error("invalid stored document: {0}")]
    Json(#[from] serde_json::Error),
    #[error("clock is before the Unix epoch: {0}")]
    Clock(#[from] SystemTimeError),
}
