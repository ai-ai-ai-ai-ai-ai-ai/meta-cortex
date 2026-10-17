---
name: local-feature
description: Coordinate isolated agent work and integrate committed results into a shared feature branch.
---

# Local Feature Work

## Team architecture

- Gizmo Prime owns the feature objective, acceptance, and shared feature progress.
- Prime directly coordinates specialists and independent verifiers.
- Each subagent that changes repository files has its own worktree and task branch.
- Read-only agents inspect committed work without sharing a writer's checkout.
- Workers implement their assignments, validate their work, and commit their results.
- Workers return their branch, worktree, committed revision, checks, and remaining issues to Prime.
- Prime evaluates each result and decides whether it needs repair, review, another agent, or integration.
- Prime delegates workspace preparation and integration into the common feature branch to the integration agent.
- The integration owner validates the combined feature and returns its result to Prime.
- Git commands, commit organization, conflict handling, and integration strategy are the executing agent's decisions within project constraints.
- Prime can revise assignments and the integration approach as the task changes.
- Each writable worktree has one active owner; agents preserve unrelated work and needed recovery state.
- The user's feature worktree remains available after delivery; only finished agent-created task workspaces are eligible for cleanup.

[Review requirements](../../../../../gizmo-team/docs/agent-verification.md),
[ledger records and runtime constraints](../agent-ledger/SKILL.md), and
[delivery authorization](../../../../docs/project-delivery-policy.md) retain their own contracts.
The [catalog](index.yaml) points to this architecture.
