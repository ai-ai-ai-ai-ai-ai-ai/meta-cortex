---
name: local-feature
description: Manage local Git feature branches, isolated task worktrees, integration, and safe cleanup. Use for local repository changes; excludes publishing and pull requests.
---

# Local Feature Work

Produce a validated local feature branch using ordinary Git and the host's
coordination tools. This skill owns the integration agent’s Git procedures;
role instructions define assignments and communication.

## Required actions

- Apply [feature ledger integration](../agent-ledger/SKILL.md) for durable
  feature setup and integration records.
- Load the procedure for the assigned pipeline stage:
  - [Workspace setup](practices/local_feature/workspace-setup.md): the integration owner prepares branches and worktrees.
  - [Task commits](practices/local_feature/task-commits.md): the worker repairs assigned revisions, validates, commits, and records readiness.
  - [Branch integration and repairs](practices/local_feature/branch-integration.md): merge completed tasks, run combined checks, and recover failures.
  - [Cleanup](practices/local_feature/cleanup.md): remove completed worker workspaces after validation.
- For an integration assignment that requires a passing review, also apply
  [reviewed-task integration](spec/reviewed-integration.md). It owns the SHA
  gate and renewed review after repairs; worker commit instructions remain in
  the ordinary task-commit procedure.
- Use the [rule map](index.yaml) to locate individual decisions when
  reviewing or changing these practices.

**Prohibited:** have the integration role take over remote publishing, or publish
despite an explicit local-only instruction.

**Required:** return the validated feature branch to Gizmo for
[configured implementation delivery](../../../../docs/project-delivery-policy.md#configured-implementation-delivery).
Under `create_pr`, continue to the PR role; in single-agent mode, apply the PR
skill locally. Under `local_only`, finish with the validated local outcome.
