use super::model::{Checkpoint, Feature, Workspace};
use super::values::{BranchName, CommitId};
use super::{DataDirectory, LedgerError};
use crate::repository_id::RepositoryId;
use derive_more::From;
use git2::{Branch, Oid, StatusOptions};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Repository {
    pub common_dir: PathBuf,
    root: PathBuf,
    data: DataDirectory,
}

#[derive(From)]
pub struct GitWorktree(pub PathBuf);

impl GitWorktree {
    fn open(&self) -> Result<git2::Repository, LedgerError> {
        let Self(path) = self;
        Ok(git2::Repository::discover(path)?)
    }

    pub fn head(&self) -> Result<CommitId, LedgerError> {
        let oid = self.open()?.head()?.peel_to_commit()?.id();
        Ok(CommitId::try_from(oid.to_string())?)
    }

    pub fn require_branch(&self, branch: &BranchName) -> Result<(), LedgerError> {
        let name = branch.to_string();
        if !Branch::name_is_valid(&name)? {
            return Err(git2::Error::from_str("invalid Git branch name").into());
        }
        let repository = self.open()?;
        let head = repository.head()?;
        if !head.is_branch() || Branch::wrap(head).name()? != Some(name.as_str()) {
            return Err(LedgerError::Invalid(
                "worktree is not on its assigned branch",
            ));
        }
        Ok(())
    }

    pub fn require_ancestor(&self, commit: &CommitId) -> Result<(), LedgerError> {
        let repository = self.open()?;
        let ancestor = repository
            .find_commit(Oid::from_str_ext(
                &commit.to_string(),
                repository.object_format(),
            )?)?
            .id();
        let head = repository.head()?.peel_to_commit()?.id();
        // libgit2's descendant check excludes equality; Git's is-ancestor includes it.
        if head != ancestor && !repository.graph_descendant_of(head, ancestor)? {
            return Err(git2::Error::from_str("checkpoint is not an ancestor of HEAD").into());
        }
        Ok(())
    }

    pub fn require_clean(&self) -> Result<(), LedgerError> {
        let mut options = StatusOptions::new();
        options.include_untracked(true).recurse_untracked_dirs(true);
        if !self.open()?.statuses(Some(&mut options))?.is_empty() {
            return Err(LedgerError::Invalid("worktree has uncommitted changes"));
        }
        Ok(())
    }
}

impl Repository {
    #[must_use]
    pub fn with_data_directory(mut self, directory: DataDirectory) -> Self {
        self.data = directory;
        self
    }

