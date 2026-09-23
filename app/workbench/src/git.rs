use super::LedgerError;
use super::model::{Checkpoint, Feature, Workspace};
use super::values::{BranchName, CommitId, FeatureId};
use derive_more::From;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::str;

#[derive(Clone)]
pub struct Repository {
    pub common_dir: PathBuf,
}

#[derive(From)]
pub struct GitWorktree(pub PathBuf);

impl GitWorktree {
    fn output(&self, arguments: &[&str]) -> Result<String, LedgerError> {
        let output = Command::new("git")
            .arg("-C")
            .arg(&self.0)
            .args(arguments)
            .output()?;
        if !output.status.success() {
            return Err(LedgerError::Git(
                String::from_utf8_lossy(&output.stderr).trim().to_owned(),
            ));
        }
        Ok(str::from_utf8(&output.stdout)
            .map_err(|_| LedgerError::Invalid("Git returned non-UTF-8 output"))?
            .trim_end()
            .to_owned())
    }

    pub fn head(&self) -> Result<CommitId, LedgerError> {
        CommitId::try_from(self.output(&["rev-parse", "--verify", "HEAD^{commit}"])?)
    }

    pub fn require_branch(&self, branch: &BranchName) -> Result<(), LedgerError> {
        self.output(&["check-ref-format", "--branch", &branch.to_string()])?;
        if self.output(&["symbolic-ref", "--short", "HEAD"])? != branch.to_string() {
            return Err(LedgerError::Invalid(
                "worktree is not on its assigned branch",
            ));
        }
        Ok(())
    }

    pub fn require_ancestor(&self, commit: &CommitId) -> Result<(), LedgerError> {
        self.output(&["merge-base", "--is-ancestor", &commit.to_string(), "HEAD"])?;
        Ok(())
    }

    pub fn require_clean(&self) -> Result<(), LedgerError> {
        if !self.output(&["status", "--porcelain"])?.is_empty() {
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
                        ids.push(FeatureId::try_from(id.to_owned())?);
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
        let git = GitWorktree::from(project.to_path_buf());
        let common_dir = PathBuf::from(git.output(&[
            "rev-parse",
            "--path-format=absolute",
            "--git-common-dir",
        ])?)
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
