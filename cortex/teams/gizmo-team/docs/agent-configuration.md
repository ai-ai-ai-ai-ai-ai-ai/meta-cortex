# Agent Configuration

[meta-cortex.toml](../../../meta-cortex.toml) is the sole source of model and
reasoning-effort values. Use the resolved configuration file from the active
library, including the consuming project's configured values. Model names must
not be hard-coded in launch instructions. Each role setting specifies both values:

- **Gizmo Prime**
  - Configuration: `[gizmo-prime]`.
- **Team Gizmo**
  - Configuration: `[team.gizmo]`.
- **Team agents**
  - Configuration: `[team.agent]`.
  - Applies to every non-coordinator role, including documentation, review,
    integration, and PR delivery agents.

## Required actions

Before each subagent launch, including Gizmo Prime:

1. Read the current configuration file and select the setting for the agent
   being launched, not the launching coordinator. Do not reuse remembered values
   or bundled defaults in place of that file.
   - If the configuration is missing, invalid, or unsupported by the host,
     report the specific blocker. Do not silently substitute settings.
2. Pass the selected configuration's exact `model` and `reasoning_effort` values
   explicitly to the host's agent execution tool. Adapt parameter names to that
   tool without changing the values.
   - Choose a context-fork mode that permits explicit execution settings.
     For hosts where `fork_turns="all"` inherits the parent's settings and
     rejects overrides, use `fork_turns="none"` or a supported bounded history
     value. Supply the complete [assignment context](../../AGENTS.md#assignment-context).
   - Do not omit execution settings to make a full-history fork succeed.
     Instructions in the assignment text cannot select a running agent's model.
3. Reuse an existing agent session only if its model and reasoning effort match
   the configuration for the assigned role. Otherwise, launch a new session
   through a capable host.

Reading the configuration does not change an already-running session.

**Prohibited:** Team Gizmo launches a worker with inherited coordinator settings
and tells it in the assignment text to use the team-agent model.

**Preferred:** After the user changes `[team.agent]`, Team Gizmo reads that
section again for the next worker launch and passes both new values explicitly
with a compatible context-fork mode. If the host cannot honor those settings,
report the blocker instead of launching with coordinator settings.

## Prohibited actions

- Do not introduce execution defaults or per-agent overrides. Skills have no execution settings.
- Do not duplicate model choices in role instructions or delegation prompts.
