use crate::configuration::Configuration;
use derive_more::{Display, From};
use std::fmt;
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

#[derive(Debug, PartialEq, Eq, From, Display)]
pub struct Version(String);

impl Version {
    pub const CURRENT: &str = env!("CARGO_PKG_VERSION");
}

#[derive(Debug, PartialEq, Eq, Display)]
pub enum FrameworkVersion {
    #[display("{_0}")]
    Recorded(Version),
    #[display("unknown (installed by an older CLI)")]
    Legacy,
}

impl FrameworkVersion {
    pub const FILE: &str = ".version";

    pub fn read(directory: &Path) -> Result<Self, VersionError> {
        let path = directory.join(Self::FILE);
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                let text = fs::read_to_string(&path)?;
                if text.trim().is_empty() || text.trim().contains(char::is_whitespace) {
                    return Err(VersionError::InvalidFile(path));
                }
                Ok(Self::Recorded(Version::from(text.trim().to_owned())))
            }
            Ok(_) => Err(VersionError::InvalidFile(path)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Self::Legacy),
            Err(error) => Err(error.into()),
        }
    }
}

#[derive(Display)]
pub enum EntryPoint {
    #[display("connected through AGENTS.md")]
    Connected,
    #[display("missing Meta-Cortex instructions in AGENTS.md; run meta-cortex init")]
    Missing,
}

pub struct ProjectInfo {
    pub root: PathBuf,
    pub version: FrameworkVersion,
    pub configuration: Configuration,
    pub entry_point: EntryPoint,
}

impl fmt::Display for ProjectInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let config = &self.configuration;
        writeln!(
            f,
            "Meta-Cortex — development platform for teams of AI agents"
        )?;
        writeln!(f, "CLI version: {}", Version::CURRENT)?;
        writeln!(f, "Framework version: {}", self.version)?;
        writeln!(f, "Project: {}", self.root.display())?;
        writeln!(f, "Framework: {}", self.root.join(".meta-cortex").display())?;
        writeln!(
            f,
            "Configuration: {}",
            self.root.join(".meta-cortex/meta-cortex.toml").display()
        )?;
        writeln!(f, "Integration: {}", self.entry_point)?;
        writeln!(f, "\nConfigured models:")?;
        writeln!(
            f,
            "  Gizmo Prime: {} / {}",
            config.gizmo_prime.model, config.gizmo_prime.reasoning_effort
        )?;
        writeln!(
            f,
            "  Team Gizmo: {} / {}",
            config.team.gizmo.model, config.team.gizmo.reasoning_effort
        )?;
        writeln!(
            f,
            "  Team agents: {} / {}",
            config.team.agent.model, config.team.agent.reasoning_effort
        )?;
        write!(
            f,
            "\nThese are project settings; model availability is determined by your AI host."
        )
    }
}
