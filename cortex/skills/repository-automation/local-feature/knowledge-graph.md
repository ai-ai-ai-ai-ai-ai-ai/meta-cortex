# Local Feature Rule Map

## Local feature integration

- **Source:** [Local feature integration](practices/local-feature-integration.md).
- **Owns:** local branches, worktrees, integration, validation, and cleanup.
- **Excludes:** agent routing, language practices, publishing, and PR lifecycle.
- **Relationships:** task completion precedes integration; validation precedes cleanup.

- **[local_feature:workspace](practices/local-feature-integration.md#set-up-workspaces)**
  - Preserve existing work; use the selected base branch or current checked-out
    branch, resolving a missing choice without an implicit fetch.
  - Create or reuse the assigned feature workspace and isolate each write task.
  - Order dependent tasks; supply scopes, branch names, paths, checks, and the
    actual library location. Read-only work needs no write workspace.
- **[local_feature:completion](practices/local-feature-integration.md#finish-task-work)**
  - Save assigned changes on the task branch and validate finished content.
  - Finish with a clean worktree and report completion or outstanding problems.
- **[local_feature:integration](practices/local-feature-integration.md#integrate-finished-branches)**
  - Integrate finished branches in dependency order with one feature writer.
  - Use a clean feature worktree and resolve unfinished Git operations first.
  - Inspect scope and merge branches by name, preserving history; resolve
    incompatible merge policy rather than substituting squash or history rewriting.
  - Validate combined changes and report merged tasks and check results.
- **[local_feature:repair](practices/local-feature-integration.md#resolve-integration-failures)**
  - Abort conflicts and return them to their owners for task-branch repair.
  - Retain branches on failure; integrate repairs and revalidate before dependent
    work or cleanup. Preserve and report Git state if an operation cannot finish.
- **[local_feature:cleanup](practices/local-feature-integration.md#complete-and-clean-up)**
  - Verify task branches are fully merged and complete feature validation.
  - Remove only finished workspaces using ordinary Git; retain active or unmerged
    branches and stop rather than force cleanup.
  - Keep the feature workspace and report branch locations, merged tasks, checks,
    and unfinished work. Publishing and base-branch integration remain separate.
