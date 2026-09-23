use thiserror::Error;
mod bundle;

use crate::configuration::{ConfigError, ConfigText, Configuration};
use crate::information::{ProjectInfo, Version, VersionError};
use crate::integration::{InstructionError, IntegrationOptions, ProjectHarnesses};
use bundle::Bundle;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("filesystem operation failed: {0}")]
    Io(#[from] io::Error),
    #[error(
        "missing required framework entry: {path}; the installed .meta-cortex directory is incomplete or from a different framework version. To replace it, back up and move the existing .meta-cortex directory out of the installation path, run Framework / Initialize through meta-cortex run again, then review and reapply your configuration changes"
    )]
    MissingFrameworkEntry {
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error(transparent)]
    Configuration(#[from] ConfigError),
    #[error(transparent)]
    Version(#[from] VersionError),
    #[error(
        "Meta-Cortex is not initialized in {0}; run Framework / Initialize through meta-cortex run"
    )]
    NotInitialized(PathBuf),
    #[error("expected an existing project directory: {0}")]
    InvalidProject(PathBuf),
    #[error("refusing to overwrite differing content or a symbolic link: {0}")]
    Conflict(PathBuf),
    #[error(transparent)]
    Instructions(#[from] InstructionError),
}

pub struct Project {
    root: PathBuf,
}

pub struct Installation {
    project: Project,
    bundle: BundleState,
}

pub struct InstalledProject {
    root: PathBuf,
}

impl InstalledProject {
    pub fn path(&self) -> &Path {
        &self.root
    }
}

enum BundleState {
    Absent,
    Identical,
}

impl Project {
    pub fn open(path: PathBuf) -> Result<Self, InstallError> {
        if !path.is_dir() {
            return Err(InstallError::InvalidProject(path));
        }
        Ok(Self {
            root: path.canonicalize()?,
        })
    }

    pub fn info(self) -> Result<ProjectInfo, InstallError> {
        let destination = self.root.join(".meta-cortex");
        match fs::symlink_metadata(&destination) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
            Ok(_) => return Err(InstallError::Conflict(destination)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Err(InstallError::NotInitialized(self.root));
            }
            Err(error) => return Err(error.into()),
        }
        let path = destination.join("meta-cortex.toml");
        let metadata = fs::symlink_metadata(&path)?;
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err(InstallError::Conflict(path));
        }
        let configuration = ConfigText::from(fs::read_to_string(path)?).parse()?;
        let integrations = ProjectHarnesses {
            root: self.root.clone(),
        }
        .inspect()?;
        Ok(ProjectInfo {
            root: self.root,
            version: Version::read(&destination)?,
            configuration,
            integrations,
        })
    }

    pub fn prepare(self) -> Result<Installation, InstallError> {
        let destination = self.root.join(".meta-cortex");
        let bundle = match fs::symlink_metadata(&destination) {
            Ok(_) => {
                Bundle {
                    directory: &Bundle::FRAMEWORK,
                    destination: destination.clone(),
                }
                .verify()?;
                BundleState::Identical
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => BundleState::Absent,
            Err(error) => return Err(error.into()),
        };
        Ok(Installation {
            project: self,
            bundle,
        })
    }
}

pub struct InitRequest {
    pub integration: IntegrationOptions,
}

impl Installation {
    pub fn install(self, request: InitRequest) -> Result<InstalledProject, InstallError> {
        let destination = self.project.root.join(".meta-cortex");
        let integration = request.integration.plan(ProjectHarnesses {
            root: self.project.root.clone(),
        })?;
        match self.bundle {
            BundleState::Absent => {
                let configuration = ConfigText::try_from(Configuration::bundled()?)?;
                Bundle {
                    directory: &Bundle::FRAMEWORK,
                    destination,
                }
                .install(configuration)?;
            }
            BundleState::Identical => {
                Bundle {
                    directory: &Bundle::FRAMEWORK,
                    destination,
                }
                .verify()?;
            }
        }
        integration.apply()?;
        Ok(InstalledProject {
            root: self.project.root,
        })
    }
}

#[cfg(test)]
mod tests;
