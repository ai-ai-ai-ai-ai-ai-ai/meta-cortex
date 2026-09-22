use std::fs;
use std::io;
use std::path::PathBuf;

/// Build only distributable framework files, never local dependency installations.
pub struct FrameworkBundle {
    pub source: PathBuf,
    pub destination: PathBuf,
}

impl FrameworkBundle {
    pub fn stage(&self) -> io::Result<()> {
        if self.destination.exists() {
            fs::remove_dir_all(&self.destination)?;
        }
        self.copy_directory()
    }

    fn copy_directory(&self) -> io::Result<()> {
        fs::create_dir_all(&self.destination)?;
        for entry in fs::read_dir(&self.source)? {
            let entry = entry?;
            if entry.file_name() == "node_modules" {
                continue;
            }
            let kind = entry.file_type()?;
            let destination = self.destination.join(entry.file_name());
            if kind.is_symlink() {
                return Err(io::Error::other(format!(
                    "framework source contains a symbolic link: {}",
                    entry.path().display()
                )));
            }
            if kind.is_dir() {
                Self {
                    source: entry.path(),
                    destination,
                }
                .copy_directory()?;
            } else if kind.is_file() {
                fs::copy(entry.path(), destination)?;
            } else {
                return Err(io::Error::other("unsupported framework source entry"));
            }
        }
        Ok(())
    }
}
