use super::markdown::MarkdownInstructions;
use super::{InstructionError, InstructionTarget};
use std::fs;
use std::io::{self, Write};
use tempfile::NamedTempFile;

#[derive(PartialEq, Eq)]
enum OriginalInstructions {
    Missing,
    Existing(Vec<u8>),
}

pub struct PreparedInstructions {
    target: InstructionTarget,
    original: OriginalInstructions,
    contents: String,
}

impl PreparedInstructions {
    pub fn read(target: InstructionTarget) -> Result<Self, InstructionError> {
        target.check_parents()?;
        let path = target.path();
        let original = match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                OriginalInstructions::Existing(fs::read(&path)?)
            }
            Ok(_) => return Err(InstructionError::Conflict(path)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => OriginalInstructions::Missing,
            Err(error) => return Err(error.into()),
        };
        let text = match &original {
            OriginalInstructions::Existing(contents) => String::from_utf8(contents.clone())
                .map_err(|_| InstructionError::InvalidEntry(path.clone()))?,
            OriginalInstructions::Missing => target.initial_contents()?,
        };
        target.validate_format(&text)?;
        let contents = MarkdownInstructions {
            text: &text,
            target: &target,
        }
        .prepare()?;
        Ok(Self {
            target,
            original,
            contents,
        })
    }

    pub fn status(&self) -> InstructionStatus {
        match &self.original {
            OriginalInstructions::Existing(contents) if contents == self.contents.as_bytes() => {
                InstructionStatus::Connected
            }
            OriginalInstructions::Existing(_) | OriginalInstructions::Missing => {
                InstructionStatus::Missing
            }
        }
    }

    pub fn write(self) -> Result<(), InstructionError> {
        let current = Self::read(self.target.clone())?;
        let path = self.target.path();
        if current.original != self.original {
            return Err(InstructionError::Conflict(path));
        }
        if matches!(self.status(), InstructionStatus::Connected) {
            return Ok(());
        }
        self.target.create_parents()?;
        let parent = path
            .parent()
            .ok_or_else(|| InstructionError::Conflict(path.clone()))?;
        let mut staged = NamedTempFile::new_in(parent)?;
        staged.write_all(self.contents.as_bytes())?;
        match self.original {
            OriginalInstructions::Existing(_) => {
                staged
                    .as_file()
                    .set_permissions(fs::metadata(&path)?.permissions())?;
                staged.persist(&path).map_err(|error| error.error)?;
            }
            OriginalInstructions::Missing => {
                staged
                    .persist_noclobber(&path)
                    .map_err(|error| error.error)?;
            }
        }
        Ok(())
    }
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub enum InstructionStatus {
    Connected,
    Missing,
    Conflict,
}

#[cfg(test)]
mod tests;
