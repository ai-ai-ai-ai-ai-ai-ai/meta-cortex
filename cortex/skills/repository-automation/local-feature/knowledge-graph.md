# Local Feature Rule Map

## Local feature integration

- **Source:** [Local feature integration](practices/local-feature-integration.md).
- **Owns:** local branch and worktree mechanics, committed handoffs, merge
  ancestry, validation, recovery, and cleanup.
- **Excludes:** agent routing, language practices, publishing, and PR lifecycle.
- **Relationships:** handoff precedes integration; recovery preserves its
  ancestry requirements; cleanup requires successful integration and validation.

- **[local_feature:workspace](practices/local-feature-integration.md#establish-the-feature-workspace)**
  - Inspect existing state; resolve the selected base, defaulting to committed
    HEAD only when none is specified. No implicit fetch for local work.
  - Create an isolated feature workspace or verify an explicitly assigned one.
  - Preserve dirty inputs and report the exact base and paths.
- **[local_feature:isolation](practices/local-feature-integration.md#isolate-task-writes)**
  - Issue one task branch/worktree per write assignment from an accepted feature
    commit; order dependencies and permit independent work concurrently.
  - Use one integration writer and explicit source/library paths.
  - Read-only work needs no write branch and must not mutate a shared checkout.
- **[local_feature:handoff](practices/local-feature-integration.md#commit-and-hand-off-a-contribution)**
  - Commit only assigned scope and validate handed-off content.
  - Return branch, paths, base/tip SHAs, scope, checks, and limitations.
  - Freeze a clean task branch until explicit reassignment or cleanup.
- **[local_feature:integration](practices/local-feature-integration.md#integrate-accepted-commits-serially)**
  - Accept scope/evidence and serialize integration in dependency order.
  - Check feature state, frozen tip, base ancestry, and assignment diff,
    distinguishing accepted feature changes in repairs from new task changes.
  - Merge exact accepted tips, preserving ancestry; no squash, cherry-pick,
    or accepted-history rewriting. Resolve incompatible repository policy first.
  - Verify integrated ancestry and run combined checks on the resulting head.
- **[local_feature:recovery](practices/local-feature-integration.md#recover-without-discarding-work)**
  - Abort conflicts and verify restoration; preserve/report an abort failure.
  - Return conflict repairs to their owners using a merge of the current feature
    commit, then require a new validated handoff without rewriting task history.
  - Preserve failed integrated heads, pause dependents/cleanup, and use corrective
    commits or an authorized revert.
  - Resume from Git state and ancestry, with outstanding validation still required.
- **[local_feature:completion](practices/local-feature-integration.md#complete-and-clean-up)**
  - Verify all accepted tips and final validation; report missing checks.
  - Clean up only approved, integrated, clean, inactive task branches/worktrees;
    stop rather than force deletion when state has changed or Git refuses.
  - Retain the feature workspace and report final evidence; publishing and base
    branch integration remain outside this workflow.
