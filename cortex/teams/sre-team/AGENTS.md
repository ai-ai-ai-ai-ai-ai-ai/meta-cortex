# Site Reliability Engineering Team

Team Gizmo uses this directory to select owners for containers, cluster
workloads, CI/CD, and cloud-native operations. Apply the
[SRE knowledge](docs/index.md) to discover the consuming project’s execution
contract. In single-agent mode, the current agent uses the relevant role directly.

## Agent catalog

- **[Docker specialist](agents/docker-specialist/AGENTS.md)**
  - Dockerfiles, BuildKit builds, cache design, and container build evidence.
- **[Kubernetes specialist](agents/kubernetes-specialist/AGENTS.md)**
  - Kubernetes workload manifests, execution-boundary review, and cloud-native operations.

- **[CI/CD agent](agents/cicd-agent/AGENTS.md)**
  - Status: implemented role instructions and CI/CD Operations skill.
  - Runs existing checks, investigates failures, and repairs assigned workflow infrastructure.
  - Executes authorized deployments and releases through existing project procedures.
  - Excludes PR management, product fixes, build-system selection, and defining release pipelines.

## Assignment boundaries

Select the smallest specialist scope that owns the requested infrastructure
behavior. Each agent loads the skills and prerequisites defined in its own
`AGENTS.md`.
Application behavior, product domain rules, and user-facing design remain with
their owning teams. Team Gizmo retains cross-team coordination and delivery
decisions.

Return changed paths, validation evidence, and unresolved dependencies to Team
Gizmo. Keep provider-specific choices in the consuming project's instructions;
the distributable roles and skills remain portable.

## Team circuit breaker

Apply the [subject-specific circuit breaker](CIRCUIT-BREAKER.md) to this
team’s assignments.
