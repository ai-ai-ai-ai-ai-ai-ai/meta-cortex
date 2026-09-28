# Local Feature Integration

Use ordinary Git branches and worktrees to combine finished tasks into a
validated local feature branch. Work proceeds from task completion to integration.

Command examples use shell variables supplied for the task: `repo_path`,
`base_branch`, `feature_branch`, `feature_path`, `task_branch`, and `task_path`.
Paths are absolute. Branch names follow the project's convention. Feature and
worker paths are separate directories outside the original checkout; all belong
to the same Git repository. Replace the variables with the assigned values.

In multi-agent mode, every report and question goes only to the assigning Team
Gizmo. Gizmo decides assignments, sequencing, and repairs and passes evidence
between agents. Worker steps below are performed by the worker assigned by
Gizmo, not by the integration agent. In single-agent mode, the current agent
performs these responsibilities locally.

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

**Preferred:** run feature creation once for `feature/editor`. Repeat task
creation for `task/parser` and `task/ui`, each with its own path. Both task
branches will merge into the same `feature/editor` branch.

### Finish task work

The worker runs these steps in its assigned task worktree. `changed_path` is one
assigned repository-relative file path; `task_message` describes the finished change.
During longer work, save recoverable milestones and publish progress through the
[agent ledger protocol](../../../../../../gizmo-team/docs/agent-ledger.md).
The steps below establish final readiness.

1. Check the branch and inspect pending changes:

   ```sh
   git -C "$task_path" branch --show-current
   git -C "$task_path" status --short
   git -C "$task_path" diff
   git -C "$task_path" diff --cached
   ```

   Confirm the branch is `task_branch`. Review tracked changes and inspect any
   new files listed by status. Keep unrelated files outside the task's changes.

2. Run the assigned task checks from `task_path`. Fix failures before reporting
   completion. Review any files modified by those checks before saving them.

3. Stage each assigned file explicitly, repeating `git add` for each path:

   ```sh
   git -C "$task_path" add -- "$changed_path"
   git -C "$task_path" diff --cached
   ```

   The staged diff must contain only the completed task changes. If it includes
   unrelated work, correct the staging selection before proceeding.

4. When the assignment requires one consolidated task commit, combine local
   checkpoints before committing. `task_base_sha` is the exact starting commit
   supplied by the integration owner; `task_message` describes the entire task.
   Confirm that the task branch is privately owned and that the commits being
   replaced after `task_base_sha` are unpublished and unintegrated. Do not rewrite
   shared, published, or already-integrated history. Stop and report an
   unexpected branch, unresolved merge, or unrelated staged content.

   ```sh
   git -C "$task_path" merge-base --is-ancestor "$task_base_sha" HEAD
   git -C "$task_path" diff --cached --check
   previous_task_sha=$(git -C "$task_path" rev-parse HEAD)
   validated_tree=$(git -C "$task_path" write-tree)
   ```

   Stop on any failed command. Record `previous_task_sha` and `validated_tree`
   in the task's continuation notes before consolidation:

   ```sh
   git -C "$task_path" reset --soft "$task_base_sha"
   git -C "$task_path" diff --cached --stat
   git -C "$task_path" diff --cached
   ```

   Soft reset moves only the task branch; it preserves
   the staged content and worktree. Review the resulting complete task diff.
   Never use `reset --hard`. Do not perform this consolidation in the feature
   worktree or during branch integration.

5. Save the reviewed changes on the task branch. If the staged diff is empty,
   skip `commit` and report the unchanged SHA. A consolidated task with no net
   change ends at its base and does not need a one-commit count or empty commit.
   Otherwise, run:

   ```sh
   git -C "$task_path" commit -m "$task_message"
   git -C "$task_path" status --short
   ```

   Capture the committed identity and tree:

   ```sh
   task_sha=$(git -C "$task_path" rev-parse --verify HEAD)
   git -C "$task_path" rev-parse "$task_sha^{tree}"
   git -C "$task_path" diff-tree --root --no-commit-id -r --name-status -z --find-renames "$task_sha" --
   ```

   For a consolidated commit, require its tree to equal the pre-reset index
   tree and verify exactly one commit with `task_base_sha` as its sole parent:

   ```sh
   committed_tree=$(git -C "$task_path" rev-parse "$task_sha^{tree}")
   test "$committed_tree" = "$validated_tree"
   git -C "$task_path" rev-list --count "$task_base_sha..$task_sha"
   git -C "$task_path" rev-list --parents -n 1 "$task_sha"
   ```

   Short status must be empty.
   If content changes after validation, rerun affected checks. Report the branch,
   absolute worktree, full `task_sha`, changed paths, and check results to Team
   Gizmo; identify unfinished work or failed checks. Keep check evidence tied to
   the validated tree and final SHA; consolidation does not itself run checks.
   For a consolidated handoff, run the assigned checks at the final SHA before
   recording readiness. Do not relabel an earlier commit's test log.
   Record the final checkpoint and durable readiness through the ledger before
   sending the completion notification.

   Use `Task / Update` with `action.kind: checkpoint` and `commit: task_sha`,
   then `action.kind: ready`, using each returned revision. Discover the exact
   typed request with `meta-cortex list`; Git commit alone does not record readiness.

**Prohibited:** report completion while final edits remain pending or required
checks have failed.

**Preferred:** inspect and save only the task's changes, verify clean status,
and report completion so branch integration can begin.
For a one-commit handoff, consolidate two private checkpoints into one task
commit before recording the final checkpoint. Send that final SHA, not either
superseded checkpoint.

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
   record the integrated task through the [feature ledger skill](../../agent-ledger/SKILL.md).

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
   and validation, consolidate the complete task again with the task-completion
   procedure. Repairs before integration retain the original base unless the
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
