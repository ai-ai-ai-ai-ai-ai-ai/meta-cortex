use super::LedgerError;
use derive_more::Display;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
pub struct ProtocolVersion(i64);

impl ProtocolVersion {
    pub const CURRENT: Self = Self(1);
}

impl TryFrom<i64> for ProtocolVersion {
    type Error = LedgerError;
    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            1 => Ok(Self::CURRENT),
            _ => Err(LedgerError::UnsupportedVersion {
                schema: "command",
                version,
            }),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
pub struct RecordVersion(i64);

impl RecordVersion {
    pub const CURRENT: Self = Self(1);
}

impl TryFrom<i64> for RecordVersion {
    type Error = LedgerError;
    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            1 => Ok(Self::CURRENT),
            _ => Err(LedgerError::UnsupportedVersion {
                schema: "record",
                version,
            }),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize)]
pub struct StorageVersion(i64);

impl StorageVersion {
    pub const EMPTY: Self = Self(0);
    pub const DOCUMENTS: Self = Self(1);
    pub const INDEXED: Self = Self(2);
    pub const CURRENT: Self = Self::INDEXED;
}

impl TryFrom<i64> for StorageVersion {
    type Error = LedgerError;
    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            0..=2 => Ok(Self(version)),
            _ => Err(LedgerError::UnsupportedVersion {
                schema: "database",
                version,
            }),
        }
    }
}
