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
   target_sha=$(git -C "$feature_path" rev-parse --verify HEAD)
   git -C "$feature_path" diff "$target_sha...$task_sha"
   ```

   The three-dot comparison shows task changes since its shared history with the
   feature branch. Report out-of-scope changes to Team Gizmo for a decision before merging.

4. Merge the captured task commit into the unchanged target:

   ```sh
   test "$(git -C "$feature_path" rev-parse --verify HEAD)" = "$target_sha"
   git -C "$feature_path" merge --no-edit -- "$task_sha"
   ```

   Git fast-forwards when possible or performs an ordinary merge. Preserve that
   history; do not substitute squash, cherry-pick, or history rewriting. Resolve
   incompatible repository merge policy before running the command. If it fails,
   follow the integration-failure procedure below before continuing.

5. Confirm the task commit is included and the worktree is clean:

   ```sh
   git -C "$feature_path" merge-base --is-ancestor "$task_sha" HEAD
   git -C "$feature_path" status --short
   ```

   The ancestry command must succeed; short status must be empty. Capture
   `integration_sha` now so a failed check identifies the actual merged revision:

   ```sh
   integration_sha=$(git -C "$feature_path" rev-parse --verify HEAD)
   ```

6. Run the project's assigned combined validation commands from `feature_path`.
   These checks validate the combined feature. A successful merge or passing
   worker checks does not establish that result.
   - If any check fails, follow [failure recovery](#resolve-integration-failures)
     and report the failure to Team Gizmo.
   - Keep the task unintegrated in the ledger and stop dependent integration
     until the required checks pass.

7. After all required checks pass, read the actual feature revision and confirm
   that it contains the task:

   ```sh
   integration_sha=$(git -C "$feature_path" rev-parse --verify HEAD)
   git -C "$feature_path" merge-base --is-ancestor "$task_sha" "$integration_sha"
   ```

   A fast-forward retains the task SHA; an ordinary merge may create a different
   integration SHA. Follow the [feature ledger skill](../../../agent-ledger/SKILL.md)
   to record `Task / Coordinate` with `action.kind: integrate` and the actual
   `integration_sha`.

8. Report the completed integration to Team Gizmo with:
   - The task branch and destination feature branch.
   - `task_sha` and `integration_sha`.
   - The combined validation commands and their results.

**Prohibited:** merge several worker branches concurrently or report a passing
feature based only on a successful Git merge.

**Required:** merge `task/parser`, verify its inclusion, and run the combined
checks. Record and report the passing integration before starting the next
completed branch in dependency order. If a check fails, report it to Gizmo and
leave dependent integration stopped.

### Resolve integration failures

1. If the merge conflicts, abort that attempt and confirm the integration
   worktree is clean:

   ```sh
   git -C "$feature_path" merge --abort
   git -C "$feature_path" status --short
   ```

   Report the outcome, `task_sha`, and `target_sha` to Gizmo. These identify both
   sides of the failed merge. Do not prepare a file inventory, copied diff, or
   repair plan; the assigned developer reads the commits and reproduces the conflict.
   If abort fails, report that error and retain the workspace. For another Git
   failure, report the same revisions and the actual error instead of calling it a conflict.
2. Gizmo assigns the two SHAs to the responsible team agent, which follows
   [task repair](task-commits.md#repair-the-assigned-revision), resolves the
   conflict, validates, and returns its committed SHA and readiness. The integration
   owner waits for Gizmo to supply that result before retrying integration.
3. If a merge succeeded but combined checks failed, keep the merged history.
   Report `task_sha`, `integration_sha`, the failed command, and its diagnostic
   or existing log reference. Git contains the code, not the check outcome.
   Gizmo supplies `integration_sha` as the worker's repair target; never abort
   a completed merge or reset the feature to reconstruct the task.

**Prohibited:** collect conflicting files and prescribe their edits before
Gizmo assigns a developer, or silently repair the conflict in the feature worktree.

**Required:** report “Merge conflict between task `<task_sha>` and target
`<target_sha>`; the merge was aborted and the checkout is clean.” Gizmo routes
those revisions to the developer, then returns the validated replacement SHA
for integration. No copied code or conflict dossier is needed.
