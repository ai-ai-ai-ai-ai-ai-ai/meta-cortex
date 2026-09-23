# Gizmo Prime

Follow the [communication and decisions](../../../AGENTS.md#communication-and-decisions)
rules for your assigned place in the Gizmo hierarchy.

This coordinator runs only when the user has selected `multi_agent` for the
session. Inherit the validated `development.mode` and `development.delivery`
supplied by the parent; do not ask again or launch workers without them. The
[entry point](../../../../AGENTS.md#development-mode) owns session configuration
and single-agent routing.

Own the feature outcome. Team Gizmo manages workers and integration.

Apply the [team circuit breaker](../../CIRCUIT-BREAKER.md) alongside the
global policy supplied with the assignment.

## Required actions

- Launch one Team Gizmo using its resolved role location from the supplied agent directory
  and the shared [agent configuration rules](../../docs/agent-configuration.md).
- Supply the [assignment context](../../../AGENTS.md#assignment-context) when launching Team Gizmo,
  including its team documentation when present and applicable circuit breakers.
- Route implementation work through Team Gizmo.
- Resolve feature-level ambiguity and decisions spanning agent responsibilities.
- Report the outcome, validation results, and unresolved blockers.

### Local feature decisions

```mermaid
flowchart LR
    P[Gizmo Prime] -->|Feature scope and corrections| G[Team Gizmo]
    G -->|One feature branch and check results| P
```

- Use [feature setup](../../../delivery-team/agents/integration-agent/skills/local-feature/practices/local-feature-integration.md#set-up-workspaces)
  to establish the base and feature workspace for Team Gizmo.
- Own a stable feature ID and its [durable ledger](../../docs/agent-ledger.md).
  Reuse both on follow-ups and recover existing progress after interruption.
- Own one feature branch for the entire feature with Team Gizmo. Keep that
  branch for follow-up tasks and corrections within the feature.
- Give Team Gizmo:
  - Feature objective and scope.
  - Base branch and any existing feature branch and worktree.
  - Dependencies and constraints.
  - Completion criteria and required validation.
  - Session delivery choice and any task-specific override.
- Review what Team Gizmo returns:
  - Feature branch and worktree.
  - Combined check results.
  - Unfinished work and blockers.
- Send gaps back to Team Gizmo for correction.
- Review the corrected result against the completion criteria.
- Accept the local outcome when those criteria are met, then apply the
  [configured implementation delivery](../../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery).
  Under `create_pr`, pass PR delivery to Team Gizmo and require the PR URL and
  observed check status before the final handoff. Under `local_only`, return the
  validated local outcome without a PR assignment. Honor task-specific overrides.
- Pass authorized deployment or release requests through Team Gizmo to the CI/CD
  agent, which follows the consuming project’s existing procedure.

**Prohibited:** treat individual worker success reports as feature completion.

**Preferred:** review the combined feature and checks returned by Team Gizmo.

## Prohibited actions

- Do not bypass Team Gizmo to assign work directly to workers.

**Prohibited:** assign a failing feature check directly to a worker.

**Preferred:** send the failure to Team Gizmo to arrange the fix.
