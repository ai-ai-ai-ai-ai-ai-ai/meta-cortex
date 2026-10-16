# Agent Configuration

[meta-cortex.toml](../../../meta-cortex.toml) owns required host capacity.
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

The current agent owns this session preflight after the mode and delivery
answers are validated. It runs before development in either mode. Delegated
agents inherit the result rather than asking the user again.

1. Read `host.required_total_agents` from the active library's configuration.
   Require a positive integer. This is the project's capacity target, not a
   claim about the host's current allocation.
2. Read the active host's reported total agent limit from its instructions or
   execution metadata. Record the source and whether the primary agent is included.
   Normalize the limit to include the primary agent and every coordinator.
   - Distinguish the total limit from currently unused slots. Busy agents do
     not mean that the configured total limit needs raising.
   - A saved host configuration does not establish the active session limit.
   - If the active limit is unavailable or ambiguous, report that capacity
     cannot be verified and stop dependent development. Do not probe capacity
     by launching agents or assume a default.
3. Compare the reported total with the configured target.
   - If the total meets the target, retain the observed capacity and source
     in session context and continue under the selected development mode.
   - If it is lower, follow [host configuration approval](#approve-host-configuration).
4. Carry the preflight result through continuation context and assignments.
   Recheck after a host restart or a reported allocation change. A new
   user-facing session performs its own preflight.

**Prohibited:** treat a saved setting as proof of active capacity, or subtract
busy coordinators and ask for an unnecessary configuration increase.

**Required:** compare the active host's total allocation with the configured
target, including coordinators and the primary agent in both counts.

### Approve host configuration

When active capacity is below the target, prepare a concrete host configuration
proposal before asking for permission. Updating the framework's target alone
does not increase the host allocation.

1. Identify the host's supported capacity setting and effective configuration
   location. Inspect only the relevant settings and current profile or overrides.
   Verify the setting against installed host documentation or official documentation.
   - Codex configuration is TOML. Read it through a maintained TOML library.
     Use that library's document editor for the approved change; do not use
     regular expressions, string replacement, or append a duplicate table.
     Preserve unrelated settings and comments. If no suitable TOML library is
     available, report the missing dependency before proposing an executable edit.
   - For Codex, the current [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
     defines `agents.max_concurrent_threads_per_session` as the spawned-thread
     limit, excluding the primary thread. Its proposed value is the framework's
     required total minus one. Use the setting supported by the installed version.
     Inspect multi-agent enablement as well; the current setting is `agents.enabled`.
     Include enabling agents in the approval proposal when multi-agent mode
     requires it. Do not silently change enablement.
   - Compare the parsed capacity setting with the required value. Propose raising
     a smaller setting or adding a missing setting. If the saved setting already
     meets or exceeds the target, preserve it and request a restart followed by
     an active capacity recheck. Do not lower a larger saved limit.
   - If the setting is unsupported, enforced by the host, or cannot be resolved,
     report the blocker. Do not invent another setting or bypass host policy.
2. Show the observed limit, framework target, exact configuration path, and
   proposed setting change. Explain that this edits the host configuration and
   requires a restart. Omit unrelated configuration and sensitive values.
3. Use the [native user-input skill](../agents/gizmo/skills/user-input/SKILL.md)
   with its [host capacity form](../agents/gizmo/skills/user-input/examples/host-capacity.yaml).
   Bind the approval to the proposal shown to the user.
   - Only a validated `allow_host_update` authorizes the proposed edit.
   - For `keep_host_settings`, cancellation, or unavailable input, preserve
     configuration and report that development is blocked by insufficient capacity.
   - Do not lower the framework target unless the user explicitly requests it.
4. After approval, change only the proposed host settings through the TOML
   library. Reparse the saved document and verify the approved values.
   Preserve unrelated settings. Report any write failure as a blocker.
5. Ask the user to restart Codex and resume this chat. For another host, name
   that host's required restart procedure. Preserve the task, validated session
   choices, approval, and preflight evidence in continuation context.
6. Stop dependent development until the user resumes after restarting.
   Repeat the active capacity check before planning, implementation, or launches.
   If it still falls short, report the observed mismatch; do not claim that
   saving configuration expanded the current session.

**Prohibited:** replace TOML text with a regular expression, silently rewrite
Codex settings, lower a sufficient saved limit, or launch workers immediately
after saving a larger limit.

**Required:** parse the TOML settings with a library, show the exact proposed
changes, obtain approval, reparse the saved edit, request a restart, and recheck
active capacity on resumption.

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
   - Routine monitoring or a bounded status check can use a lightweight model,
     such as Luna with `max` effort when the host supports it and the reasoning
     warrants it. A trivial check may need less effort.
   - Complex TypeScript UI work, visual interaction design, and difficult state
     behavior warrant a strong model from the start, such as Astra with a
     supported high effort. A small copy edit does not have the same demands.
   - Complex Rust ownership, concurrency, architecture, or cross-module repairs
     can warrant Astra or Sol with `xhigh` or `max`, when supported. Choose from
     the actual reasoning burden and available evidence.
   - Coordinators and reviewers also need settings suited to their current
     decisions; routine tracking and a difficult architecture dispute differ.
4. Record the selected model, effort, and a short task-specific rationale in
   assignment context. Use existing ledger continuation notes when the ledger
   is available; carry bootstrap choices until they can be recorded. These are
   per-attempt decisions, not settings to write back into TOML or role files.
   Make routine choices autonomously without asking the user to tune each agent.

**Prohibited:** assign every developer the same model because `[team.agent]`
used it, or give a complex UI repair the cheapest model without assessing risk.

**Required:** explain that the UI repair spans interaction states and prior
attempts missed a requirement, then select a supported stronger combination.
Record why it fits this assignment and retain the user's constraints.

### Launch with the selected settings

1. Apply the selection above before every launch, including Gizmo Prime.
   Reassess before reusing a session for a changed assignment or repair.
2. Pass the selected `model` and `reasoning_effort` explicitly through the host
   execution tool, adapting parameter names to its contract. Choose a context
   fork that permits those settings. Where `fork_turns="all"` rejects overrides,
   use `fork_turns="none"` or another supported mode and supply the complete
   [assignment context](../../AGENTS.md#assignment-context).
3. Leave speed to the host as described below. Do not add a tier override to the
   launch request. Host configuration changes follow the approval procedure above.
4. Check the host's launch result and returned execution metadata when available.
   Record a requested setting separately from a confirmed runtime setting.
   If a chosen combination is rejected or unavailable, select another supported
   combination that meets the assignment and user constraints and record why.
   If none does, report the blocker; do not silently inherit settings.

**Prohibited:** tell a child to use Astra in its prompt while the tool launches
it with inherited settings, or send an unsupported `mode` argument.

**Required:** pass the selected model and effort through the actual tool with
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

**Prohibited:** retry unchanged settings indefinitely, start a second writer in
an active workspace, or mark a failed feature fixed because its model changed.

**Required:** after a weak repair misses a Rust invariant, Gizmo records that
failure, selects stronger supported settings, preserves the work through the
host and ledger handoff, and requires the replacement's repair to pass checks.

### Use the host speed setting

The user selects speed in the host before launching agents. Use the host's
native subagent workflow so that its session inheritance rules apply. Codex
passes the root session's selected tier to new children when their model supports
that tier, including launches with explicit model and reasoning-effort settings.
Do not create a framework speed selector, alias, default, or translation layer.
A list of supported service tiers describes availability, not the selected
speed. If host metadata is available, inspect the active session's setting.
Do not treat a global configuration file as proof of the active session setting.
If speed changes during a task, follow the host's rules for new and existing
agents; do not assume an existing child changes with its parent. A model that
does not support the selected tier cannot be promised that speed.

**Prohibited:** infer that an agent uses Fast because the tool advertises
`priority`, or claim that omitting a tier argument proves inheritance.

**Required:** select Fast in the host, launch through its native agent tool,
and use host metadata to check the child's selected tier when available.

### Verify the launch

1. Check actual launch behavior through the host tool when validating execution.
   Respect the session's development choice and any explicit test exception.
2. Inspect host-returned execution metadata when available. Configuration
   round trips, a child's self-report, and elapsed time do not verify the actual
   processing tier.
3. Report the launch result and tier evidence separately. If the host exposes no
   processing-tier metadata, state that runtime tier confirmation is unavailable.
   A successful launch verifies the launch path, not a latency guarantee.

**Prohibited:** report “Fast processing verified” after only reading the
configuration or receiving a child's claim about its tier.

**Required:** report “The parent has Fast selected and the live child launch
completed. The host exposes no actual processing-tier metadata for the child.”

## Prohibited actions

- Do not retain execution-mode or service-tier fields in framework configuration.
- Do not restore static role model/effort settings or a bundled model allowlist.
- Do not turn illustrative task examples into a mandatory model lookup table.
- Keep selection policy here; roles and skills link it instead of fixing models.
