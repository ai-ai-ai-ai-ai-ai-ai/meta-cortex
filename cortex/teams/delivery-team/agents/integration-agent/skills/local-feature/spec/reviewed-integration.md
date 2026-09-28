# Integrate a Reviewed Task

Use this protocol when Gizmo requires a passing review before integration.
It owns the review gate and replacement-review requirements. The
[local feature practice](../practices/local-feature-integration.md) owns task
commits, workspaces, merges, conflict recovery, combined checks, and cleanup.
Workers receive that ordinary Git procedure; they do not need this protocol.

## Required actions

### Match the reviewed commit before merging

1. Receive Gizmo's passing report and integration assignment. Use these inputs:
   - `reviewed_sha`: full commit SHA from the passing report.
   - `checkpoint_sha`: full SHA from the developer's current ready ledger record.
   - `task_path` and `task_branch`: assigned worker worktree and branch.
   - `feature_path`: assigned integration worktree.
   - `task_base_sha`: assigned consolidation base for a one-commit handoff.
   Do not obtain the review verdict by interpreting ledger readiness as approval.
2. Perform the checkout, cleanliness, and scope checks in steps 1–3 of
   [branch integration](../practices/local-feature-integration.md#integrate-finished-branches).
   Keep the worker branch stable. Immediately before its merge, run:

   ```sh
   task_sha=$(git -C "$task_path" rev-parse --verify HEAD)
   branch_sha=$(git -C "$feature_path" rev-parse --verify "refs/heads/$task_branch")
   test "$task_sha" = "$branch_sha"
   test "$task_sha" = "$checkpoint_sha"
   test "$task_sha" = "$reviewed_sha"
   ```

   Require every command to succeed and the task to remain ready and clean.
   A missing report or mismatched SHA stops integration. Return it to Gizmo;
   do not substitute the latest branch head for the reviewed SHA.
3. For a one-commit handoff, repeat the count and sole-parent checks from
   [task completion](../practices/local-feature-integration.md#finish-task-work)
   against the assigned `task_base_sha`. Require exactly one task commit with
   that base as its sole parent. Return an unconsolidated handoff to Gizmo.
4. Only after the gate passes, continue the ordinary branch-integration
   procedure at its merge step. Preserve the reviewed commit without squashing
   or rebasing it during integration. Run combined checks and record the actual
   feature SHA through the existing ledger procedure.

**Prohibited:** merge a replacement branch head because the previous commit's
report passed, or treat a complete `changes_required` report as approval.

**Preferred:** match the passing report, current task head, branch ref, and ready
checkpoint before merging. Report the actual integration SHA and combined checks
separately; a task review does not establish that the combined feature passed.

### Require a new review after repairs

1. Use ordinary
   [integration failure recovery](../practices/local-feature-integration.md#resolve-integration-failures)
   for Git conflicts or failed combined checks. Return the repair context to
   Gizmo; the assigned developer owns implementation corrections and commits.
2. When repairs, conflict resolution, or consolidation produce a replacement
   task SHA, require Gizmo to obtain a complete review of that SHA before retrying
   integration. Never reuse the old report or checkpoint as approval.
3. Repeat this protocol with the replacement passing report and ready checkpoint.
   Preserve already-integrated history using the ordinary repair procedure.
   A repair made after an earlier merge also needs its own reviewed SHA.

**Prohibited:** resolve a conflict, record a new commit, and merge it using the
pre-conflict review because only a few lines changed.

**Preferred:** return the replacement checkpoint to Gizmo for a new complete
review, then repeat the matching-SHA gate before retrying integration.
