use crate::configuration::Configuration;
use crate::integration::HarnessInfo;
use derive_more::{Display, From};
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
}

#[derive(Debug, PartialEq, Eq, From, Display, Serialize)]
pub struct Version(String);

impl Version {
    pub const CURRENT: &str = env!("CARGO_PKG_VERSION");
    pub const FILE: &str = ".version";

    pub fn read(directory: &Path) -> Result<Self, VersionError> {
        let path = directory.join(Self::FILE);
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                let text = fs::read_to_string(&path)?;
                if text.trim().is_empty() || text.trim().contains(char::is_whitespace) {
                    return Err(VersionError::InvalidFile(path));
                }
                Ok(Self::from(text.trim().to_owned()))
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
            cli_version: Version::from(Version::CURRENT.to_owned()),
            framework_version: info.version,
            paths,
            integrations: info.integrations,
            models: info.configuration,
            model_availability: ModelAvailability::NotChecked,
        }
    }
}
