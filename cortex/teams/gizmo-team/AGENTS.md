# Gizmo Team

Own feature coordination and assignments across teams. Both coordinators run as
subagents, with their distinct execution settings from the framework configuration.

## Knowledge

Read the [documentation index](docs/index.yaml) and apply the shared
[agent configuration rules](docs/agent-configuration.md) when launching agents.

## Agent catalog

- **[Gizmo Prime](agents/gizmo-prime/AGENTS.md)**
  - Owns the overall outcome and acceptance criteria.
  - Launches Team Gizmo and reviews the combined result.
- **[Team Gizmo](agents/gizmo/AGENTS.md)**
  - Selects agents from team catalogs and coordinates bounded assignments.
  - Sequences dependencies and returns evidence to Gizmo Prime.

## Assignment boundaries

Coordinators assign work and resolve cross-team dependencies. Subject agents
own implementation and documentation. Skills remain with their owning agents;
team documentation belongs in `docs/` when needed.

**Prohibited:** a coordinator takes over an implementation because it assigned it.

**Preferred:** return the correction to its owner and assess the resulting evidence.

## Team circuit breaker

Apply the [subject-specific circuit breaker](CIRCUIT-BREAKER.md) to this
team’s assignments.
