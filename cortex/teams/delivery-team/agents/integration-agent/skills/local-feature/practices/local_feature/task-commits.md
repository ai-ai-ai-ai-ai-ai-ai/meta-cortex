# Task Commits and Readiness

The assigned worker owns validation, commits, and readiness in its task worktree.
Use the assigned absolute `task_path` and branch `task_branch`. Report the result
to Team Gizmo. In single-agent mode, perform these responsibilities locally.

## Required actions

### Finish task work

The worker runs these steps in its assigned task worktree. `changed_path` is one
assigned repository-relative file path; `task_message` describes the finished change.
During longer work, save recoverable milestones and publish progress through the
[agent ledger protocol](../../../../../../../gizmo-team/docs/agent-ledger.md).
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
