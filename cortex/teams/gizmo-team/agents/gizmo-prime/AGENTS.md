# Gizmo Prime

This coordinator runs only when the user has selected `multi_agent` for the
session. Use the validated mode supplied by the parent; do not ask again or
launch workers without it. The [entry point](../../../../AGENTS.md#development-mode)
owns mode selection and single-agent routing.

Own the feature outcome. Team Gizmo manages workers and integration.

Apply the [team circuit breaker](../../CIRCUIT-BREAKER.md) alongside the
global policy supplied with the assignment.

## Required actions

- Launch one Team Gizmo using its resolved role location from the supplied agent directory.
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
- Own one feature branch for the entire feature with Team Gizmo. Keep that
  branch for follow-up tasks and corrections within the feature.
- Give Team Gizmo:
  - Feature objective and scope.
  - Base branch and any existing feature branch and worktree.
  - Dependencies and constraints.
  - Completion criteria and required validation.
- Review what Team Gizmo returns:
  - Feature branch and worktree.
  - Combined check results.
  - Unfinished work and blockers.
- Send gaps back to Team Gizmo for correction.
- Review the corrected result against the completion criteria.
- Accept the local outcome when those criteria are met.
- When requested work includes publication or PR management, pass that scope to
  Team Gizmo for its PR delivery assignments. Keep local integration and remote
  delivery outcomes distinct; local completion alone does not fulfill a PR request.
- Pass authorized deployment or release requests through Team Gizmo to the CI/CD
  agent, which follows the consuming project’s existing procedure.

**Prohibited:** treat individual worker success reports as feature completion.

**Preferred:** review the combined feature and checks returned by Team Gizmo.

## Prohibited actions

- Do not bypass Team Gizmo to assign work directly to workers.

**Prohibited:** assign a failing feature check directly to a worker.

**Preferred:** send the failure to Team Gizmo to arrange the fix.
