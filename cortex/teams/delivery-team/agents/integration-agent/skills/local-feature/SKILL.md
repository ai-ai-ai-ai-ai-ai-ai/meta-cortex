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
- Read [local feature integration](practices/local-feature-integration.md)
  before creating task worktrees or integrating changes.
- Use the [rule map](index.md) to locate individual decisions when
  reviewing or changing this practice.

**Prohibited:** have the integration role take over remote publishing, or publish
despite an explicit local-only instruction.

**Preferred:** return the validated feature branch to Gizmo for
[configured implementation delivery](../../../../docs/project-delivery-policy.md#configured-implementation-delivery).
Under `create_pr`, continue to the PR role; in single-agent mode, apply the PR
skill locally. Under `local_only`, finish with the validated local outcome.
