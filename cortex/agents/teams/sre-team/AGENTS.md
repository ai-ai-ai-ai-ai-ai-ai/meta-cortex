# Site Reliability Engineering Team

Team Gizmo uses this directory to select owners for containers, cluster
workloads, infrastructure provisioning, and cloud-native operations.

## Agent catalog

- **[Docker specialist](docker-specialist/AGENTS.md)**
  - Dockerfiles, BuildKit builds, cache design, and container build evidence.
- **[Kubernetes specialist](kubernetes-specialist/AGENTS.md)**
  - Kubernetes workload manifests and execution-boundary review.
- **[Cloud-native specialist](cloud-native/AGENTS.md)**
  - Portable cloud-native infrastructure and operational configuration.

## Assignment boundaries

Select the smallest specialist scope that owns the requested infrastructure
behavior. Each role loads its specialized skill and the common coding or
security prerequisites selected by [skill composition](../../../skill-composition.md).
Application behavior, product domain rules, and user-facing design remain with
their owning teams. Team Gizmo retains cross-team coordination and delivery
decisions.

Return changed paths, validation evidence, and unresolved dependencies to Team
Gizmo. Keep provider-specific choices in the consuming project's instructions;
the distributable roles and skills remain portable.
