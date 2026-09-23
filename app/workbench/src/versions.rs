use derive_more::Display;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64", into = "i64")]
#[schemars(with = "i64")]
pub enum ProtocolVersion {
    V1,
}

impl ProtocolVersion {
    pub const CURRENT: Self = Self::V1;
}

impl From<ProtocolVersion> for i64 {
    fn from(version: ProtocolVersion) -> Self {
        match version {
            ProtocolVersion::V1 => 1,
        }
    }
}

impl TryFrom<i64> for ProtocolVersion {
    type Error = VersionParseError;

    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            1 => Ok(ProtocolVersion::V1),
            _ => Err(VersionParseError::Unsupported {
                schema: VersionFamily::Command,
                version: VersionNumber::from(version),
            }),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64", into = "i64")]
#[schemars(with = "i64")]
pub enum RecordVersion {
    V1,
}

impl RecordVersion {
    pub const CURRENT: Self = Self::V1;
}

impl From<RecordVersion> for i64 {
    fn from(version: RecordVersion) -> Self {
        match version {
            RecordVersion::V1 => 1,
        }
    }
}

impl TryFrom<i64> for RecordVersion {
    type Error = VersionParseError;

    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            1 => Ok(RecordVersion::V1),
            _ => Err(VersionParseError::Unsupported {
                schema: VersionFamily::Record,
                version: VersionNumber::from(version),
            }),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize)]
#[serde(try_from = "i64", into = "i64")]
pub enum StorageVersion {
    #[display("0")]
    Empty,
    #[display("1")]
    DocumentsV1,
    #[display("2")]
    IndexedV2,
}

impl StorageVersion {
    pub const CURRENT: Self = Self::IndexedV2;
}

impl TryFrom<i64> for StorageVersion {
    type Error = VersionParseError;

    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            0 => Ok(StorageVersion::Empty),
            1 => Ok(StorageVersion::DocumentsV1),
            2 => Ok(StorageVersion::IndexedV2),
            _ => Err(VersionParseError::Unsupported {
                schema: VersionFamily::Database,
                version: VersionNumber::from(version),
            }),
        }
    }
}

impl From<StorageVersion> for i64 {
    fn from(version: StorageVersion) -> Self {
        match version {
            StorageVersion::Empty => 0,
            StorageVersion::DocumentsV1 => 1,
            StorageVersion::IndexedV2 => 2,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display)]
pub enum VersionFamily {
    #[display("command")]
    Command,
    #[display("record")]
    Record,
    #[display("database")]
    Database,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, derive_more::From)]
pub struct VersionNumber(i64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum VersionParseError {
    #[error("unsupported {schema} version {version}; upgrade meta-cortex")]
    Unsupported {
        schema: VersionFamily,
        version: VersionNumber,
    },
}

#[cfg(test)]
mod tests;
