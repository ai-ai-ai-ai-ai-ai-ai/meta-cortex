---
name: cicd-operations
description: Discover and run existing project CI checks, inspect GitHub Actions failures, repair assigned pipeline infrastructure, and execute authorized project-owned deployment procedures.
---

# CI/CD Operations

Apply the [project execution policy](../../../../docs/project-execution-policy.md) and
[operations circuit breaker](../../../../CIRCUIT-BREAKER.md) before execution.
Use existing project commands and the host's provider tools. For GitHub Actions,
use the GitHub connector or installed `gh` CLI with access to the requested
repository. Missing tools or credentials are explicit blockers.

In multi-agent mode, report all outcomes, questions, and work outside the assigned
scope only to the assigning Team Gizmo. Gizmo decides further work and routing.
In single-agent mode, perform the applicable responsibilities locally.

## Required actions

### Execute the requested validation

1. Discover the project execution contract using the project execution policy. Resolve the
   check scope, source branch or revision, workflow, inputs, and execution venue.
   Do not run local substitutes when hosted results are required.
2. Inspect existing matching runs before dispatching. Reuse a run that covers
   the requested revision and scope. Do not launch another copy merely because
   a different agent is now observing it.
3. Trigger the project's supported event or command. For GitHub, inspect whether
   validation starts on a push, PR event, label, or manual dispatch. Supply the
   documented inputs and ref; do not fabricate a dispatch for a workflow that
   does not support it. Local validation uses the documented directory and tool.
4. Resolve the resulting run and source actually checked out. A successful
   dispatch is not a successful test, and a moving branch name is not proof of
   the tested revision. Include the run attempt when distinguishing reruns.
5. Observe through the provider's existing status/watch tools with bounded,
   interruptible waits. Respect its concurrency and cancellation behavior; do
   not build a local queue or cancel unrelated work. Report access failures,
   pending approvals, missing runs, and timeouts explicitly.
6. Collect the full requested check inventory and terminal outcomes. Preserve
   failed, cancelled, skipped, and missing results instead of collapsing them
   into success. Return run URLs, tested revision, check outcomes, and relevant
   artifacts to the assigning Team Gizmo, which decides the next step.

**Prohibited:** report validation passed when a workflow was merely dispatched,
when it tested an older head, or when only a build completed without tests.

**Preferred:** identify the actual tested revision and every requested check's
result, with a link to the run and any checks still unresolved.

### Diagnose and repair failures

1. Read failed-job logs and the relevant test reports or artifacts. Distinguish
   an application defect from workflow, runner, permission, or artifact wiring.
2. Report application failures with diagnostic and reproduction context to the
   assigning Team Gizmo for a repair decision. For assigned infrastructure repairs, inspect the affected project
   files and load the applicable programming or specialist skill before editing.
3. Preserve trust boundaries for forks, secrets, environments, and artifacts.
   Use [security knowledge](../../../../../security-team/docs/index.md) when the
   repair affects secret handling. Load Docker or Kubernetes expertise only when
   the failure reaches that subject.
4. Rerun only when a repair, diagnosed transient failure, or explicit request
   justifies it. Use the existing provider's rerun capability and the project's
   check policy. Do not retry deterministic failures until a run turns green.
5. Verify the resulting run and report what changed, its tested source, and the
   remaining failures. Keep prior failures visible rather than relabeling them.

**Prohibited:** delete a required check or expose secrets to a fork to repair a
permission failure.

**Preferred:** correct the assigned workflow boundary, preserve the required
checks, and verify the repaired execution through the existing provider.

### Execute an existing deployment or release procedure

1. Confirm the authorized operation, target environment, source revision or
   artifact, and the project's existing procedure. Reuse session authorization;
   PR publication or green checks alone do not authorize production changes.
2. Follow that procedure's prerequisites, approvals, versioning, artifact, and
   rollback rules. If they are absent or contradictory, report the missing
   project decision. Do not invent or install a Meta-Cortex release pipeline.
3. Invoke the existing operation and observe its terminal result. Honor provider
   environment approvals and ordering. A dispatch acknowledgment is not delivery.
4. Verify the target reports the expected revision or artifact using the project's
   documented verification. Report a deterministic mismatch rather than hiding
   an ordering defect with repeated probes or an unrequested rollback.
5. Return the operation/run URL, target, actual result, and verification evidence.
   If it fails, report the failure and project-prescribed recovery options;
   perform recovery only within the authorized scope.

**Prohibited:** merge a PR and automatically publish a release using a guessed
version, environment, and workflow.

**Preferred:** execute the separately requested project release procedure and
verify its documented outcome without changing the project's release design.
