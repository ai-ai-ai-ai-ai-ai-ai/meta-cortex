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
    #[display("3")]
    RelationalV3,
}

impl StorageVersion {
    pub const CURRENT: Self = Self::RelationalV3;
}

impl TryFrom<i64> for StorageVersion {
    type Error = VersionParseError;

    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            0 => Ok(StorageVersion::Empty),
            1 => Ok(StorageVersion::DocumentsV1),
            2 => Ok(StorageVersion::IndexedV2),
            3 => Ok(StorageVersion::RelationalV3),
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
            StorageVersion::RelationalV3 => 3,
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
pub mod tests {
    use super::{
        ProtocolVersion, RecordVersion, StorageVersion, VersionFamily, VersionNumber,
        VersionParseError,
    };

    #[test]
    fn supported_versions_preserve_numeric_wire_identity() -> anyhow::Result<()> {
        let protocol = ProtocolVersion::V1;
        let encoded = serde_json::to_string(&protocol)?;
        assert_eq!(encoded, "1");
        assert_eq!(serde_json::from_str::<ProtocolVersion>(&encoded)?, protocol);

        let record = RecordVersion::V1;
        let encoded = serde_json::to_string(&record)?;
        assert_eq!(encoded, "1");
        assert_eq!(serde_json::from_str::<RecordVersion>(&encoded)?, record);

        for version in [
            StorageVersion::Empty,
            StorageVersion::DocumentsV1,
            StorageVersion::IndexedV2,
            StorageVersion::RelationalV3,
        ] {
            let encoded = serde_json::to_string(&version)?;
            assert_eq!(encoded, i64::from(version).to_string());
            assert_eq!(version.to_string(), encoded);
            assert_eq!(serde_json::from_str::<StorageVersion>(&encoded)?, version);
        }
        Ok(())
    }

    #[test]
    fn decoders_reject_unknown_or_non_numeric_versions() {
        for input in ["-1", "0", "2", "99", "1.5", "\"V1\""] {
            assert!(serde_json::from_str::<ProtocolVersion>(input).is_err());
            assert!(serde_json::from_str::<RecordVersion>(input).is_err());
        }
        for input in ["-1", "4", "99", "1.5", "\"IndexedV2\""] {
            assert!(serde_json::from_str::<StorageVersion>(input).is_err());
        }
    }

    #[test]
    fn unknown_versions_retain_family_and_original_number() {
        let unknown = 99;
        assert_eq!(
            ProtocolVersion::try_from(unknown),
            Err(VersionParseError::Unsupported {
                schema: VersionFamily::Command,
                version: VersionNumber::from(unknown),
            })
        );
        assert_eq!(
            RecordVersion::try_from(unknown),
            Err(VersionParseError::Unsupported {
                schema: VersionFamily::Record,
                version: VersionNumber::from(unknown),
            })
        );
        assert_eq!(
            StorageVersion::try_from(unknown),
            Err(VersionParseError::Unsupported {
                schema: VersionFamily::Database,
                version: VersionNumber::from(unknown),
            })
        );
        assert_eq!(ProtocolVersion::try_from(1), Ok(ProtocolVersion::V1));
        assert_eq!(RecordVersion::try_from(1), Ok(RecordVersion::V1));
        assert_eq!(StorageVersion::try_from(2), Ok(StorageVersion::IndexedV2));
    }
}
