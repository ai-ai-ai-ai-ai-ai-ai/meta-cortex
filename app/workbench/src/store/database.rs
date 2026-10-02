use crate::LedgerError;
use std::path::Path;
use turso::{Builder, IoBackend};

/// A persistent ledger file with cross-process WAL coordination.
pub(super) struct LedgerDatabase<'a> {
    pub path: &'a Path,
}

impl LedgerDatabase<'_> {
    pub(super) fn builder(&self) -> Result<Builder, LedgerError> {
        let path = self
            .path
            .to_str()
            .ok_or(LedgerError::Invalid("ledger path must be UTF-8"))?;
        // Turso's default Windows IO does not support shared WAL coordination.
        #[cfg(windows)]
        let io = IoBackend::IOCP;
        #[cfg(not(windows))]
        let io = IoBackend::Default;
        Ok(Builder::new_local(path)
            .with_io(io)
            .experimental_multiprocess_wal(true))
    }
}
