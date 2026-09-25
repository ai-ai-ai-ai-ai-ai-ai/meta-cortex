# Agent Configuration

[meta-cortex.toml](../../../meta-cortex.toml) is the source of model,
reasoning-effort, and service-tier settings. Read the resolved configuration
from the active library, including the consuming project's values. Each role
selects its own section:

- **Gizmo Prime:** `[gizmo-prime]`.
- **Team Gizmo:** `[team.gizmo]`.
- **Team agents:** `[team.agent]`, including documentation, review, integration,
  and PR delivery agents.

Each section requires `model`, `reasoning_effort`, and `service_tier`.
The supported service tier is `priority`, using the host's native name.
There is no execution `mode`, alias, or implicit tier default. The session's
`single_agent` or `multi_agent` choice remains independent of these settings.

## Required actions

### Launch with the configured settings

1. Read the current configuration and select the launched role's section.
   Do not substitute remembered values, bundled defaults, or coordinator settings.
2. Inspect the active host tool's parameters and tier contract for that model.
   - If it exposes `service_tier`, pass the configured `priority` value explicitly.
   - If it exposes no tier parameter but advertises only `priority` for that model,
     use that host-managed tier without inventing an argument.
   - If the effective tier is unknown or different, report the specific host
     limitation before launching. Several supported tiers alone do not identify
     the selected tier.
3. Pass the exact configured `model` and `reasoning_effort` through the host tool.
   Choose a context fork that permits those explicit settings. For hosts where
   `fork_turns="all"` rejects overrides, use `fork_turns="none"` or a supported
   bounded history value and supply the complete
   [assignment context](../../AGENTS.md#assignment-context).
4. Reuse a session only when its model, effort, and tier match the role settings.
   Reading configuration or mentioning settings in a prompt does not change a
   running session.

**Prohibited:** send a nonexistent `mode` argument to `spawn_agent`, silently
omit an unknown tier, or tell a child to change its model through assignment text.

**Preferred:** read `[team.agent]`, pass its model and effort explicitly, and use
`priority` from the active host's model-specific contract when no tier selector
exists. Report that the tier is host-managed, not an explicit launch argument.

### Verify the launch

1. Check actual launch behavior through the host tool when validating execution.
   Respect the session's development choice and any explicit test exception.
2. Inspect host-returned execution metadata when available. Configuration
   round trips, a child's self-report, and elapsed time do not verify the actual
   processing tier.
3. Report the launch result and tier evidence separately. If the host exposes no
   processing-tier metadata, state that runtime tier confirmation is unavailable.
   A successful launch verifies the launch path, not a latency guarantee.

**Prohibited:** report “priority processing verified” after only reading the
configuration or receiving a child's claim about its tier.

**Preferred:** report “The live launch completed. The host advertises priority
for this model, but its result exposes no actual processing-tier metadata.”

## Prohibited actions

- Do not retain old execution-mode fields or translate aliases into service tiers.
- Do not introduce model, effort, or tier defaults, or per-agent overrides.
- Do not duplicate model choices in role instructions or delegation prompts.
- Skills have no execution settings.
