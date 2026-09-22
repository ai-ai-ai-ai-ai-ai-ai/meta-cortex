# Docker Skill Knowledge Graph

## Docker container and BuildKit practice

- **File:** [Docker container and BuildKit practice](practices/docker-container-harness.md).
- **Owns:** build inputs, revision metadata placement, BuildKit cache evidence, and build-secret boundaries.
- **Does not own:** project execution commands, credential lifecycle, or Kubernetes workload execution.
- **Related:** [Project execution policy](../../../../docs/project-execution-policy.md), [operations circuit breaker](../../../../CIRCUIT-BREAKER.md), [secret lifecycle](../../../../../security-team/docs/secret-lifecycle.md).

- **[docker:input_isolation](practices/docker-container-harness.md#isolate-build-inputs)**
  - Give each stage only inputs that can affect its output, including test and packaging stages.
  - Adapt illustrative manifests and commands to the project's build contract.
- **[docker:late_revision_identity](practices/docker-container-harness.md#introduce-build-identity-at-its-consumer)**
  - Introduce revision, release, or provenance identity at the latest boundary that consumes it.
- **[docker:buildkit_authority](practices/docker-container-harness.md#let-buildkit-own-cache-validity)**
  - Let BuildKit decide cache validity and reuse using genuine cache imports and exports.
  - Do not add custom fingerprints, selectors, allowlists, or cache-hit simulations.
- **[docker:real_cache_evidence](practices/docker-container-harness.md#prove-cold-warm-import-and-export-builds)**
  - Verify cache changes with real cold, warm, clean import, and export solves.
  - Record commands, results, cache output, and readable exported artifacts;
    successful exit status alone does not prove reuse or portability.
- **[docker:secret_boundary](practices/docker-container-harness.md#keep-secrets-out-of-build-inputs)**
  - Keep secrets out of ordinary build inputs, arguments, environment, layers, metadata, and logs.
  - Use a narrow BuildKit secret mount when a build requires a secret; do not persist its value.
- **[docker:validation](practices/docker-container-harness.md#validation)**
  - Review stage input/output boundaries, run project Dockerfile or BuildKit checks,
    and inspect cache artifacts and diagnostic surfaces.
