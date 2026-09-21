# Site Reliability Engineering Team

Team Gizmo uses this directory to select owners for containers, cluster
workloads, and cloud-native operations.

## Agent catalog

- **[Docker specialist](docker-specialist/AGENTS.md)**
  - Dockerfiles, BuildKit builds, cache design, and container build evidence.
- **[Kubernetes specialist](kubernetes-specialist/AGENTS.md)**
  - Kubernetes workload manifests, execution-boundary review, and cloud-native operations.

## Assignment boundaries

Select the smallest specialist scope that owns the requested infrastructure
behavior. Each role loads its specialized skill or skills and the common coding
or security prerequisites selected by [skill composition](../../../skill-composition.md).
Application behavior, product domain rules, and user-facing design remain with
their owning teams. Team Gizmo retains cross-team coordination and delivery
decisions.

Return changed paths, validation evidence, and unresolved dependencies to Team
Gizmo. Keep provider-specific choices in the consuming project's instructions;
the distributable roles and skills remain portable.
