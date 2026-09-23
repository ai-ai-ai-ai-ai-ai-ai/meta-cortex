use super::LedgerError;
use derive_more::Display;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64", into = "i64")]
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
    type Error = LedgerError;
    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            1 => Ok(Self::V1),
            _ => Err(LedgerError::UnsupportedVersion {
                schema: "command",
                version,
            }),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64", into = "i64")]
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
    type Error = LedgerError;
    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            1 => Ok(Self::V1),
            _ => Err(LedgerError::UnsupportedVersion {
                schema: "record",
                version,
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
    type Error = LedgerError;
    fn try_from(version: i64) -> Result<Self, Self::Error> {
        match version {
            0 => Ok(Self::Empty),
            1 => Ok(Self::DocumentsV1),
            2 => Ok(Self::IndexedV2),
            _ => Err(LedgerError::UnsupportedVersion {
                schema: "database",
                version,
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

#[cfg(test)]
mod tests {
    use super::{ProtocolVersion, RecordVersion, StorageVersion};

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
        for input in ["-1", "3", "99", "1.5", "\"IndexedV2\""] {
            assert!(serde_json::from_str::<StorageVersion>(input).is_err());
        }
    }
}
