# Agent Configuration

[meta-cortex.toml](../../../meta-cortex.toml) is the source of required host
capacity, model, and reasoning-effort settings. Read the resolved configuration from the active
library, including the consuming project's values. Each role selects its own section:

- **Gizmo Prime:** `[gizmo-prime]`.
- **Team Gizmo:** `[team.gizmo]`.
- **Team agents:** `[team.agent]`, including documentation, review, integration,
  and PR delivery agents.

Each section requires `model` and `reasoning_effort`. Speed belongs to the host
session. There is no framework execution `mode` or `service_tier` field. The
session's `single_agent` or `multi_agent` choice remains independent of speed.

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

### Launch with the configured settings

1. Read the current configuration and select the launched role's section.
   Do not substitute remembered values, bundled defaults, or coordinator settings.
2. Pass the exact configured `model` and `reasoning_effort` through the host tool.
   Choose a context fork that permits those explicit settings. For hosts where
   `fork_turns="all"` rejects overrides, use `fork_turns="none"` or a supported
   bounded history value and supply the complete
   [assignment context](../../AGENTS.md#assignment-context).
3. Leave speed to the host as described below. Do not add a tier override to the
   launch request. Host configuration changes require the capacity approval above.
4. Reuse a session only when its model and effort match the role settings.
   Reading configuration or mentioning settings in a prompt does not change a
   running session.

**Prohibited:** send a nonexistent `mode` argument to `spawn_agent`, or tell a
child to change its model through assignment text.

**Required:** read `[team.agent]`, pass its model and effort explicitly, and
leave the host's speed selection in place.

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
- Do not introduce model or effort defaults, or per-agent overrides.
- Do not duplicate model choices in role instructions or delegation prompts.
- Skills have no execution settings.
