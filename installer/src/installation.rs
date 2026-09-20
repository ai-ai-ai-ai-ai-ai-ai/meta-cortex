use include_dir::{Dir, include_dir};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;
use thiserror::Error;

static FRAMEWORK: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../cortex");
const LICENSE: &[u8] = include_bytes!("../../LICENSE");
const ENTRY: &str = "<!-- meta-cortex:start -->\nRead and follow [.meta-cortex/AGENTS.md](.meta-cortex/AGENTS.md).\n<!-- meta-cortex:end -->";

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("filesystem operation failed: {0}")]
    Io(#[from] io::Error),
    #[error("expected an existing project directory: {0}")]
    InvalidProject(PathBuf),
    #[error("refusing to overwrite differing content or a symbolic link: {0}")]
    Conflict(PathBuf),
    #[error("AGENTS.md has an altered or incomplete Meta-Cortex block: {0}")]
    InvalidEntry(PathBuf),
}

pub struct Project {
    root: PathBuf,
}

pub struct Installation {
    project: Project,
    instructions: Instructions,
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

struct Bundle<'a> {
    directory: &'a Dir<'a>,
    destination: PathBuf,
}

impl Bundle<'_> {
    fn verify(&self) -> Result<(), InstallError> {
        let metadata = fs::symlink_metadata(&self.destination)?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err(InstallError::Conflict(self.destination.clone()));
        }
        for entry in self.directory.entries() {
            let path = self.destination.join(
                entry
                    .path()
                    .file_name()
                    .ok_or_else(|| InstallError::Conflict(self.destination.clone()))?,
            );
            match entry {
                include_dir::DirEntry::Dir(directory) => Bundle {
                    directory,
                    destination: path,
                }
                .verify()?,
                include_dir::DirEntry::File(file) => {
                    let metadata = fs::symlink_metadata(&path)?;
                    if !metadata.is_file()
                        || metadata.file_type().is_symlink()
                        || fs::read(&path)? != file.contents()
                    {
                        return Err(InstallError::Conflict(path));
                    }
                }
            }
        }
        let expected = self.directory.entries().len()
            + usize::from(self.directory.path().as_os_str().is_empty());
        if fs::read_dir(&self.destination)?.count() != expected {
            return Err(InstallError::Conflict(self.destination.clone()));
        }
        Ok(())
    }
}

struct Instructions {
    path: PathBuf,
    original: Option<Vec<u8>>,
    contents: String,
}

impl Instructions {
    fn read(path: PathBuf) -> Result<Self, InstallError> {
        let original = match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                Some(fs::read(&path)?)
            }
            Ok(_) => return Err(InstallError::Conflict(path)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => None,
            Err(error) => return Err(error.into()),
        };
        let text = String::from_utf8(original.clone().unwrap_or_default())
            .map_err(|_| InstallError::InvalidEntry(path.clone()))?;
        let starts = text.matches("<!-- meta-cortex:start -->").count();
        let ends = text.matches("<!-- meta-cortex:end -->").count();
        let contents = match (starts, ends) {
            (0, 0) => format!(
                "{text}{}{ENTRY}\n",
                if text.is_empty() { "" } else { "\n\n" }
            ),
            (1, 1) if text.contains(ENTRY) => text,
            _ => return Err(InstallError::InvalidEntry(path)),
        };
        Ok(Self {
            path,
            original,
            contents,
        })
    }

    fn write(self) -> Result<(), InstallError> {
        let current = Self::read(self.path.clone())?;
        if current.original != self.original {
            return Err(InstallError::Conflict(self.path));
        }
        if self.original.as_deref() == Some(self.contents.as_bytes()) {
            return Ok(());
        }
        let parent = self
            .path
            .parent()
            .ok_or_else(|| InstallError::Conflict(self.path.clone()))?;
        let mut staged = NamedTempFile::new_in(parent)?;
        staged.write_all(self.contents.as_bytes())?;
        if self.original.is_some() {
            staged
                .as_file()
                .set_permissions(fs::metadata(&self.path)?.permissions())?;
            staged.persist(&self.path).map_err(|error| error.error)?;
        } else {
            staged
                .persist_noclobber(&self.path)
                .map_err(|error| error.error)?;
        }
        Ok(())
    }
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

    pub fn prepare(self) -> Result<Installation, InstallError> {
        let destination = self.root.join(".meta-cortex");
        let bundle = match fs::symlink_metadata(&destination) {
            Ok(_) => {
                Bundle {
                    directory: &FRAMEWORK,
                    destination: destination.clone(),
                }
                .verify()?;
                let license = destination.join("LICENSE");
                if fs::symlink_metadata(&license)?.file_type().is_symlink()
                    || fs::read(&license)? != LICENSE
                {
                    return Err(InstallError::Conflict(license));
                }
                BundleState::Identical
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => BundleState::Absent,
            Err(error) => return Err(error.into()),
        };
        let instructions = Instructions::read(self.root.join("AGENTS.md"))?;
        Ok(Installation {
            project: self,
            instructions,
            bundle,
        })
    }
}

