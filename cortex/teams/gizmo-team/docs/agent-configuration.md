# Agent Configuration

[meta-cortex.toml](../../../meta-cortex.toml) sets the scheduling ceiling.
The launching agent chooses model and reasoning effort for each assignment from
the active host's supported combinations. There are no static role settings or
framework model catalog. Speed belongs to the host session. Single-agent mode
keeps the current host model and effort.

The host agent selects Gizmo Prime's settings; Prime selects Team Gizmo's;
Team Gizmo selects each worker's and verifier's. The assigning agent owns later
reassessment through the same hierarchy. Workers report evidence and may
recommend a change; they do not launch replacements or change peer settings.

## Required actions

### Check host capacity

Assess the capabilities needed by the validated development mode. In
`single_agent`, use the current agent; no subagent allocation or capacity
metadata is required. In `multi_agent`, read `host.max_total_agents` from the
active library's configuration. This positive integer bounds concurrent agents,
including the host agent and coordinators. It neither allocates host slots nor
requires the host to offer that many.

Preserve the [team architecture](../../AGENTS.md): the host launches Gizmo Prime,
Prime launches Team Gizmos, and Team Gizmos launch workers and verifiers. Each
coordinator schedules its children within the shared ceiling and actual host
limits. Account for coordinators and other active agents before launching more
work; queue assignments when slots are occupied.

Use execution-tool capabilities, active-session metadata, and actual launch
results as evidence. When a host reports a limit, record its source and normalize
whether it includes the primary agent. A saved configuration is not proof of the
active limit. Missing exact capacity metadata alone does not block work: launch
only needed assignments within known bounds and queue when the host reports
capacity exhaustion. Do not launch disposable agents to measure capacity.

#### Preserve the hierarchy

A host must support the delegation depth and coexistence needed for the team
architecture. If its capabilities or the project ceiling cannot support that
hierarchy, report the specific multi-agent blocker. Do not flatten the hierarchy
or silently switch the user's development mode. Carry the ceiling, capability
evidence, unresolved limits, and scheduling decisions through assignments and
continuations; reassess when the host or task changes.

- **Prohibited:** stop single-agent work because no agent limit is advertised, or
  require a host with four total slots to provide the configured ceiling of twenty.

- **Required:** when four slots and the required delegation depth are available,
  count the host, Prime, Team Gizmo, and one worker; queue further workers until a
  slot is released. If that hierarchy cannot run, explain the blocking capability.

### Approve host configuration

Consider a host configuration change only when the task needs it or the user
requests it. Busy slots usually call for scheduling. Identify the effective
configuration and supported setting through installed or official host
documentation. Show the exact path, current and proposed values, purpose, and
any restart requirement before requesting approval. Load the
[Codex reference](codex-host.md) only when working with that host's mechanics.

Use the [user-input skill](../agents/gizmo/skills/user-input/SKILL.md) and
[capacity form](../agents/gizmo/skills/user-input/examples/host-capacity.yaml)
to validate approval of that concrete proposal. Reuse explicit authorization
already supplied for the same change. `allow_host_update` authorizes the shown
edit; `keep_host_settings`, cancellation, or unavailable input does not.
Continue feasible work with existing settings, or report the affected mode's
blocker. Do not silently change the project ceiling or development mode.

Apply an approved change with a supported configuration editor or parser,
preserving unrelated settings and comments. Verify the saved values. If the host
requires a restart, retain the task and session choices and wait for resumption.
Recheck active capabilities before dependent launches; saving a setting does not
expand the running session. Unsupported or enforced settings remain limitations.

- **Prohibited:** rewrite host configuration just to match the project ceiling,
  or claim an approved configuration edit already changed live capacity.

- **Required:** propose only a necessary, supported change, obtain explicit
  approval, and verify the active capability before relying on it.

### Choose settings for the assignment

1. Read the active host's model catalog and supported effort values from its
   execution-tool instructions or discovery metadata. Use exact identifiers from
   that source, including supported model/effort combinations. Do not infer an
   identifier from a display name or use a stale catalog embedded in the framework.
   If that information is unavailable, report the limitation before launching.
2. Assess the actual assignment: ambiguity, reasoning depth, UI/design demands,
   cross-module dependencies, correctness risk, review scope, and prior attempts.
   Honor explicit user model, effort, cost, and latency constraints. Select the
   least costly combination likely to meet the required quality; do not choose
   solely by role, language, or file extension.
3. Choose model capability and reasoning effort separately. High effort on a
   smaller model does not automatically provide a stronger model's capability.
   Use these examples as judgment cues, not fixed role mappings:
   - Routine monitoring or a bounded status check can use a lightweight model
     with effort proportionate to the reasoning needed. A trivial check may need
     less effort than interpreting an ambiguous monitoring result.
   - Complex TypeScript UI work, visual interaction design, and difficult state
     behavior warrant a strong model from the start with supported high effort.
     A small copy edit does not have the same demands.
   - Complex Rust ownership, concurrency, architecture, or cross-module repairs
     can warrant a stronger model and high reasoning effort. Choose from the
     actual reasoning burden and available evidence.
   - Coordinators and reviewers also need settings suited to their current
     decisions; routine tracking and a difficult architecture dispute differ.
