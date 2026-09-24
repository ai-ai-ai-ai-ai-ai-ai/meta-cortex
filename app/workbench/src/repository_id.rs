use crate::LedgerError;
use derive_more::Display;
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::Path;
use tempfile::NamedTempFile;
use uuid::Uuid;

/// Local identity shared by a main checkout and its linked worktrees.
#[derive(Debug, Display, PartialEq, Eq)]
pub(crate) struct RepositoryId(Uuid);

impl RepositoryId {
    const FILE: &str = ".meta-cortex/repository-id";
    const EXCLUDE: &str = "/.meta-cortex/repository-id";

    pub fn read(root: &Path) -> Result<Self, LedgerError> {
        let path = root.join(Self::FILE);
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() => {}
            Ok(_) => return Err(LedgerError::Invalid("repository-id must be a regular file")),
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Err(LedgerError::Uninitialized);
            }
            Err(error) => return Err(error.into()),
        }
        let text = fs::read_to_string(path)?;
        let id = Uuid::parse_str(text.trim())
            .map_err(|_| LedgerError::Invalid("invalid repository-id; restore the original ID"))?;
        Ok(Self(id))
    }

    pub fn initialize(root: &Path, common_dir: &Path) -> Result<Self, LedgerError> {
        let directory = root.join(".meta-cortex");
        fs::create_dir_all(&directory)?;
        match fs::symlink_metadata(&directory)? {
            metadata if metadata.is_dir() => {}
            _ => return Err(LedgerError::Invalid(".meta-cortex must be a directory")),
        }
        // Local Git metadata prevents the generated identity from entering commits.
        let exclude = common_dir.join("info/exclude");
        fs::create_dir_all(common_dir.join("info"))?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&exclude)?;
        match fs::read_to_string(&exclude)?
            .lines()
            .find(|line| *line == Self::EXCLUDE)
        {
            Some(_) => {}
            None => writeln!(file, "\n{}", Self::EXCLUDE)?,
        }
        match Self::read(root) {
            Ok(id) => return Ok(id),
            Err(LedgerError::Uninitialized) => {}
            Err(error) => return Err(error),
        }
        let mut file = NamedTempFile::new_in(directory)?;
        writeln!(file, "{}", Uuid::new_v4())?;
        match file.persist_noclobber(root.join(Self::FILE)) {
            Ok(_) => {}
            Err(error) if error.error.kind() == ErrorKind::AlreadyExists => {}
            Err(error) => return Err(error.error.into()),
        }
        Self::read(root)
    }
}

#[cfg(test)]
pub mod tests {
    use super::RepositoryId;
    use crate::LedgerError;
    use std::fs;
    use std::os::unix::fs::symlink;
    use std::path::Path;
    use std::thread;

    #[test]
    fn initialization_preserves_identity_and_existing_exclusions() -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        let root = directory.path();
        let git = git2::Repository::init(root)?;
        fs::write(git.path().join("info/exclude"), "local-note")?;
        let id = RepositoryId::initialize(root, git.path())?;
        let exclusions = fs::read(git.path().join("info/exclude"))?;
        assert!(exclusions.starts_with(b"local-note\n"));
        assert_eq!(id, RepositoryId::initialize(root, git.path())?);
        assert_eq!(exclusions, fs::read(git.path().join("info/exclude"))?);
        assert!(git.status_should_ignore(Path::new(RepositoryId::FILE))?);
        fs::write(root.join(RepositoryId::FILE), "broken ID")?;
        assert!(matches!(
            RepositoryId::initialize(root, git.path()),
            Err(LedgerError::Invalid(_))
        ));
        assert_eq!(
            fs::read_to_string(root.join(RepositoryId::FILE))?,
            "broken ID"
        );
        fs::remove_file(root.join(RepositoryId::FILE))?;
        symlink(
            git.path().join("info/exclude"),
            root.join(RepositoryId::FILE),
        )?;
        assert!(matches!(
            RepositoryId::initialize(root, git.path()),
            Err(LedgerError::Invalid(_))
        ));
        assert_eq!(exclusions, fs::read(git.path().join("info/exclude"))?);
        Ok(())
    }

    #[test]
    fn concurrent_initialization_reuses_one_identity() -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        let root = directory.path();
        let git = git2::Repository::init(root)?;
        let ids = thread::scope(|scope| {
            let handles: Vec<_> = (0..4)
                .map(|_| {
                    let common = git.path();
                    scope.spawn(move || RepositoryId::initialize(root, common))
                })
                .collect();
            handles
                .into_iter()
                .map(|handle| {
                    handle
                        .join()
                        .map_err(|_| anyhow::anyhow!("initialization thread failed"))?
                        .map_err(anyhow::Error::from)
                })
                .collect::<anyhow::Result<Vec<_>>>()
        })?;
        assert_eq!(ids.len(), 4);
        for id in ids {
            assert_eq!(id, RepositoryId::read(root)?);
        }
        Ok(())
    }
}