impl Installation {
    pub fn install(self) -> Result<InstalledProject, InstallError> {
        let destination = self.project.root.join(".meta-cortex");
        match self.bundle {
            BundleState::Absent => {
                // create_dir claims the destination without replacing an existing entry.
                fs::create_dir(&destination)?;
                FRAMEWORK.extract(&destination)?;
                fs::write(destination.join("LICENSE"), LICENSE)?;
            }
            BundleState::Identical => {
                Bundle {
                    directory: &FRAMEWORK,
                    destination,
                }
                .verify()?;
            }
        }
        self.instructions.write()?;
        Ok(InstalledProject {
            root: self.project.root,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{ENTRY, InstallError, Project};
    use std::fs;
    use std::os::unix::fs::symlink;
    use tempfile::{TempDir, tempdir};

    struct Fixture {
        directory: TempDir,
    }
    impl Fixture {
        fn create() -> Result<Self, InstallError> {
            Ok(Self {
                directory: tempdir()?,
            })
        }
        fn install(&self) -> Result<(), InstallError> {
            Project::open(self.directory.path().to_path_buf())?
                .prepare()?
                .install()?;
            Ok(())
        }
        fn preserves_and_repeats(self) -> Result<(), InstallError> {
            let agents = self.directory.path().join("AGENTS.md");
            fs::write(&agents, "# Project rules\n")?;
            self.install()?;
            let first = fs::read_to_string(&agents)?;
            assert!(first.starts_with("# Project rules\n"));
            assert!(first.contains(ENTRY));
            self.install()?;
            assert_eq!(first, fs::read_to_string(agents)?);
            Ok(())
        }
        fn rejects_modified_bundle(self) -> Result<(), InstallError> {
            self.install()?;
            let path = self.directory.path().join(".meta-cortex/AGENTS.md");
            fs::write(&path, "custom")?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            assert_eq!(fs::read_to_string(path)?, "custom");
            Ok(())
        }
        fn rejects_symlink(self) -> Result<(), InstallError> {
            let external = tempdir()?;
            symlink(external.path(), self.directory.path().join(".meta-cortex"))?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            assert!(!external.path().join("AGENTS.md").exists());
            Ok(())
        }
        fn rejects_invalid_entry(self) -> Result<(), InstallError> {
            fs::write(
                self.directory.path().join("AGENTS.md"),
                "<!-- meta-cortex:start -->",
            )?;
            assert!(matches!(self.install(), Err(InstallError::InvalidEntry(_))));
            assert!(!self.directory.path().join(".meta-cortex").exists());
            Ok(())
        }
    }
    #[test]
    fn preserves_project_and_is_idempotent() -> Result<(), InstallError> {
        Fixture::create()?.preserves_and_repeats()
    }
    #[test]
    fn rejects_modified_framework() -> Result<(), InstallError> {
        Fixture::create()?.rejects_modified_bundle()
    }
    #[test]
    fn rejects_symbolic_link() -> Result<(), InstallError> {
        Fixture::create()?.rejects_symlink()
    }
    #[test]
    fn validates_before_installation() -> Result<(), InstallError> {
        Fixture::create()?.rejects_invalid_entry()
    }
}
