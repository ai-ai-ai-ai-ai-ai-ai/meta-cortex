# Branch Integration and Repairs

The integration owner merges completed tasks and handles Git recovery. Gizmo
assigns implementation repairs to the worker. Use the assigned absolute
`feature_path` and `task_path`, and branches `feature_branch` and `task_branch`.
In single-agent mode, perform these responsibilities locally. Git commands and
validation run in the consuming project's worktrees.

## Required actions

### Integrate finished branches

Integrate completed tasks in dependency order. Keep one writer to the feature
branch and finish each integration before starting the next.

1. Confirm the finished worker's checkout is on `task_branch` and clean:

   ```sh
   git -C "$task_path" branch --show-current
   git -C "$task_path" status --short
   ```

   The first command must print the assigned task branch; the second must print
   nothing. Report unfinished work to Team Gizmo for a decision before proceeding.

2. Confirm the integration checkout is on `feature_branch` and clean:

   ```sh
   git -C "$feature_path" branch --show-current
   git -C "$feature_path" status --short
   git -C "$feature_path" status
   ```

   Check the branch name, empty short status, and absence of an unfinished merge
   or rebase in the full status. Resolve an unfinished operation first. Preserve
   unrelated changes instead of resetting them.

3. Capture the finished task SHA and inspect its changes against the assigned scope:

   ```sh
   task_sha=$(git -C "$task_path" rev-parse --verify HEAD)
   git -C "$feature_path" diff "$feature_branch...$task_branch"
   ```

   The three-dot comparison shows task changes since its shared history with the
   feature branch. Report out-of-scope changes to Team Gizmo for a decision before merging.

4. Merge the finished task branch into the feature branch:

   ```sh
   git -C "$feature_path" merge --no-edit -- "$task_branch"
   ```

   Git fast-forwards when possible or performs an ordinary merge. Preserve that
   history; do not substitute squash, cherry-pick, or history rewriting. Resolve
   incompatible repository merge policy before running the command. If it fails,
   follow the integration-failure procedure below before continuing.

5. Confirm the task branch is fully merged and the worktree is clean:

   ```sh
   git -C "$feature_path" branch --merged "$feature_branch" --list "$task_branch"
   git -C "$feature_path" status --short
   ```

   The branch listing must include `task_branch`; short status must be empty.
   Investigate an unexpected result before treating integration as successful.

6. Run the project's assigned combined validation commands from `feature_path`.
   Report the merged task branch, destination feature branch, commands run, and
   check results. Git merge success and separate task checks do not establish
   that the combined feature passes. Report failed checks to Team Gizmo for a repair decision
   before integrating dependent tasks. After successful combined validation,
   record the integrated task through the [feature ledger skill](../../../agent-ledger/SKILL.md).

   Read the actual integrated revision and confirm that it contains the task:

   ```sh
   integration_sha=$(git -C "$feature_path" rev-parse --verify HEAD)
   git -C "$feature_path" merge-base --is-ancestor "$task_sha" "$integration_sha"
   ```

   A fast-forward retains the task SHA; an ordinary merge may create a different
   integration SHA. Record `Task / Coordinate` with `action.kind: integrate`
   and that actual feature SHA after combined checks pass. Report both the task
   SHA and integration SHA with the combined check results.

**Prohibited:** merge several worker branches concurrently or report a passing
feature based only on a successful Git merge.

**Preferred:** merge `task/parser`, verify its inclusion, run the combined checks,
then integrate the next completed branch in dependency order.

### Resolve integration failures

1. If the feature merge reports conflicts, list the affected files:

   ```sh
   git -C "$feature_path" diff --name-only --diff-filter=U
   ```

   Record these paths for the report to Team Gizmo, then abort this attempted merge:

   ```sh
   git -C "$feature_path" merge --abort
   git -C "$feature_path" status
   ```

   Expect a clean worktree with no merge in progress. If abort fails, retain the
   workspaces and report Git's error and status; do not reset away work.

2. Report the conflicts and Git state to Team Gizmo, which decides the repair
   assignment. Once assigned, the worker merges the feature branch into its branch:

   ```sh
   git -C "$task_path" merge --no-edit -- "$feature_branch"
   ```

   If it merges successfully, continue with task checks. If it conflicts, the
   owner identifies and edits the conflicting files in this worktree:

   ```sh
   git -C "$task_path" diff --name-only --diff-filter=U
   ```

   Report unresolved application behavior to Team Gizmo for a decision rather
   than choosing one side automatically.

3. For a conflicted worker merge, stage each resolved file using its
   repository-relative `changed_path`, then inspect the resolution:

   ```sh
   git -C "$task_path" add -- "$changed_path"
   git -C "$task_path" diff --name-only --diff-filter=U
   git -C "$task_path" diff --cached
   ```

   Repeat staging for all resolved files. The unresolved-file list must be empty.
   After reviewing the staged resolution, finish the merge:

   ```sh
   git -C "$task_path" commit --no-edit
   git -C "$task_path" status --short
   ```

   Expect clean status. Rerun the worker's checks and report the repaired task
   to Team Gizmo. When Gizmo supplies the repair result and directs continuation,
   repeat feature integration and combined validation.

   For a one-commit assignment, Gizmo supplies the exact feature SHA that the
   worker just merged as the updated `task_base_sha`. After conflict resolution
   and validation, consolidate the complete task again with the
   [task-completion procedure](task-commits.md#finish-task-work). Repairs before integration retain the original base unless the
   worker incorporates a newer feature revision. In both cases, record
   the replacement checkpoint and readiness.

4. If Git merged successfully but combined checks fail, keep the branches and
   report the failing checks to Team Gizmo for a repair decision. The assigned
   worker uses the repair steps above to incorporate current feature changes
   if needed, fixes the failed behavior, and reports task completion to Gizmo. Do not run `merge --abort` for a completed merge.
   Integrate the repair and rerun checks before dependent tasks or cleanup.

   For a one-commit repair, use the current feature SHA incorporated by the
   worker as its new `task_base_sha`. Consolidate only the new repair changes
   above that SHA. Preserve the already-integrated task commit in feature
   history; never reset the feature to recreate the original task.

**Prohibited:** discard a side of a domain conflict or remove branches while
combined validation is failing.

**Preferred:** abort only the conflicted merge, report the affected paths to Gizmo
for a repair decision, and validate the repaired branch after integrating it.
