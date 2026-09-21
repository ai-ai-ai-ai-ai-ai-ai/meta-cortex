# Local Feature Rule Map

## Local feature integration

- **Source:** [Local feature integration](practices/local-feature-integration.md).
- **Owns:** local branch and worktree mechanics, branch handoffs, integration,
  validation, recovery, and cleanup.
- **Excludes:** agent routing, language practices, publishing, and PR lifecycle.
- **Relationships:** handoff precedes integration; recovery preserves branch
  history; cleanup requires successful integration and validation.

- **[local_feature:workspace](practices/local-feature-integration.md#establish-the-feature-workspace)**
  - Use the selected base branch, otherwise the current checked-out branch.
    Resolve a missing branch choice; do not fetch implicitly for local work.
  - Create an isolated feature workspace or verify an explicitly assigned one.
  - Preserve dirty inputs and report branch names and paths.
- **[local_feature:isolation](practices/local-feature-integration.md#isolate-task-writes)**
  - Issue one task branch/worktree per write assignment from the validated feature
    branch; order dependencies and permit independent work concurrently.
  - Use one integration writer and explicit source/library paths.
  - Read-only work needs a stable source branch, not a write branch, and must not
    mutate a shared checkout.
- **[local_feature:handoff](practices/local-feature-integration.md#hand-off-a-task-branch)**
  - Save only assigned scope and validate the finished branch.
  - Return branch names, paths, scope, checks, and limitations; no revision
    identifiers or individual changeset lists as handoff inputs.
  - Freeze a clean task branch until explicit reassignment or cleanup.
- **[local_feature:integration](practices/local-feature-integration.md#integrate-accepted-branches-serially)**
  - Accept scope/evidence and serialize integration in dependency order.
  - Check feature state, frozen task branch, and assignment diff. Renew review
    if the branch changes; distinguish accepted feature changes in repairs.
  - Merge branches by name, preserving history; no squash, cherry-pick, or
    accepted-history rewriting. Resolve incompatible repository policy first.
  - Verify task branches are fully merged and run combined checks; branch changes
    invalidate affected validation.
- **[local_feature:recovery](practices/local-feature-integration.md#recover-without-discarding-work)**
  - Abort conflicts and verify restoration; preserve/report an abort failure.
  - Return conflict repairs to their owners, merging the feature branch into
    the task branch before renewed validation and handoff.
  - Preserve failed integration, pause dependents/cleanup, and use repair branches.
  - Resume from Git state and merged branches; outstanding validation still applies.
- **[local_feature:completion](practices/local-feature-integration.md#complete-and-clean-up)**
  - Verify all accepted branches are fully merged and complete feature validation.
  - Clean up only approved, fully merged, clean, inactive task branches/worktrees;
    stop rather than force cleanup when state has changed or Git refuses.
  - Retain the feature workspace and report branch names and validation results;
    publishing and base-branch integration remain outside this workflow.
