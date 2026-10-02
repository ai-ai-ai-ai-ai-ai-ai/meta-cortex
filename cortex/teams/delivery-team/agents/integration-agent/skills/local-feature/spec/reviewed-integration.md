# Integrate a Reviewed Task

Use this protocol when Gizmo requires a passing review before integration.
It owns the integration gate and replacement-review requirements. The shared
[verifier protocol](../../../../../../gizmo-team/docs/verifier-protocol.md)
owns index-only practice loading, exhaustive coverage, and the passing verdict.
The [local feature catalog](../practices/local_feature/index.yaml) links the task
commit, workspace, integration, repair, and cleanup procedures.
Workers receive the relevant ordinary Git procedure; they do not need this protocol.

## Required actions

### Require complete review evidence

1. Receive the complete report saved in
   `progress.extensions.verification_report` and its matching `review_result`
   from Gizmo. Apply the shared protocol's
   [report requirements](../../../../../../gizmo-team/docs/verifier-protocol.md#save-one-complete-report)
   and [verdict rules](../../../../../../gizmo-team/docs/verifier-protocol.md#return-the-result-and-route-it).
2. Check that the report inventories the verifier's complete declared catalog
   snapshot, every changed file, every owned rule, and every cross-rule check.
   Reconcile every reachable catalog entry and its IDs with that snapshot,
   using YAML indexes without loading practice Markdown. Derive expected keys
   from the complete catalog and committed file inventory, not only the rules
   the report chose to list.
   Require the actual decisions and evidence, with exactly one decision for
   every expected rule/file pair and cross-rule check. Compare exact keys as
   well as counts; a skipped rule or duplicated row blocks integration.
3. Require `pass`, no violations or blockers, satisfied exact-revision validation,
   and fresh evidence that every previous repair is fixed. A ready review task,
   matching SHA, or "all practices checked" summary cannot replace this evidence.
4. Return missing or inconsistent evidence to Gizmo before merging. Do not
   reconstruct the review by loading the target worker's context or practice
   Markdown; the verifier completes any missing decisions under the shared
   index-only protocol. Continue to the SHA gate only after this evidence passes.

**Prohibited:** merge a matching SHA when the report omits WASM rules, or accept
a writing review that lists practice filenames without individual decisions.

**Required:** return either incomplete report to Gizmo, obtain the full coverage
and evidence for that SHA, then apply the matching-commit gate below.

### Match the reviewed commit before merging

1. Use Gizmo's complete passing report and integration assignment after the
   evidence gate above. Use these inputs:
   - `reviewed_sha`: full commit SHA from the passing report.
   - `checkpoint_sha`: full SHA from the worker's current ready ledger record.
   - `task_path` and `task_branch`: assigned worker worktree and branch.
   - `feature_path`: assigned integration worktree.
   - `task_base_sha`: assigned consolidation base for a one-commit handoff.
   Do not obtain the review verdict by interpreting ledger readiness as approval.
2. Perform the checkout, cleanliness, and scope checks in steps 1–3 of
   [branch integration](../practices/local_feature/branch-integration.md#integrate-finished-branches).
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
   [task completion](../practices/local_feature/task-commits.md#finish-task-work)
   against the assigned `task_base_sha`. Require exactly one task commit with
   that base as its sole parent. Return an unconsolidated handoff to Gizmo.
4. Only after the gate passes, continue the ordinary branch-integration
   procedure at its merge step. Preserve the reviewed commit without squashing
   or rebasing it during integration. Run combined checks and record the actual
   feature SHA through the existing ledger procedure.

**Prohibited:** merge a replacement branch head because the previous commit's
report passed, or treat a complete `changes_required` report as approval.

**Required:** match the passing report, current task head, branch ref, and ready
checkpoint before merging. Report the actual integration SHA and combined checks
separately; a task review does not establish that the combined feature passed.

### Require a new review after repairs

1. Use ordinary
   [integration failure recovery](../practices/local_feature/branch-integration.md#resolve-integration-failures)
   for Git conflicts or failed combined checks. Return the exact commit
   references and failure outcome to Gizmo; the assigned worker inspects
   those revisions and owns implementation corrections and commits.
2. When repairs, conflict resolution, or consolidation produce a replacement
   task SHA, require Gizmo to obtain a complete review of that SHA before retrying
   integration. Never reuse the old report or checkpoint as approval.
3. Repeat this protocol with the replacement passing report and ready checkpoint.
   Preserve already-integrated history using the ordinary repair procedure.
   A repair made after an earlier merge also needs its own reviewed SHA.

**Prohibited:** resolve a conflict, record a new commit, and merge it using the
pre-conflict review because only a few lines changed.

**Required:** return the replacement checkpoint to Gizmo for a new complete
review, then repeat the matching-SHA gate before retrying integration.
