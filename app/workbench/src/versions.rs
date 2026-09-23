use derive_more::Display;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "ProtocolVersionParse", into = "i64")]
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

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "i64")]
pub enum ProtocolVersionParse {
    Parsed(ProtocolVersion),
    Invalid(VersionParseError),
}

impl From<i64> for ProtocolVersionParse {
    fn from(version: i64) -> Self {
        match version {
            1 => Self::Parsed(ProtocolVersion::V1),
            _ => Self::Invalid(VersionParseError::Unsupported {
                schema: VersionFamily::Command,
                version: VersionNumber::from(version),
            }),
        }
    }
}

// Serde adapter only; callers inspect ProtocolVersionParse.
impl TryFrom<ProtocolVersionParse> for ProtocolVersion {
    type Error = VersionParseError;
    fn try_from(parsed: ProtocolVersionParse) -> Result<Self, Self::Error> {
        match parsed {
            ProtocolVersionParse::Parsed(version) => Ok(version),
            ProtocolVersionParse::Invalid(error) => Err(error),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "RecordVersionParse", into = "i64")]
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

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "i64")]
pub enum RecordVersionParse {
    Parsed(RecordVersion),
    Invalid(VersionParseError),
}

impl From<i64> for RecordVersionParse {
    fn from(version: i64) -> Self {
        match version {
            1 => Self::Parsed(RecordVersion::V1),
            _ => Self::Invalid(VersionParseError::Unsupported {
                schema: VersionFamily::Record,
                version: VersionNumber::from(version),
            }),
        }
    }
}

// Serde adapter only; callers inspect RecordVersionParse.
impl TryFrom<RecordVersionParse> for RecordVersion {
    type Error = VersionParseError;
    fn try_from(parsed: RecordVersionParse) -> Result<Self, Self::Error> {
        match parsed {
            RecordVersionParse::Parsed(version) => Ok(version),
            RecordVersionParse::Invalid(error) => Err(error),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize)]
#[serde(try_from = "StorageVersionParse", into = "i64")]
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

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "i64")]
pub enum StorageVersionParse {
    Parsed(StorageVersion),
    Invalid(VersionParseError),
}

impl From<i64> for StorageVersionParse {
    fn from(version: i64) -> Self {
        match version {
            0 => Self::Parsed(StorageVersion::Empty),
            1 => Self::Parsed(StorageVersion::DocumentsV1),
            2 => Self::Parsed(StorageVersion::IndexedV2),
            _ => Self::Invalid(VersionParseError::Unsupported {
                schema: VersionFamily::Database,
                version: VersionNumber::from(version),
            }),
        }
    }
}

// Serde adapter only; callers inspect StorageVersionParse.
impl TryFrom<StorageVersionParse> for StorageVersion {
    type Error = VersionParseError;
    fn try_from(parsed: StorageVersionParse) -> Result<Self, Self::Error> {
        match parsed {
            StorageVersionParse::Parsed(version) => Ok(version),
            StorageVersionParse::Invalid(error) => Err(error),
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
