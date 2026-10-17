# Coordination Architecture

One Gizmo Prime coordinates specialists and independent verifiers directly.
This document owns decision authority and handoff expectations; subject rules
govern technical work within the user's scope.

## Responsibilities and decisions

- **Host:** establishes project context, validates and retains delivery, checks
  capacity, and launches Prime with the user's objective.
- **Prime:** owns scope, acceptance criteria, scheduling, cross-role decisions,
  and final acceptance. It launches bounded assignments, evaluates results, and
  decides repairs, integration, and delivery, then reports to the host.
- **Specialists and verifiers:** own technical execution or independent assessment.
  They return results, findings, blockers, and recommendations directly to Prime.

Only the host launches or replaces Prime; only Prime launches or replaces its
workers and verifiers. Workers do not assign peers. The assigning agent owns
[execution settings](agent-configuration.md). Preserve the user's scope and
[stopping condition](../../../CIRCUIT-BREAKER.md#stop-when-the-requested-evidence-is-complete).

## Delegate execution without extra coordination

Prime delegates mechanical work directly to appropriate subagents: workspace
preparation, edits, tests and checks, monitoring, integration, and publication.
Prime retains scope, scheduling, cross-role decisions, evidence evaluation, and
acceptance; workers retain technical decisions.

Choose specialists for unmet acceptance criteria and reuse suitable workers.
Do not insert another coordinator or launch every cataloged role. Required
[independent verification](agent-verification.md) retains its separate verifier.

## Describe each transition with an observable outcome

Supply the [assignment context](../../AGENTS.md#assignment-context) once, retain it
on continuations, and communicate material changes. State the objective, permitted
scope, inputs, expected evidence, and next owner or dependency. Independent work
may proceed concurrently; sequence dependencies and assign overlapping writes.

- **Feature assignment:** host supplies objective, constraints, context, and
  delivery to Prime; Prime supplies each specialist's scope, base, workspace,
  dependencies, and evidence requirements.
- **Workspace preparation:** usable paths, branches, starting revisions, and
  inspection results; preparation does not complete integration.
- **Worker result:** committed revision, scope, actual validation, findings,
  and remaining work.
- **Review:** assessment of the assigned revision, actionable findings, evidence,
  and limitations under the [verification handoff](agent-verification.md).
- **Integration:** reviewed revision integrated by the assigned owner, resulting
  SHA, and combined checks.
- **Delivery:** actual local result or PR, published revision, observed checks,
  and unresolved work under the [delivery policy](../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery).
- **Acceptance:** Prime compares the combined result and delivery with acceptance
  criteria and reports to the host.

Apply [local Git ownership](../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture):
isolate writers and allow only one owner of the shared feature workspace at a
time. Preserve the user-owned feature worktree. Apply
[reviewed integration](agent-verification.md#integrate-the-reviewed-revision)
to changed revisions; reuse evidence only when it applies. Worker readiness does
not approve integration, and publication does not prove passing CI.

## Write useful human messages

Explain the result and next decision, with material revisions, paths, evidence,
and blockers. Identify the task and instance when needed; reuse established
context. No fixed message envelope is required.

Persist assignments, milestones, decisions, and continuation notes in the
[ledger](agent-ledger.md) before handoff. Host messages notify recipients; they do
not replace durable progress. Separate plans from observed execution: recording
an assignment or reading a role does not launch it.

## Distinguish recorded results

The [task protocol](ledger-task-lifecycle.md) owns transitions and recovery;
[recorded state meanings](homeostat-dashboard.md#recorded-state-meanings) own their
limits. Event order, task revision, claim identity, host execution, and delivery
are distinct facts. Obtain execution and publication evidence from their tools.
Do not add another ledger, lifecycle enum, message validator, or workflow service
for this architecture.
