use crate::configuration::Configuration;
use crate::integration::HarnessInfo;
use derive_more::Display;
use serde::Serialize;
use std::borrow::Cow;
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

#[derive(Debug, PartialEq, Eq, Display, Serialize)]
pub struct Version(Cow<'static, str>);

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
        Self::Parsed(Version(Cow::Owned(text.to_owned())))
    }
}

impl Version {
    pub const CURRENT: Self = Self(Cow::Borrowed(env!("CARGO_PKG_VERSION")));
    pub const FILE: &str = ".version";

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
mod tests {
    use super::{Version, VersionParse, VersionTextError};

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
        let text = Version::CURRENT.to_string();
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
}
