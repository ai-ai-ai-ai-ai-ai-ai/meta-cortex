use super::LedgerError;
use super::model::{Checkpoint, Feature, Workspace};
use super::values::{BranchName, CommitId, FeatureId};
use crate::values::{CommitIdParse, FeatureIdParse};
use derive_more::From;
use git2::{Branch, Oid, StatusOptions};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Repository {
    pub common_dir: PathBuf,
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
        match CommitIdParse::from(oid.to_string()) {
            CommitIdParse::Parsed(commit) => Ok(commit),
            CommitIdParse::Invalid(error) => Err(error.into()),
        }
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
    pub fn features(&self) -> Result<Vec<FeatureId>, LedgerError> {
        let directory = self.common_dir.join("meta-cortex/features");
        let mut ids = Vec::new();
        match fs::read_dir(directory) {
            Ok(entries) => {
                for entry in entries {
                    let path = entry?.path();
                    if path.extension().is_some_and(|extension| extension == "db") {
                        let id = path
                            .file_stem()
                            .and_then(|name| name.to_str())
                            .ok_or(LedgerError::Invalid("invalid feature database filename"))?;
                        ids.push(match FeatureIdParse::from(id.to_owned()) {
                            FeatureIdParse::Parsed(value) => value,
                            FeatureIdParse::Invalid(error) => return Err(error.into()),
                        });
                    }
                }
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        ids.sort_by_key(ToString::to_string);
        Ok(ids)
    }

    pub fn discover(project: &Path) -> Result<Self, LedgerError> {
        let common_dir = git2::Repository::discover(project)?
            .commondir()
            .canonicalize()?;
        Ok(Self { common_dir })
    }

    pub fn ledger_path(&self, feature: &FeatureId) -> PathBuf {
        self.common_dir
            .join("meta-cortex/features")
            .join(format!("{feature}.db"))
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
mod tests {
    use super::{GitWorktree, Repository};
    use crate::LedgerError;
    use crate::values::{BranchNameParse, CommitIdParse};
    use std::fs;
    use std::path::Path;

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
            let branch = match BranchNameParse::from("codex/feature".to_owned()) {
                BranchNameParse::Parsed(branch) => branch,
                BranchNameParse::Invalid(error) => return Err(error.into()),
            };
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
            let unrelated = match CommitIdParse::from(sibling.to_string()) {
                CommitIdParse::Parsed(commit) => commit,
                CommitIdParse::Invalid(error) => return Err(error.into()),
            };
            assert!(matches!(
                worktree.require_ancestor(&unrelated),
                Err(LedgerError::Git(_))
            ));
            let other_branch = match BranchNameParse::from("codex/other".to_owned()) {
                BranchNameParse::Parsed(branch) => branch,
                BranchNameParse::Invalid(error) => return Err(error.into()),
            };
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
