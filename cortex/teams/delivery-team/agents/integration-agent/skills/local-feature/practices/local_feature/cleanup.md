# Completed Task Cleanup

The integration owner removes completed, agent-created task worktrees after
combined checks pass. Use the assigned absolute paths `repo_path`, `feature_path`,
and `task_path`, and branches `feature_branch` and `task_branch`. Apply
[feature-worktree ownership](../../../../../../docs/project-delivery-policy.md#preserve-the-users-feature-worktree):
the feature workspace remains available to the user after delivery.

## Required actions

### Complete and clean up

1. Confirm from the task assignment and workspace setup that `task_path` is an
   agent-created task worktree. It must not be the feature worktree, original
   checkout, or another user-provided workspace. If ownership is unclear, retain
   it and report why cleanup was skipped.

   Complete the feature's assigned validation. For each eligible finished task,
   check that Git lists its branch as fully merged:

   ```sh
   git -C "$feature_path" branch --merged "$feature_branch" --list "$task_branch"
   ```

   The output must include `task_branch`. An empty result means keep the branch
   and resolve its remaining integration work.

2. Confirm the task is no longer active and its worktree is clean:

   ```sh
   git -C "$task_path" status --short
   ```

   Expect no output. Keep the workspace if it contains pending changes or the
   worker still needs it; report that unfinished work.

3. Remove the finished worker worktree:

   ```sh
   git -C "$repo_path" worktree remove "$task_path"
   ```

   Continue only if removal succeeds. If Git refuses, retain the workspace and
   report the reason; do not force removal.

4. Delete its fully merged branch from the feature worktree:

   ```sh
   git -C "$feature_path" branch -d "$task_branch"
   ```

   Expect Git to report deletion. If it refuses, keep the branch and investigate
   the reason instead of forcing deletion.

5. Confirm the remaining workspaces and feature status:

   ```sh
   git -C "$repo_path" worktree list
   git -C "$feature_path" branch --show-current
   git -C "$feature_path" status --short
   ```

   Keep the feature worktree on `feature_branch` with clean status. Report its
   branch/path, merged tasks, validation results, and retained task workspaces.
   Local completion excludes publishing, PR creation, and merging into the base.

**Prohibited:** remove the feature worktree after a PR merge, or force-delete an
unmerged task branch or dirty worktree.

**Required:** confirm integration and clean status, remove the finished worker
workspace and branch, and retain the validated feature for review.