4. Record the selected model, effort, and a short task-specific rationale in
   assignment context. Use existing ledger continuation notes when the ledger
   is available; carry bootstrap choices until they can be recorded. These are
   per-attempt decisions, not settings to write back into TOML or role files.
   Make routine choices autonomously without asking the user to tune each agent.

- **Prohibited:** assign every developer the same model because `[team.agent]`
  used it, or give a complex UI repair the cheapest model without assessing risk.

- **Required:** explain that the UI repair spans interaction states and prior
  attempts missed a requirement, then select a supported stronger combination.
  Record why it fits this assignment and retain the user's constraints.

### Launch with the selected settings

1. Apply the selection above before every launch, including Gizmo Prime.
   Reassess before reusing a session for a changed assignment or repair.
2. Pass the selected model and effort through the host execution tool using
   its supported parameters. Choose context handling compatible with those
   settings and supply the complete
   [assignment context](../../AGENTS.md#assignment-context). Host-specific
   mappings belong in references such as [Codex](codex-host.md).
3. Leave speed to the host as described below. Do not add a tier override to the
   launch request. Host configuration changes follow the approval procedure above.
4. Check the host's launch result and returned execution metadata when available.
   Record a requested setting separately from a confirmed runtime setting.
   If a chosen combination is rejected or unavailable, select another supported
   combination that meets the assignment and user constraints and record why.
   If none does, report the blocker; do not silently inherit settings.

- **Prohibited:** name a stronger model in a child's prompt while the tool launches
  it with inherited settings, or send an unsupported `mode` argument.

- **Required:** pass the selected model and effort through the actual tool with
  compatible context handling and report any unsupported execution capability.

### Reassess and change execution settings

1. Reassess when scope or difficulty changes, a check or review exposes incorrect
   work, progress stalls, or an attempted repair fails. Inspect the evidence and
   remaining work before choosing the next execution. A tool outage or missing
   dependency may require an environment fix rather than more reasoning.
2. Keep a suitable combination when the failure has a clear bounded correction.
   Increase effort or choose a stronger model when reasoning or implementation
   quality is insufficient. Simplify the assignment when that resolves ambiguity.
   Once difficult work is complete, a cheaper combination may suit monitoring.
   Do not wait for repeated failures when the first result shows a capability gap.
3. Record the prior and selected settings, the triggering evidence, and the next
   acceptance checks in existing assignment or continuation notes. Stay within
   the [bounded repair workflow](agent-verification.md); changing models does not
   reset its repair limit or authorize broader work.
4. Reuse an existing session only when its actual settings match the new choice.
   If the host supports changing a session's settings, use that operation at its
   supported turn boundary and confirm the result before resuming work. Do not
   claim a prompt or a configuration edit changed a running model.
5. If changing that session is unsupported, stop its execution or establish that
   it finished before launching a replacement. Preserve its branch, uncommitted
   edits, checkpoints, findings, failed checks, and remaining acceptance criteria.
   Apply [ledger recovery](ledger-task-lifecycle.md#recovery-and-stale-work), including any
   required requeue and new claim. Supply the new session's complete context and
   selected settings; retain one writer per workspace.
6. Evaluate the resulting work against the same acceptance criteria and required
   checks. A more capable model does not itself establish that the repair passed.
   Workers request reassessment from Team Gizmo; Prime reassesses Team Gizmo,
   and the host agent reassesses Prime.

- **Prohibited:** retry unchanged settings indefinitely, start a second writer in
  an active workspace, or mark a failed feature fixed because its model changed.

- **Required:** after a weak repair misses a Rust invariant, Gizmo records that
  failure, selects stronger supported settings, preserves the work through the
  host and ledger handoff, and requires the replacement's repair to pass checks.

### Use the host speed setting

The user selects speed in the host before launching agents. Use the host's
supported subagent workflow and follow its documented session inheritance
rules. Do not create a framework speed selector, alias, default, or translation
layer.
A list of supported service tiers describes availability, not the selected
speed. If host metadata is available, inspect the active session's setting.
Do not treat a global configuration file as proof of the active session setting.
If speed changes during a task, follow the host's rules for new and existing
agents; do not assume an existing child changes with its parent. A model that
does not support the selected tier cannot be promised that speed.

- **Prohibited:** infer an agent's selected speed from a list of available tiers,
  or claim that omitting a tier argument proves inheritance.

- **Required:** honor the user's host speed selection and use runtime metadata to
  check the child's selected tier when available.

### Verify the launch

1. Check actual launch behavior through the host tool when validating execution.
   Respect the session's development choice and any explicit test exception.
2. Inspect host-returned execution metadata when available. Configuration
   round trips, a child's self-report, and elapsed time do not verify the actual
   processing tier.
3. Report the launch result and tier evidence separately. If the host exposes no
   processing-tier metadata, state that runtime tier confirmation is unavailable.
   A successful launch verifies the launch path, not a latency guarantee.

- **Prohibited:** report “Selected processing tier verified” after only reading the
  configuration or receiving a child's claim about its tier.

- **Required:** report “The parent has the requested tier selected and the live
  child launch completed. The host exposes no actual processing-tier metadata for the child.”

## Prohibited actions

- Do not retain execution-mode or service-tier fields in framework configuration.
- Do not restore static role model/effort settings or a bundled model allowlist.
- Do not turn illustrative task examples into a mandatory model lookup table.
- Keep selection policy here; roles and skills link it instead of fixing models.
