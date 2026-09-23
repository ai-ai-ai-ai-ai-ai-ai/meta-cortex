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

**Preferred:** return the validated feature branch to Gizmo for the PR role's
next step under [default implementation delivery](../../../../docs/project-delivery-policy.md#default-implementation-delivery).
In single-agent mode, switch to the PR skill after completing local integration.
