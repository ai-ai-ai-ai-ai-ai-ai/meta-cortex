# Agent Configuration

The host selects Gizmo Prime's model and reasoning effort; Prime selects and
reassesses workers and verifiers. Workers recommend changes to Prime. Follow the
[coordination architecture](coordination-state-machine.md) and supply the
[assignment context](../../AGENTS.md#assignment-context).

## Check host capacity

`host.max_total_agents` in [meta-cortex.toml](../../../meta-cortex.toml) is a
positive scheduling ceiling that includes the host, Prime, and all active agents.
It neither allocates slots nor requires the host to provide that many. Schedule
within both this ceiling and actual host limits; queue work when slots are full.
For example, three total slots allow the host, Prime, and one worker.

Use exposed capabilities, session metadata, and launch results to establish host
limits, including whether a reported limit counts the primary agent. Missing exact
capacity metadata alone is not a blocker: launch needed assignments within known
bounds and queue on exhaustion. Do not launch disposable agents to probe capacity.

Preserve the required delegation depth and coexistence. Report a concrete blocker
if the host or ceiling cannot support Host → Prime → worker; do not bypass Prime.
Carry known limits, unresolved capabilities, and scheduling decisions through
assignments, and reassess when the host or task changes. Use the active
[host reference](hosts/index.yaml) when host-specific mechanics are needed.

## Choose settings for the assignment

Honor the user's model, effort, cost, and latency constraints. Select the least
costly available combination likely to meet the assignment's quality requirements,
considering ambiguity, dependencies, correctness risk, and prior results. Assess
model capability and reasoning effort separately; choose per assignment, not by
role or language. There are no static role settings or framework model catalog.

Use supported explicit controls or assessed effective or inherited settings.
Record consequential choices, exceptions, and changes with their evidence and
reason in the assignment or existing continuation notes. Routine choices do not
require user tuning or a repeated settings report. If no available combination
meets the assignment and user constraints, report the concrete blocker.

Distinguish requested or configured settings and known inheritance from confirmed
runtime settings. Only host-returned runtime evidence confirms what ran; saved
configuration, a child's self-report, or elapsed time does not. State unavailable
confirmation when it limits a decision or a requested execution check.

## Reassess and change execution settings

Reassess after material scope changes, stalled progress, failed checks, or review
findings. Use the evidence to decide whether to repair the environment, clarify
the assignment, change settings, or retain a suitable worker. Record meaningful
continuation decisions with the triggering evidence and next acceptance checks.
Changing settings does not expand scope, reset applicable repair limits, or replace
[verification](agent-verification.md).

Reuse a suitable session. Apply a needed settings change only at a supported host
boundary. If replacement is necessary, establish that the old execution stopped
or finished, preserve its work and evidence, and follow
[ledger recovery](ledger-task-lifecycle.md#recovery-and-stale-work). Retain one
writer per workspace under the [local Git architecture](../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture).

## Approve host configuration

Consider a host change only for a task need or user request; occupied slots
usually call for scheduling. Identify the effective configuration and supported
setting through installed or official host documentation. Before approval, show
its exact path, current and proposed values, purpose, and restart requirement.

Use the [user-input skill](../agents/gizmo-prime/skills/user-input/SKILL.md) and
[capacity form](../agents/gizmo-prime/skills/user-input/examples/host-capacity.yaml)
for that concrete proposal. Reuse explicit authorization for the same change.
`allow_host_update` authorizes the shown edit; `keep_host_settings`, cancellation,
or unavailable input does not. Continue feasible work with existing settings or
report the blocked capability. Do not silently change the project ceiling.

Apply an approved change through a supported editor or parser, preserving
unrelated settings and comments, and verify the saved values. If activation
requires restart, retain the task and session delivery for resumption. Recheck
active capabilities before dependent launches; saving a setting does not expand
the running session. Unsupported or enforced settings remain limitations.

## Use the host speed setting

Speed belongs to the user's host session. Follow documented subagent inheritance
and activation rules; do not add a framework speed selector, alias, default,
translation layer, or launch tier override. Supported tiers describe availability,
not the selected speed. Do not assume that an existing child follows a parent
speed change, or promise a tier the selected model does not support.

Keep this selection policy here. Roles and skills link it instead of fixing model,
effort, or service-tier settings in framework configuration.
