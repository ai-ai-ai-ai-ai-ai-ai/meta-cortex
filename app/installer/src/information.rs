use crate::configuration::Configuration;
use crate::integration::HarnessInfo;
use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VersionError {
    #[error("could not read installed framework version: {0}")]
    Io(#[from] io::Error),
    #[error("invalid installed framework version file: {0}")]
    InvalidFile(PathBuf),
    #[error("invalid installed framework version text in {path}: {reason}")]
    InvalidText {
        path: PathBuf,
        #[source]
        reason: VersionTextError,
    },
}

// Installed metadata and report schema 5 retain Cargo's semantic-version text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(into = "&'static str")]
pub enum Version {
    V0_6_2,
    V0_7_0,
    V0_8_0,
    V0_8_1,
    V0_9_0,
    V0_9_1,
    V0_9_2,
}

#[derive(Debug, PartialEq, Eq, Error)]
pub enum VersionTextError {
    #[error("version text must not be empty")]
    Empty,
    #[error("version text must not contain internal whitespace")]
    Whitespace,
    #[error("framework release is not supported by this executable")]
    Unsupported,
}

impl TryFrom<String> for Version {
    type Error = VersionTextError;

    fn try_from(text: String) -> Result<Self, Self::Error> {
        let text = text.trim();
        if text.is_empty() {
            return Err(VersionTextError::Empty);
        }
        if text.contains(char::is_whitespace) {
            return Err(VersionTextError::Whitespace);
        }
        Self::release(text)
    }
}

impl Version {
    const fn release(text: &str) -> Result<Self, VersionTextError> {
        match text.as_bytes() {
            b"0.6.2" => Ok(Version::V0_6_2),
            b"0.7.0" => Ok(Version::V0_7_0),
            b"0.8.0" => Ok(Version::V0_8_0),
            b"0.8.1" => Ok(Version::V0_8_1),
            b"0.9.0" => Ok(Version::V0_9_0),
            b"0.9.1" => Ok(Version::V0_9_1),
            b"0.9.2" => Ok(Version::V0_9_2),
            _ => Err(VersionTextError::Unsupported),
        }
    }
}

impl From<Version> for &'static str {
    fn from(version: Version) -> Self {
        version.as_str()
    }
}

impl Version {
    pub const CURRENT: Self = match Self::release(env!("CARGO_PKG_VERSION")) {
        Ok(version) => version,
        Err(_) => {
            panic!("declare the Cargo package release in Version and its wire mappings")
        }
    };
    pub const FILE: &str = ".version";

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::V0_6_2 => "0.6.2",
            Self::V0_7_0 => "0.7.0",
            Self::V0_8_0 => "0.8.0",
            Self::V0_8_1 => "0.8.1",
            Self::V0_9_0 => "0.9.0",
            Self::V0_9_1 => "0.9.1",
            Self::V0_9_2 => "0.9.2",
        }
    }

    pub fn read(directory: &Path) -> Result<Self, VersionError> {
        let path = directory.join(Self::FILE);
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                let text = fs::read_to_string(&path)?;
                Self::try_from(text).map_err(|reason| VersionError::InvalidText { path, reason })
            }
            Ok(_) => Err(VersionError::InvalidFile(path)),
            Err(error) => Err(error.into()),
        }
    }
}

// Evaluate even when a build does not otherwise use the current release.
const _: Version = Version::CURRENT;

pub struct ProjectInfo {
    pub root: PathBuf,
    pub version: Version,
    pub configuration: Configuration,
    pub integrations: Vec<HarnessInfo>,
}

#[derive(Clone, Serialize)]
#[serde(into = "u32")]
enum InfoSchemaVersion {
    V5,
}

impl InfoSchemaVersion {
    const CURRENT: Self = Self::V5;
}

impl From<InfoSchemaVersion> for u32 {
    fn from(version: InfoSchemaVersion) -> Self {
        match version {
            InfoSchemaVersion::V5 => 5,
        }
    }
}

#[derive(Serialize)]
struct InfoPaths {
    project: PathBuf,
    framework: PathBuf,
    configuration: PathBuf,
}

#[derive(Serialize)]
enum ModelAvailability {
    NotChecked,
}

#[derive(Serialize)]
pub struct InfoReport {
    schema_version: InfoSchemaVersion,
    cli_version: Version,
    framework_version: Version,
    paths: InfoPaths,
    integrations: Vec<HarnessInfo>,
    models: Configuration,
    model_availability: ModelAvailability,
}

impl From<ProjectInfo> for InfoReport {
    fn from(info: ProjectInfo) -> Self {
        let paths = InfoPaths {
            framework: info.root.join(".meta-cortex"),
            configuration: info.root.join(".meta-cortex/meta-cortex.toml"),
            project: info.root,
        };
        Self {
            schema_version: InfoSchemaVersion::CURRENT,
            cli_version: Version::CURRENT,
            framework_version: info.version,
            paths,
            integrations: info.integrations,
            models: info.configuration,
            model_availability: ModelAvailability::NotChecked,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::{Version, VersionTextError};

    #[test]
    fn current_version_matches_cargo_package_version() {
        // Cargo resolves package.version, including workspace inheritance.
        assert_eq!(Version::CURRENT.as_str(), env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn installed_version_returns_typed_errors_and_preserves_wire_format() -> serde_json::Result<()>
    {
        for text in ["", " ", "\n\t"] {
            assert_eq!(
                Version::try_from(text.to_owned()),
                Err(VersionTextError::Empty)
            );
        }
        for text in ["1 2", "1\n2"] {
            assert_eq!(
                Version::try_from(text.to_owned()),
                Err(VersionTextError::Whitespace)
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
                Version::try_from(text.to_owned()),
                Err(VersionTextError::Unsupported)
            );
        }
        assert_eq!(Version::CURRENT, Version::V0_9_2);
        for version in [
            Version::V0_6_2,
            Version::V0_7_0,
            Version::V0_8_0,
            Version::V0_8_1,
            Version::V0_9_0,
            Version::V0_9_1,
            Version::V0_9_2,
        ] {
            let text = version.as_str().to_owned();
            assert_eq!(Version::try_from(text.clone()), Ok(version));
            assert_eq!(Version::try_from(format!("{text}\n")), Ok(version));
            assert_eq!(
                serde_json::to_string(&version)?,
                serde_json::to_string(&text)?
            );
        }
        Ok(())
    }
}
