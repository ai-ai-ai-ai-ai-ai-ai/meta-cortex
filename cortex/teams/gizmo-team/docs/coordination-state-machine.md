# Coordination Architecture

Meta-Cortex connects the user's objective to an evidenced result through one
Gizmo Prime coordinator and the specialists and independent verifiers it manages
directly. This document owns their coordination architecture. Agents choose how
to execute within the user's scope and applicable subject rules; the architecture
defines ownership and the results needed to make the next decision.

## Responsibilities and decisions

- **Host agent:** establishes project context, validates and retains delivery,
    checks host capacity, and launches Prime with the user's objective.
- **Gizmo Prime:** owns scope, acceptance criteria, and the final outcome.
    It selects and launches specialists, bounds assignments, schedules dependencies,
    evaluates results, and decides repairs, integration, delivery, and acceptance.
    Prime reports the combined result to the host.
- **Specialists and verifiers:** own technical execution or independent assessment
    within their assignments. They return results, findings, blockers, and
    recommendations directly to Prime; they do not assign peers or launch replacements.

The host launches or replaces Prime; Prime alone launches or replaces the feature's
workers and verifiers. The assigning agent chooses and reassesses model and effort
under [agent configuration](agent-configuration.md). Preserve the user's scope and
[stopping condition](../../../CIRCUIT-BREAKER.md#stop-when-the-requested-evidence-is-complete).

- **Prohibited:** a PR worker asks a developer to repair failing CI directly,
  or Prime inserts another coordinator to dispatch that repair.

- **Required:** the PR worker reports the revision, failed check, and diagnostic
  to Prime. Prime directly assigns the repair to its owner, evaluates the repair
  and review evidence, and reports the combined outcome to the host.

## Delegate execution without extra coordination

Prime delegates mechanical work directly to appropriate subagents: workspace
preparation, file edits, test and check execution, monitoring, integration, and
publication. Prime retains scope, scheduling, cross-role decisions, evaluation of
evidence, and final acceptance. Workers retain their technical decisions.

Choose only the specialists needed for an unmet acceptance criterion. Reuse a
suitable worker for follow-up work; do not split a small assignment into extra
coordinators or launch every cataloged role. Independent verification remains
separate when required by the [verification handoff](agent-verification.md).

- **Prohibited:** Prime runs a mechanical check itself, or adds a dispatcher
  between itself and the specialist to distribute a single repair.

- **Required:** Prime assigns the check or repair directly to a suitable worker,
  receives the evidence, and decides what it means for acceptance. Scale by adding
  bounded specialist assignments under Prime within available capacity.

## Describe each transition with an observable outcome

An assignment identifies the objective, permitted scope, inputs, expected evidence,
and next owner or dependency. Supply the [assignment context](../../AGENTS.md#assignment-context)
once, retain it on continuations, and communicate material changes. Choose task
boundaries and sequencing from the work; independent assignments can proceed
concurrently while overlapping writes and dependencies need explicit ownership.

Expected handoffs are:

- **Feature assignment:** the host supplies the user's objective, constraints,
    project context, and delivery choice to Prime. Prime defines acceptance criteria
    and directly supplies each specialist with its bounded scope, inputs, base,
    workspace, dependencies, and expected evidence.
- **Workspace preparation:** the owner returns usable paths, branches, starting
    revisions, and relevant inspection results. Implementation can begin; preparation
    alone does not complete integration.
- **Worker result:** the worker returns its committed revision, scope, actual
    validation, findings, and remaining work. Each writer has its own branch and
    worktree under the [local Git architecture](../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture).
- **Review:** the reviewer returns its assessment of the assigned revision,
    actionable findings, evidence, and limitations. Prime applies the cataloged
    [verification handoff](agent-verification.md), including required Rust
    architecture and simplification assessment, and decides the response.
- **Integration:** Prime's assigned integration owner integrates the reviewed revision
    into the shared feature branch and reports the resulting SHA and combined checks.
    Apply [reviewed integration](agent-verification.md#integrate-the-reviewed-revision);
    only one owner writes the shared feature workspace at a time.
- **Delivery and acceptance:** the owner returns the actual local result or PR,
    published revision, observed checks, and unresolved work under the
    [delivery policy](../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery).
    Prime compares the combined outcome with acceptance criteria. Preserve the
    user-owned feature worktree throughout.

Prime may send a result back for authorized repair, choose another specialist,
or proceed when the required evidence is sufficient. Changed revisions require
matching review and validation. Reuse applicable evidence; do not infer that a
ready report approves integration or that publication proves passing CI.

- **Prohibited:** call a clean merge “feature verified” despite a failed combined
  check, then publish it as complete because every worker reported success.

- **Required:** return the merge revision and failing check to Prime. It identifies
  the responsible repair, obtains evidence for the corrected result, and reports
  any unresolved delivery blocker to the host.

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
  is blocked by the unavailable test service. Gizmo Prime owns the next decision.”

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
