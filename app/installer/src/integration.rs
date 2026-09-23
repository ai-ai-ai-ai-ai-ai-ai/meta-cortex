use thiserror::Error;
mod document;
mod instructions;
mod markdown;
mod selection;

pub use instructions::InstructionStatus;
pub use selection::IntegrationOptions;
pub use selection::{HarnessChoice, InstructionAction};

use derive_more::Display;
use document::{CursorApplication, CursorHeader};
use instructions::PreparedInstructions;
use markdown::MarkdownInstructions;
use pulldown_cmark_to_cmark::Error as MarkdownError;
use serde::Serialize;
use serde_saphyr::SerializeError;
use std::fs;
use std::io;
use std::path::PathBuf;

#[derive(Debug, Error)]
pub enum InstructionError {
    #[error("could not serialize instruction metadata: {0}")]
    Yaml(#[from] SerializeError),
    #[error("could not render instructions: {0}")]
    Markdown(#[from] MarkdownError),
    #[error("instruction file operation failed: {0}")]
    Io(#[from] io::Error),
    #[error("refusing to overwrite differing content or a symbolic link: {0}")]
    Conflict(PathBuf),
    #[error(
        "instruction file has an altered or incomplete Meta-Cortex block, invalid UTF-8, or unsupported Cursor frontmatter: {0}"
    )]
    InvalidEntry(PathBuf),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize)]
pub enum Harness {
    Codex,
    Claude,
    Cursor,
}

impl Harness {
    pub const ALL: [Self; 3] = [Self::Codex, Self::Claude, Self::Cursor];

    fn candidates(self) -> &'static [&'static str] {
        match self {
            Self::Codex => &["AGENTS.override.md", "AGENTS.md"],
            Self::Claude => &["CLAUDE.md", ".claude/CLAUDE.md"],
            Self::Cursor => &[".cursor/rules/meta-cortex.mdc", ".cursorrules", "AGENTS.md"],
        }
    }

    fn default_file(self) -> &'static str {
        match self {
            Self::Codex => "AGENTS.md",
            Self::Claude => "CLAUDE.md",
            Self::Cursor => ".cursor/rules/meta-cortex.mdc",
        }
    }
}

#[derive(Clone)]
pub struct InstructionTarget {
    root: PathBuf,
    relative: PathBuf,
}

impl InstructionTarget {
    pub fn path(&self) -> PathBuf {
        self.root.join(&self.relative)
    }

    fn check_parents(&self) -> Result<(), InstructionError> {
        let mut ancestor = self.root.clone();
        let parent = self
            .relative
            .parent()
            .ok_or_else(|| InstructionError::Conflict(self.path()))?;
        for component in parent.components() {
            ancestor.push(component);
            match fs::symlink_metadata(&ancestor) {
                Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
                Ok(_) => return Err(InstructionError::Conflict(ancestor)),
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.into()),
            }
        }
        Ok(())
    }

    fn create_parents(&self) -> Result<(), InstructionError> {
        self.check_parents()?;
        let path = self.path();
        let parent = path
            .parent()
            .ok_or_else(|| InstructionError::Conflict(path.clone()))?;
        fs::create_dir_all(parent)?;
        self.check_parents()
    }

    fn initial_contents(&self) -> Result<String, InstructionError> {
        match self
            .relative
            .extension()
            .and_then(|extension| extension.to_str())
        {
            Some("mdc") => CursorHeader {
                always_apply: CursorApplication::Always,
            }
            .render(),
            Some(_) | None => Ok(String::default()),
        }
    }

    fn validate_format(&self, text: &str) -> Result<(), InstructionError> {
        if self
            .relative
            .extension()
            .is_some_and(|extension| extension == "mdc")
        {
            MarkdownInstructions { text, target: self }.validate_cursor()?;
        }
        Ok(())
    }
}

pub struct ProjectHarnesses {
    pub root: PathBuf,
}

impl ProjectHarnesses {
    pub fn target(&self, harness: Harness) -> Result<InstructionTarget, InstructionError> {
        for candidate in harness.candidates() {
            let target = InstructionTarget {
                root: self.root.clone(),
                relative: PathBuf::from(candidate),
            };
            // Never follow a symlink even while discovering a nested instruction file.
            if target.check_parents().is_err() {
                return Ok(target);
            }
            match fs::symlink_metadata(target.path()) {
                // Empty overrides do not supersede Codex's AGENTS.md.
                Ok(metadata) if *candidate == "AGENTS.override.md" && metadata.len() == 0 => {}
                Ok(_) => return Ok(target),
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.into()),
            }
        }
        Ok(InstructionTarget {
            root: self.root.clone(),
            relative: PathBuf::from(harness.default_file()),
        })
    }

    pub fn inspect(&self) -> Result<Vec<HarnessInfo>, InstructionError> {
        Harness::ALL
            .into_iter()
            .map(|harness| {
                let target = self.target(harness)?;
                let status = match PreparedInstructions::read(target.clone()) {
                    Ok(instructions) => instructions.status(),
                    Err(InstructionError::Conflict(_) | InstructionError::InvalidEntry(_)) => {
                        InstructionStatus::Conflict
                    }
                    Err(error) => return Err(error),
                };
                Ok(HarnessInfo {
                    harness,
                    path: target.path(),
                    status,
                })
            })
            .collect()
    }
}

#[derive(Serialize)]
pub struct HarnessInfo {
    pub harness: Harness,
    pub path: PathBuf,
    pub status: InstructionStatus,
}

pub enum IntegrationPlan {
    Skip,
    Write(PreparedInstructions),
}

impl IntegrationPlan {
    pub fn apply(self) -> Result<(), InstructionError> {
        match self {
            Self::Skip => Ok(()),
            Self::Write(instructions) => instructions.write(),
        }
    }
}

#[cfg(test)]
mod tests;