    fn repository_directory(&self) -> Result<PathBuf, LedgerError> {
        let id = RepositoryId::read(&self.root)?;
        let name = self
            .root
            .file_name()
            .ok_or(LedgerError::Invalid("repository has no directory name"))?;
        let expected = self.data.path().join(name).join(id.to_string());
        match fs::metadata(&expected) {
            Ok(metadata) if metadata.is_dir() => return Ok(expected),
            Ok(_) => {
                return Err(LedgerError::Invalid(
                    "repository data path must be a directory",
                ));
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        // The name is a human-readable label; a checkout rename retains its UUID and data.
        match fs::read_dir(self.data.path()) {
            Ok(entries) => {
                for entry in entries {
                    let entry = entry?;
                    match entry.file_type()? {
                        kind if kind.is_dir() => {}
                        _ => continue,
                    }
                    let candidate = entry.path().join(id.to_string());
                    match fs::metadata(&candidate) {
                        Ok(metadata) if metadata.is_dir() => return Ok(candidate),
                        Ok(_) => {}
                        Err(error) if error.kind() == ErrorKind::NotFound => {}
                        Err(error) => return Err(error.into()),
                    }
                }
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        Ok(expected)
    }

    pub fn initialize(&self) -> Result<(), LedgerError> {
        RepositoryId::initialize(&self.root, &self.common_dir)?;
        fs::create_dir_all(self.repository_directory()?)?;
        Ok(())
    }

    pub(crate) fn legacy_ledgers(&self) -> Result<Vec<PathBuf>, LedgerError> {
        let id = RepositoryId::read(&self.root)?;
        let directory = self.data.path().join(id.to_string()).join("features");
        let mut paths = Vec::new();
        match fs::read_dir(directory) {
            Ok(entries) => {
                for entry in entries {
                    let path = entry?.path();
                    if let Some("db") = path.extension().and_then(|extension| extension.to_str()) {
                        paths.push(path);
                    }
                }
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        paths.sort();
        Ok(paths)
    }

    pub fn discover(project: &Path) -> Result<Self, LedgerError> {
        let common_dir = git2::Repository::discover(project)?
            .commondir()
            .canonicalize()?;
        let main = git2::Repository::open(&common_dir)?;
        let root = main
            .workdir()
            .ok_or(LedgerError::Invalid("repository has no main checkout"))?;
        let root = root.to_owned();
        Ok(Self {
            common_dir,
            root,
            data: DataDirectory::discover()?,
        })
    }

    pub fn ledger_path(&self) -> Result<PathBuf, LedgerError> {
        Ok(self.repository_directory()?.join("workbench.db"))
    }

    pub fn require_workspace(&self, workspace: &Workspace) -> Result<(), LedgerError> {
        match workspace {
            Workspace::ReadOnly => Ok(()),
            Workspace::Git { branch, path } => {
                if !path.is_absolute() {
                    return Err(LedgerError::Invalid("worktree path must be absolute"));
                }
                if Self::discover(path)?.common_dir != self.common_dir {
                    return Err(LedgerError::Invalid(
                        "worktree belongs to a different repository",
                    ));
                }
                GitWorktree::from(path.clone()).require_branch(branch)
            }
        }
    }

    pub fn require_feature(&self, feature: &Feature) -> Result<(), LedgerError> {
        self.require_workspace(&Workspace::Git {
            branch: feature.branch.clone(),
            path: feature.worktree.clone(),
        })
    }

    pub fn checkpoint(&self, input: CheckpointCheck<'_>) -> Result<(), LedgerError> {
        self.require_workspace(input.workspace)?;
        match input.workspace {
            Workspace::ReadOnly => Err(LedgerError::Invalid(
                "read-only tasks do not have code checkpoints",
            )),
            Workspace::Git { path, .. } => {
                GitWorktree::from(path.clone()).require_ancestor(input.commit)
            }
        }
    }

    pub fn ready(&self, input: ReadyCheck<'_>) -> Result<(), LedgerError> {
        self.require_workspace(input.workspace)?;
        match input {
            ReadyCheck {
                workspace: Workspace::ReadOnly,
                checkpoint: Checkpoint::Unrecorded,
            } => Ok(()),
            ReadyCheck {
                workspace: Workspace::Git { path, .. },
                checkpoint: Checkpoint::Git { commit },
            } => {
                let git = GitWorktree::from(path.clone());
                git.require_clean()?;
                if git.head()? != *commit {
                    return Err(LedgerError::Invalid(
                        "checkpoint must match task HEAD before readiness",
                    ));
                }
                Ok(())
            }
            ReadyCheck {
                workspace: Workspace::ReadOnly,
                checkpoint: Checkpoint::Git { .. },
            }
            | ReadyCheck {
                workspace: Workspace::Git { .. },
                checkpoint: Checkpoint::Unrecorded,
            } => Err(LedgerError::Invalid(
                "checkpoint does not match task workspace",
            )),
        }
    }

    pub fn integrated(&self, input: IntegrationCheck<'_>) -> Result<(), LedgerError> {
        self.require_feature(input.feature)?;
        let git = GitWorktree::from(input.feature.worktree.clone());
        git.require_clean()?;
        if git.head()? != *input.commit {
            return Err(LedgerError::Invalid(
                "integration commit must match feature HEAD",
            ));
        }
        match input.checkpoint {
            Checkpoint::Unrecorded => Ok(()),
            Checkpoint::Git { commit } => git.require_ancestor(commit),
        }
    }
}

pub struct CheckpointCheck<'a> {
    pub workspace: &'a Workspace,
    pub commit: &'a CommitId,
}
pub struct ReadyCheck<'a> {
    pub workspace: &'a Workspace,
    pub checkpoint: &'a Checkpoint,
}
pub struct IntegrationCheck<'a> {
    pub feature: &'a Feature,
    pub checkpoint: &'a Checkpoint,
    pub commit: &'a CommitId,
}

#[cfg(test)]
pub mod tests {
    use super::{GitWorktree, Repository};
    use crate::repository_id::RepositoryId;
    use crate::values::{BranchName, CommitId};
    use crate::{DataDirectory, LedgerError};
    use std::fs;
    use std::path::Path;

    #[test]
    fn repository_identity_is_local_stable_and_independent_of_its_name() -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        let original = directory.path().join("source/project");
        let cloned = directory.path().join("cloned/project");
        let data = DataDirectory::from(directory.path().join("data"));
        fs::create_dir_all(data.path())?;
        fs::write(data.path().join("notes.txt"), "shared application data")?;
        git2::Repository::init(&original)?;
        let repository = Repository::discover(&original)?.with_data_directory(data.clone());
        assert!(matches!(
            repository.ledger_path(),
            Err(LedgerError::Uninitialized)
        ));
        assert!(!original.join(".meta-cortex").exists());
        repository.initialize()?;
        let storage = repository.repository_directory()?;
        let id = RepositoryId::read(&original)?;
        assert_eq!(storage, data.path().join("project").join(id.to_string()));
        repository.initialize()?;
        assert_eq!(storage, repository.repository_directory()?);
        GitWorktree::from(original.clone()).require_clean()?;
        assert!(!original.join(".git/meta-cortex").exists());

        git2::Repository::clone(
            original.to_str().ok_or_else(|| anyhow::anyhow!("path"))?,
            &cloned,
        )?;
        assert!(!cloned.join(".meta-cortex/repository-id").exists());
        let clone = Repository::discover(&cloned)?.with_data_directory(data.clone());
        clone.initialize()?;
        assert_ne!(storage, clone.repository_directory()?);

        let renamed = directory.path().join("renamed");
        fs::rename(&original, &renamed)?;
        let moved = Repository::discover(&renamed)?.with_data_directory(data.clone());
        moved.initialize()?;
        assert_eq!(id, RepositoryId::read(&renamed)?);
        assert_eq!(storage, moved.repository_directory()?);

        fs::remove_dir_all(&renamed)?;
        git2::Repository::init(&renamed)?;
        let recreated = Repository::discover(&renamed)?.with_data_directory(data);
        recreated.initialize()?;
        assert_ne!(storage, recreated.repository_directory()?);
        assert!(storage.is_dir());
        Ok(())
    }

    #[test]
    fn linked_worktrees_share_the_main_checkout_name() -> anyhow::Result<()> {
        let directory = tempfile::tempdir()?;
        let project = directory.path().join("project with spaces 🦀");
        let repository = git2::Repository::init(&project)?;
        let signature = git2::Signature::now("Git Test", "git@example.invalid")?;
        let tree_id = repository.index()?.write_tree()?;
        let tree = repository.find_tree(tree_id)?;
        repository.commit(Some("HEAD"), &signature, &signature, "root", &tree, &[])?;
        let data = DataDirectory::from(directory.path().join("data"));
        let main = Repository::discover(&project)?.with_data_directory(data.clone());
        main.initialize()?;
        let id = RepositoryId::read(&project)?;
        let expected = data
            .path()
            .join("project with spaces 🦀")
            .join(id.to_string())
            .join("workbench.db");
        assert_eq!(main.ledger_path()?, expected);
        let linked_path = directory.path().join("worker checkout");
        repository.worktree("worker", &linked_path, None)?;
        let linked = Repository::discover(&linked_path)?.with_data_directory(data);
        linked.initialize()?;
        assert_eq!(linked.ledger_path()?, expected);
        assert!(!linked_path.join(".meta-cortex/repository-id").exists());
        Ok(())
    }

    #[test]
    fn git_library_preserves_checkpoint_and_worktree_checks() -> anyhow::Result<()> {
        for format in [git2::ObjectFormat::Sha1, git2::ObjectFormat::Sha256] {
            let directory = tempfile::tempdir()?;
            let project = directory.path().join("project with spaces 🦀");
            let mut options = git2::RepositoryInitOptions::new();
            options.initial_head("codex/feature").object_format(format);
            let repository = git2::Repository::init_opts(&project, &options)?;
            fs::write(project.join("tracked.txt"), "initial")?;
            let mut index = repository.index()?;
            index.add_path(Path::new("tracked.txt"))?;
            index.write()?;
            let tree_id = index.write_tree()?;
            let tree = repository.find_tree(tree_id)?;
            let signature = git2::Signature::now("Git Test", "git@example.invalid")?;
            let root_id =
                repository.commit(Some("HEAD"), &signature, &signature, "root", &tree, &[])?;
            let root = repository.find_commit(root_id)?;
            let worktree = GitWorktree::from(project.clone());
            let checkpoint = worktree.head()?;
            let branch = BranchName::try_from("codex/feature".to_owned())?;
            worktree.require_branch(&branch)?;
            worktree.require_clean()?;
            worktree.require_ancestor(&checkpoint)?;
            repository.commit(
                Some("HEAD"),
                &signature,
                &signature,
                "child",
                &tree,
                &[&root],
            )?;
            worktree.require_ancestor(&checkpoint)?;
            let sibling =
                repository.commit(None, &signature, &signature, "sibling", &tree, &[&root])?;
            let unrelated = CommitId::try_from(sibling.to_string())?;
            assert!(matches!(
                worktree.require_ancestor(&unrelated),
                Err(LedgerError::Git(_))
            ));
            let other_branch = BranchName::try_from("codex/other".to_owned())?;
            assert!(matches!(
                worktree.require_branch(&other_branch),
                Err(LedgerError::Invalid(_))
            ));
            repository.set_head_detached(root_id)?;
            assert!(matches!(
                worktree.require_branch(&branch),
                Err(LedgerError::Invalid(_))
            ));
            repository.set_head("refs/heads/codex/feature")?;
            fs::write(repository.path().join("info/exclude"), "ignored.txt\n")?;
            fs::write(project.join("ignored.txt"), "ignored")?;
            worktree.require_clean()?;
            fs::create_dir(project.join("nested"))?;
            fs::write(project.join("nested/untracked.txt"), "untracked")?;
            assert!(matches!(
                worktree.require_clean(),
                Err(LedgerError::Invalid(_))
            ));
            fs::remove_file(project.join("nested/untracked.txt"))?;
            fs::write(project.join("tracked.txt"), "modified")?;
            assert!(matches!(
                worktree.require_clean(),
                Err(LedgerError::Invalid(_))
            ));
            index.add_path(Path::new("tracked.txt"))?;
            index.write()?;
            assert!(matches!(
                worktree.require_clean(),
                Err(LedgerError::Invalid(_))
            ));
            assert_eq!(
                Repository::discover(&project.join("nested"))?.common_dir,
                repository.commondir().canonicalize()?
            );
        }
        Ok(())
    }
}
