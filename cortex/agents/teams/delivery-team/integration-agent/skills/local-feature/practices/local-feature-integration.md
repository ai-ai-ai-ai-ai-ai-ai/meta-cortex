# Local Feature Integration

Use ordinary Git branches and worktrees to combine finished tasks into a
validated local feature branch. Work proceeds from task completion to integration.

Command examples use shell variables supplied for the task: `repo_path`,
`base_branch`, `feature_branch`, `feature_path`, `task_branch`, and `task_path`.
Paths are absolute. Branch names follow the project's convention. Feature and
worker paths are separate directories outside the original checkout; all belong
to the same Git repository. Replace the variables with the assigned values.

## Required actions

### Set up workspaces

1. Inspect the original checkout. Preserve pending edits; new worktrees will not
   include them.

   ```sh
   git -C "$repo_path" status --short
   git -C "$repo_path" worktree list
   git -C "$repo_path" branch --list
   ```

2. Set `base_branch` to the branch selected by the user or project. If none was
   selected, use the name printed below. If it prints nothing, resolve the base
   branch choice before proceeding. Do not fetch implicitly.

   ```sh
   git -C "$repo_path" branch --show-current
   ```

3. For a new feature, create its branch and integration worktree once:

   ```sh
   git -C "$repo_path" worktree add -b "$feature_branch" "$feature_path" "$base_branch"
   ```

   For an existing feature, skip creation and use its assigned branch and path.
   Check that the first command prints `feature_branch` and the second prints
   nothing. Resolve unexpected changes before starting task work.

   ```sh
   git -C "$feature_path" branch --show-current
   git -C "$feature_path" status --short
   ```

   Keep this same feature branch for the entire feature, including later fixes.
   If creation fails because a branch or path already exists, inspect it with
   `git worktree list`; do not overwrite it or choose another feature implicitly.

4. For each worker assignment, set a distinct `task_branch` and `task_path`, then
   create its linked worktree from the feature branch:

   ```sh
   git -C "$repo_path" worktree add -b "$task_branch" "$task_path" "$feature_branch"
   git -C "$task_path" branch --show-current
   git -C "$task_path" status --short
   ```

   Confirm the worker branch name and clean status. Repeat this step for each
   independent task. Create dependent tasks after their prerequisites are
   integrated and validated. Read-only tasks need no write worktree and must
   not modify shared workspaces.

5. Confirm the resulting branch-to-worktree mapping:

   ```sh
   git -C "$repo_path" worktree list
   ```

   Return the feature branch/path and each task's branch/path. Supply each worker
   its scope, checks, and actual framework library location. Git does not copy
   ignored libraries, dependencies, or pending edits into these worktrees.

**Prohibited:** create another feature branch for every worker or reuse one
worker checkout for several active task branches.

**Preferred:** run feature creation once for `feature/editor`. Repeat task
creation for `task/parser` and `task/ui`, each with its own path. Both task
branches will merge into the same `feature/editor` branch.

### Finish task work

- Keep changes within the assigned task branch and scope.
- Save the finished work on the branch and run the required focused checks.
  If checks change files, save those changes and rerun affected checks.
- Finish with a clean worktree and report the task result and validation outcome.
  Incomplete work or failed checks must be reported accurately.

**Prohibited:** report a task complete while its final edits remain unsaved or
its required checks have failed.

**Preferred:** finish the task branch, verify its changes, and report completion
so integration can begin.

### Integrate finished branches

1. Once a task is finished, integrate its branch in dependency order. Use one
   writer for the feature branch and merge one task branch at a time.
2. Check the integration worktree is on the feature branch and clean. Resolve
   an unfinished Git operation before attempting another merge; preserve
   unrelated changes instead of resetting them.
3. Inspect the task branch's changes against its scope. Merge it by branch name,
   using fast-forward when possible and an ordinary Git merge otherwise.
   Preserve branch history rather than squashing, cherry-picking, or rewriting
   the feature. Resolve incompatible repository merge policy before proceeding.
4. Run the relevant combined checks. Report which task branches were merged and
   the feature's validation results. Task checks alone do not validate the combination.

**Prohibited:** let workers merge concurrently into the feature branch or claim
that their separate passing checks prove the combined feature works.

**Preferred:** after `task/parser` finishes, merge it into the feature branch and
validate the result. Then integrate the next completed task in dependency order.

After the task finishes, inspect its worktree and branch changes, then merge
from the feature worktree. Both status checks must be clean. The three-dot diff
shows task changes since its shared history with the feature branch.

```sh
git -C "$task_path" status --short
git -C "$feature_path" branch --show-current
git -C "$feature_path" status --short
git -C "$feature_path" diff "$feature_branch...$task_branch"
git -C "$feature_path" merge --no-edit -- "$task_branch"
```

Run the project's assigned validation commands in `feature_path` after the merge.
Git merge success alone does not establish that those checks passed.

### Resolve integration failures

- If a merge conflicts, abort it and report the conflicting files. Have the
  owner resolve the conflict in its task worktree by merging the feature branch
  into the task branch. Once the repair and checks finish, integrate that branch.
- If combined checks fail, keep the branches and route the fix to its owner.
  Integrate the repair and rerun affected checks before dependent work or cleanup.
- If Git cannot complete or abort an operation, report its actual state and
  preserve the workspaces. Use ordinary Git to resolve it.

**Prohibited:** discard one side of a domain conflict without its owner or
remove branches while combined validation is failing.

**Preferred:** return the conflicting task for repair, then merge the repaired
branch and check the feature again.

If the feature merge conflicts, list the affected paths before aborting:

```sh
git -C "$feature_path" diff --name-only --diff-filter=U
git -C "$feature_path" merge --abort
git -C "$feature_path" status --short
```

The task owner performs the repair in its worker worktree:

```sh
git -C "$task_path" merge --no-edit -- "$feature_branch"
```

The owner resolves the files, saves the repair on its branch, and reruns task
checks. Once that task finishes, repeat the normal feature merge and validation.

### Complete and clean up

1. Verify finished task branches are fully merged using Git's branch comparison,
   such as `git branch --merged feature/example`. Complete feature validation.
2. Remove finished task worktrees with `git worktree remove` and their branches
   with `git branch -d` from the feature worktree. Keep any branch that still has
   work in progress or unmerged changes. Do not force cleanup if Git refuses.
3. Retain the feature branch and integration worktree. Report their locations,
   merged tasks, check results, and unfinished work. Local completion excludes
   publishing, PR creation, and merging into the base branch.

**Prohibited:** force-delete an unmerged task branch or a dirty worktree.

**Preferred:** let Git confirm branches are merged, remove only finished task
workspaces, and leave the validated feature branch available for review.

For each finished task, confirm its branch appears in the merged-branch list
and its worktree is clean before running removal commands. Keep the feature
worktree and branch. Run branch deletion from the feature worktree so Git checks
integration against the destination branch.

```sh
git -C "$feature_path" branch --merged "$feature_branch" --list "$task_branch"
git -C "$task_path" status --short
git -C "$repo_path" worktree remove "$task_path"
git -C "$feature_path" branch -d "$task_branch"
```
