# Local Feature Workspace Setup

The integration owner prepares the feature and worker worktrees. Use the assigned
absolute paths `repo_path`, `feature_path`, and `task_path`, and assigned branch
names `base_branch`, `feature_branch`, and `task_branch`. These paths belong to
the same repository; feature and worker worktrees are separate from the original
checkout. Follow the project's branch naming convention.

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

3. Reuse the feature branch and worktree supplied by the user, including for a
   new feature. Keep its path in the assignment under
   [feature-worktree ownership](../../../../../../docs/project-delivery-policy.md#preserve-the-users-feature-worktree).
   If no feature worktree was supplied and the assignment calls for creating one,
   create its branch and integration worktree once:

   ```sh
   git -C "$repo_path" worktree add -b "$feature_branch" "$feature_path" "$base_branch"
   ```

   If neither a supplied workspace nor a creation assignment is available,
   report the missing workspace decision to Team Gizmo before task setup.
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

   For a one-commit assignment, record the starting commit as `task_base_sha`
   in the existing assignment:

   ```sh
   git -C "$task_path" rev-parse --verify HEAD
   ```

   This is the base for consolidating local task commits, not a moving feature
   branch name. Return it with the branch and worktree mapping.

5. Confirm the resulting branch-to-worktree mapping:

   ```sh
   git -C "$repo_path" worktree list
   ```

   Return the feature branch/path and each task's branch/path to Team Gizmo.
   Gizmo supplies each worker its scope, checks, and actual framework library location. Git does not copy
   ignored libraries, dependencies, or pending edits into these worktrees.

**Prohibited:** create another feature branch for every worker or reuse one
worker checkout for several active task branches.

**Preferred:** reuse the user's supplied `feature/editor` worktree. Create
`task/parser` and `task/ui`, each with its own path. Both task branches will
merge into the same `feature/editor` branch.
