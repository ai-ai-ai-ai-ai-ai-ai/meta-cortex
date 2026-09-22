# Kubernetes Skill Knowledge Graph

## Kubernetes runtime boundary

- **File:** [Kubernetes runtime boundary](practices/kubernetes-runtime-boundary.md).
- **Owns:** workload execution, nested runtimes, runtime sockets, and build-service boundaries.
- **Does not own:** provider selection, the project's complete security posture, or build-cache design.
- **Related:** [Cloud-native operations](../cloud-native-skill/practices/cloud-native-operations.md), [project execution policy](../../../../docs/project-execution-policy.md).

- **[kubernetes:no_nested_runtime](practices/kubernetes-runtime-boundary.md#keep-container-execution-inside-the-pod-contract)**
  - Do not start nested runtimes or manage sibling containers from a workload.
- **[kubernetes:direct_execution](practices/kubernetes-runtime-boundary.md#keep-container-execution-inside-the-pod-contract)**
  - Use the project's selected Pod or Job image containing the runtime and tools
    needed to execute the workload directly.
- **[kubernetes:no_runtime_socket](practices/kubernetes-runtime-boundary.md#reject-runtime-sockets-host-paths-and-privilege)**
  - Do not mount host runtime sockets or use host paths or privilege to recreate a runtime.
  - Other host integrations require the project's explicit contract and security review.
- **[kubernetes:build_execution_separation](practices/kubernetes-runtime-boundary.md#keep-build-services-as-build-services)**
  - Call an explicitly provided build/export service only when the project allows it.
  - Build access does not authorize daemon runtime commands; execute the result as an ordinary workload.
- **[kubernetes:validation](practices/kubernetes-runtime-boundary.md#validate-the-execution-boundary)**
  - Inspect rendered manifests and scripts for commands, mounts, host paths, and security contexts.
  - Run available schema or server-side dry-run checks and report them separately from behavior tests.
