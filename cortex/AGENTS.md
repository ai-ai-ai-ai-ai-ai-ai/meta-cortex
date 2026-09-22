# Meta-Cortex

Meta-Cortex is a composable development platform that organizes teams of agents
to turn ideas and requirements into working software. Projects include it as
an AI library. Its agents, rules, skills, and configuration form one framework.
Meta-Cortex can run in the current agent or delegate through the host’s execution tools.
The host provides the models, tools, and execution environment.

## Required actions

### Entry point

For a new user task:

1. Read the [circuit breaker](CIRCUIT-BREAKER.md) before other framework documents.
   Carry its policy and resolved location through every assignment.
2. Establish the [project context](#project-context).
3. Resolve the session’s [development mode](#development-mode) before planning
   or implementing the task and before launching any agent.
4. In multi-agent mode, read [meta-cortex.toml](meta-cortex.toml) and apply the
   [agent configuration rules](#agent-configuration).
5. In multi-agent mode, read and follow [team instructions](teams/AGENTS.md) to launch Gizmo Prime
   as a subagent through the host’s agent execution tool. Pass the task context
   into its assignment. That document defines subsequent subagent launches
   and coordination.

### Development mode

The current agent uses the [native user-input skill](teams/gizmo-team/agents/gizmo/skills/user-input/SKILL.md)
with [development.yaml](development.yaml). At the start of every new user-facing
session, ask the user to choose `development.mode` through the native input UI.
Wait for a submitted, validated answer before choosing the execution path.
Do not infer a choice from an earlier session, repository settings, or the host's
preselected option. Do not launch Gizmos while this question is pending.

A session is the current user-facing conversation/thread. Retain its selected
mode across new tasks, follow-ups, turn boundaries, and context compaction in
that conversation. Include it in continuation context and every assignment.
Do not ask again for each message, task, or delegated agent. A new user-facing
conversation asks again; a delegated agent inherits the parent session's choice
and does not start another configuration flow. If the choice is lost and cannot
be recovered from session context, ask rather than guess.

- `single_agent`: use the current agent and thread. Do not spawn Gizmos, workers,
  reviewers, or integration subagents. Read the relevant team and role
  instructions, team docs, circuit breakers, and skills using the
  [assignment context](teams/AGENTS.md#assignment-context) requirements locally.
  The current agent performs implementation, validation, and delivery. Delegation
  and coordinator-only routing requirements apply only in multi-agent mode;
  technical requirements still apply. Keep the current host model/settings.
- `multi_agent`: use the existing Gizmo workflow and configured role settings.

The returned `answers["development.mode"]` is the session's `development.mode`.
It is not a persisted model setting. Do not rewrite `meta-cortex.toml` or save
user answers to the repository. Cancelled, unavailable, invalid, or pending
configuration must not launch agents or continue dependent development work.
Apply an explicit user mode change before further work; do not leave delegated
agents running when switching to single-agent mode.

**Prohibited:** launch Gizmo Prime before asking for a mode, then continue
using workers after the user chooses `single_agent`.

**Preferred:** validate `single_agent`, load the relevant team context locally,
and implement and verify the task in this thread. A later task in the same
session keeps that choice; a new session asks again.

### Project context

Identify both roots before planning development work:

- **Library root**
  - The directory containing this file and `meta-cortex.toml`.
  - Provides Meta-Cortex instructions, roles, skills, and configuration.
- **Project root**
  - The consuming repository where the user's development task belongs.
  - Identify it from the host workspace and the project's instructions.

Apply the consuming project's context throughout the task:

- Read its `AGENTS.md` and applicable directory instructions, requirements, and architecture before planning.
- Resolve Markdown links relative to the document containing them.
- Resolve source paths, manifests, tests, and commands against the consuming project or assigned project worktree.
- Pass the resolved library location separately from each task worktree.
  An ignored installed library may remain in the original checkout.
- Interpret "the project" and "the repository" in skills as the consuming project.
- Map architectural examples to the project's actual packages and paths while preserving their rules.
- Implement changes and run validation within the assigned project scope.
- Pass project context, configuration rules, the configuration file location,
  and the team directory through every delegation. Each assigned agent loads
  the skills linked from its own instructions and follows their `SKILL.md` files.

### Agent configuration

[meta-cortex.toml](meta-cortex.toml) is the sole source of model and
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
     value. Supply the complete [assignment context](teams/AGENTS.md#assignment-context).
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

- Do not assume the project root is the library root or its immediate parent.
- Do not change the Meta-Cortex library unless the task concerns its rules, skills, roles, or configuration.
- Do not introduce execution defaults or per-agent overrides. Skills have no execution settings.
- Do not duplicate model choices in role instructions or delegation prompts.
