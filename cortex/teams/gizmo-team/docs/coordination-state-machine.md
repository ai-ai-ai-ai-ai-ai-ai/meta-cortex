# Coordination Architecture

Meta-Cortex connects the user's objective to an evidenced result through Gizmo
Prime, one Team Gizmo, and the workers that Team Gizmo assigns. This document owns
their coordination architecture. Agents choose how to execute within the user's
scope and applicable subject rules; the architecture defines ownership and the
results needed to make the next decision.

## Responsibilities and decisions

- **Host agent:** retains the user's session choices and launches Prime in
    multi-agent mode. Single-agent mode performs the responsibilities in the current
    thread without claiming that separate agents ran.
- **Gizmo Prime:** owns feature scope, acceptance criteria, and the final outcome.
    It assigns the feature to one Team Gizmo and resolves decisions spanning roles.
- **Team Gizmo:** selects workers, bounds assignments, coordinates dependencies,
    evaluates results, and decides repairs, additional work, integration, and delivery.
    It reports the combined result to Prime.
- **Workers:** own technical decisions and execution within their assignments.
    They return results, findings, blockers, and recommendations to Team Gizmo;
    they do not assign peers or launch replacements.

Decisions travel down that hierarchy; results and questions travel back up it.
The assigning agent chooses and reassesses model and effort under
[agent configuration](agent-configuration.md). Preserve the user's scope and
[stopping condition](../../../CIRCUIT-BREAKER.md#stop-when-the-requested-evidence-is-complete).

- **Prohibited:** a PR worker asks a developer to repair failing CI directly,
  or Prime bypasses Team Gizmo to dispatch that repair.

- **Required:** the PR worker reports the revision, failed check, and diagnostic to
  Team Gizmo. Gizmo decides the needed assignment and settings, receives the repair
  and validation, and returns the combined outcome to Prime.

## Describe each transition with an observable outcome

An assignment identifies the objective, permitted scope, inputs, expected evidence,
and next owner or dependency. Supply the [assignment context](../../AGENTS.md#assignment-context)
once, retain it on continuations, and communicate material changes. Choose task
boundaries and sequencing from the work; independent assignments can proceed
concurrently while overlapping writes and dependencies need explicit ownership.

Expected handoffs are:

- **Feature assignment:** Prime supplies scope, acceptance criteria, base and
    feature workspace, dependencies, and delivery choice. Team Gizmo can schedule
    bounded work against those criteria.
- **Workspace preparation:** the owner returns usable paths, branches, starting
    revisions, and relevant inspection results. Implementation can begin; preparation
    alone does not complete integration.
- **Worker result:** the worker returns its committed revision, scope, actual
    validation, findings, and remaining work. Each writer has its own branch and
    worktree under the [local Git architecture](../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture).
- **Review:** the reviewer returns its assessment of the assigned revision,
    actionable findings, evidence, and limitations. Gizmo applies the cataloged
    [verification handoff](agent-verification.md), including required Rust
    architecture and simplification assessment, and decides the response.
- **Integration:** Gizmo or its assigned owner integrates the reviewed revision
    into the shared feature branch and reports the resulting SHA and combined checks.
    Apply [reviewed integration](agent-verification.md#integrate-the-reviewed-revision);
    only one owner writes the shared feature workspace at a time.
- **Delivery and acceptance:** the owner returns the actual local result or PR,
    published revision, observed checks, and unresolved work under the
    [delivery policy](../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery).
    Prime compares the combined outcome with acceptance criteria. Preserve the
    user-owned feature worktree throughout.

Gizmo may send a result back for authorized repair, choose another specialist,
or proceed when the required evidence is sufficient. Changed revisions require
matching review and validation. Reuse applicable evidence; do not infer that a
ready report approves integration or that publication proves passing CI.

- **Prohibited:** call a clean merge “feature verified” despite a failed combined
  check, then publish it as complete because every worker reported success.

- **Required:** return the merge revision and failing check to Gizmo. It identifies
  the responsible repair, obtains evidence for the corrected result, and reports
  any unresolved delivery blocker to Prime.

## Write useful human messages

Messages should make the result and next decision clear. Identify the task and
instance when needed, explain the operation or finding, and include material
revisions, paths, evidence, and blockers. Reuse established context instead of
repeating a full assignment on every update. No fixed message envelope is required.

Persist assignments, milestones, decisions, and continuation notes in the
[ledger](agent-ledger.md) before handoff. Host messages notify recipients; they do
not replace durable progress. Separate plans from observed execution and preserve
historical facts. Reading a role or recording its assignment does not launch it.

- **Prohibited:** “RustDev started implementation” when only its queued assignment
  was recorded, or “all done” when a review remains blocked.

- **Required:** “RustDev is assigned the repair; launch is pending.” After execution:
  “Repair committed at the supplied SHA; the focused test passed. Full verification
  is blocked by the unavailable test service. Team Gizmo owns the next decision.”

## Distinguish recorded results

A feature objective, task lifecycle, host instance, workspace, review report, and
delivery result describe different facts. The [task protocol](ledger-task-lifecycle.md)
owns durable transitions and recovery; [state meanings](homeostat-dashboard.md#recorded-state-meanings)
own their limits. Event order does not replace task revision or claim identity.
Do not implement this architecture as another ledger, lifecycle enum, message
validator, or workflow service.

- **Prohibited:** infer a running host process from a working task, or PR delivery
  from an integrated task.

- **Required:** report the recorded activity and its evidence precisely; obtain
  host execution and publication results from the tools that performed them.
