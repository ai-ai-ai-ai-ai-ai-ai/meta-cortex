use super::{Version, VersionParse, VersionTextError};

#[test]
fn current_version_matches_cargo_package_version() {
    // Cargo resolves package.version, including workspace inheritance.
    assert_eq!(Version::CURRENT.as_str(), env!("CARGO_PKG_VERSION"));
}

#[test]
fn installed_version_classifies_text_and_preserves_wire_format() -> serde_json::Result<()> {
    for text in ["", " ", "\n\t"] {
        assert_eq!(
            VersionParse::from(text.to_owned()),
            VersionParse::Invalid(VersionTextError::Empty)
        );
    }
    for text in ["1 2", "1\n2"] {
        assert_eq!(
            VersionParse::from(text.to_owned()),
            VersionParse::Invalid(VersionTextError::Whitespace)
        );
    }
    for text in [
        "arbitrary",
        "0.0.1",
        "0.6.3",
        "9.9.9",
        "0.6.2-beta.1",
        "v0.6.2",
    ] {
        assert_eq!(
            VersionParse::from(text.to_owned()),
            VersionParse::Invalid(VersionTextError::Unsupported)
        );
    }
    assert_eq!(Version::CURRENT, Version::V0_6_2);
    let text = Version::V0_6_2.as_str().to_owned();
    assert_eq!(
        VersionParse::from(text.clone()),
        VersionParse::Parsed(Version::CURRENT)
    );
    assert_eq!(
        VersionParse::from(format!("{text}\n")),
        VersionParse::Parsed(Version::CURRENT)
    );
    assert_eq!(
        serde_json::to_string(&Version::CURRENT)?,
        serde_json::to_string(&text)?
    );
    Ok(())
}
