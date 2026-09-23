use super::{GitWorktree, Repository};
use crate::LedgerError;
use crate::values::{BranchName, CommitId};
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
