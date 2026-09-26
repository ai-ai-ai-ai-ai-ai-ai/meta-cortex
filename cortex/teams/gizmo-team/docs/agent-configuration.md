# Agent Configuration

[meta-cortex.toml](../../../meta-cortex.toml) is the source of model and
reasoning-effort settings. Read the resolved configuration from the active
library, including the consuming project's values. Each role selects its own section:

- **Gizmo Prime:** `[gizmo-prime]`.
- **Team Gizmo:** `[team.gizmo]`.
- **Team agents:** `[team.agent]`, including documentation, review, integration,
  and PR delivery agents.

Each section requires `model` and `reasoning_effort`. Speed belongs to the host
session. There is no framework execution `mode` or `service_tier` field. The
session's `single_agent` or `multi_agent` choice remains independent of speed.

## Required actions

### Launch with the configured settings

1. Read the current configuration and select the launched role's section.
   Do not substitute remembered values, bundled defaults, or coordinator settings.
2. Pass the exact configured `model` and `reasoning_effort` through the host tool.
   Choose a context fork that permits those explicit settings. For hosts where
   `fork_turns="all"` rejects overrides, use `fork_turns="none"` or a supported
   bounded history value and supply the complete
   [assignment context](../../AGENTS.md#assignment-context).
3. Leave speed to the host as described below. Do not add a tier override to the
   launch request or rewrite the user's host configuration.
4. Reuse a session only when its model and effort match the role settings.
   Reading configuration or mentioning settings in a prompt does not change a
   running session.

**Prohibited:** send a nonexistent `mode` argument to `spawn_agent`, or tell a
child to change its model through assignment text.

**Preferred:** read `[team.agent]`, pass its model and effort explicitly, and
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

**Preferred:** select Fast in the host, launch through its native agent tool,
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

**Preferred:** report “The parent has Fast selected and the live child launch
completed. The host exposes no actual processing-tier metadata for the child.”

## Prohibited actions

- Do not retain execution-mode or service-tier fields in framework configuration.
- Do not introduce model or effort defaults, or per-agent overrides.
- Do not duplicate model choices in role instructions or delegation prompts.
- Skills have no execution settings.
