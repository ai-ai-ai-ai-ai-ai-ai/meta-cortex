use super::{
    ProtocolVersion, RecordVersion, StorageVersion, VersionFamily, VersionNumber, VersionParseError,
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
