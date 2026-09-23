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

// Installed metadata and report schema 3 retain Cargo's semantic-version text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(into = "&'static str")]
pub enum Version {
    V0_6_2,
}

#[derive(Debug, PartialEq, Eq)]
pub enum VersionParse {
    Parsed(Version),
    Invalid(VersionTextError),
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

impl From<String> for VersionParse {
    fn from(text: String) -> Self {
        let text = text.trim();
        if text.is_empty() {
            return Self::Invalid(VersionTextError::Empty);
        }
        if text.contains(char::is_whitespace) {
            return Self::Invalid(VersionTextError::Whitespace);
        }
        Self::release(text)
    }
}

impl VersionParse {
    const fn release(text: &str) -> Self {
        match text.as_bytes() {
            b"0.6.2" => Self::Parsed(Version::V0_6_2),
            _ => Self::Invalid(VersionTextError::Unsupported),
        }
    }
}

impl From<Version> for &'static str {
    fn from(version: Version) -> Self {
        version.as_str()
    }
}

impl Version {
    pub const CURRENT: Self = match VersionParse::release(env!("CARGO_PKG_VERSION")) {
        VersionParse::Parsed(version) => version,
        VersionParse::Invalid(_) => {
            panic!("declare the Cargo package release in Version and its wire mappings")
        }
    };
    pub const FILE: &str = ".version";

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::V0_6_2 => "0.6.2",
        }
    }

    pub fn read(directory: &Path) -> Result<Self, VersionError> {
        let path = directory.join(Self::FILE);
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                let text = fs::read_to_string(&path)?;
                match VersionParse::from(text) {
                    VersionParse::Parsed(version) => Ok(version),
                    VersionParse::Invalid(reason) => {
                        Err(VersionError::InvalidText { path, reason })
                    }
                }
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
    V3,
}

impl InfoSchemaVersion {
    const CURRENT: Self = Self::V3;
}

impl From<InfoSchemaVersion> for u32 {
    fn from(version: InfoSchemaVersion) -> Self {
        match version {
            InfoSchemaVersion::V3 => 3,
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
mod tests;
