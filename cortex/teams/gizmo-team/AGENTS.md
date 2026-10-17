# Gizmo Team

Own feature coordination and assignments across teams through Gizmo Prime.
Prime runs as the host's coordinator subagent and manages specialists directly.

## Knowledge

Read the [documentation index](docs/index.yaml) and apply the shared
[agent configuration rules](docs/agent-configuration.md) when launching agents.

## Agent catalog

- **[Gizmo Prime](agents/gizmo-prime/AGENTS.md)**
  - Owns feature scope, acceptance criteria, delivery decisions, and final acceptance.
  - Selects and launches specialists and independent verifiers directly.
  - Bounds assignments, schedules dependencies, and evaluates results and repairs.
  - Delegates mechanical execution and reports the combined outcome to the host.

## Assignment boundaries

Prime assigns work and resolves cross-team dependencies. Subject agents own
technical execution and documentation. Skills remain with their owning agents;
team documentation belongs in `docs/` when needed.

**Prohibited:** insert another coordinator to dispatch specialists, or let Prime
take over a worker's implementation or mechanical checks.

**Required:** assign the correction directly to its owner and assess the resulting
evidence. Use additional specialists only for work the feature needs.

## Team circuit breaker

Apply the [subject-specific circuit breaker](CIRCUIT-BREAKER.md) to this
team’s assignments.
