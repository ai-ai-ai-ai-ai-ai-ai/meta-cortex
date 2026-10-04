use crate::LedgerError;
use crate::values::WorkerId;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Recorded host worker identity; legacy snapshots never invent one from a role.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum WorkerIdentity {
    Unrecorded,
    Recorded { worker_id: WorkerId },
}

impl WorkerIdentity {
    pub(super) fn require(self, expected: WorkerId) -> Result<(), LedgerError> {
        match self {
            Self::Recorded { worker_id } if worker_id != expected => {
                Err(LedgerError::AssignmentChanged)
            }
            Self::Recorded { .. } | Self::Unrecorded => Ok(()),
        }
    }
}
