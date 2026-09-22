# Cloud-Native Skill Knowledge Graph

## Cloud-native operations

- **File:** [Cloud-native operations](practices/cloud-native-operations.md).
- **Owns:** mutation scope, current-state inspection, operational credentials, recovery readiness, and live verification.
- **Does not own:** provider selection, project release procedures, or Kubernetes runtime rules.
- **Related:** [Project execution policy](../../../../docs/project-execution-policy.md), [Kubernetes runtime boundary](../kubernetes-skill/practices/kubernetes-runtime-boundary.md), [secret lifecycle](../../../../../security-team/docs/secret-lifecycle.md).

- **[cloud_native:scope](practices/cloud-native-operations.md#identify-the-target-and-current-state)**
  - Identify the intended project, account, region, and resource before mutation.
- **[cloud_native:current_state](practices/cloud-native-operations.md#identify-the-target-and-current-state)**
  - Read current state through supported provider tooling and review the proposed
    plan or diff when available.
- **[cloud_native:secret_lifecycle](practices/cloud-native-operations.md#protect-operational-credentials)**
  - Use scoped, short-lived identities where available, approved secret storage,
    and redacted output under the shared lifecycle requirements.
  - Follow project-owned rotation and revocation procedures.
- **[cloud_native:recovery](practices/cloud-native-operations.md#preserve-a-recovery-path)**
  - Prefer scoped, reversible changes when practical; identify the recovery owner
    and supported rollback path before impactful mutations.
- **[cloud_native:live_verification](practices/cloud-native-operations.md#verify-live-behavior)**
  - Verify required configuration and workload health after mutation.
  - Control-plane readiness alone does not establish serving behavior.
