# Completed Task Cleanup

The integration owner removes completed worker worktrees after combined checks
pass. Use the assigned absolute paths `repo_path`, `feature_path`, and `task_path`,
and branches `feature_branch` and `task_branch`. Retain the feature workspace
for the configured delivery step.

## Required actions

### Complete and clean up

1. Complete the feature's assigned validation before cleanup. For each finished
   task, check that Git lists its branch as fully merged:

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

**Prohibited:** force-delete an unmerged task branch or dirty worktree.

**Preferred:** confirm integration and clean status, remove the finished worker
workspace and branch, and retain the validated feature for review.
