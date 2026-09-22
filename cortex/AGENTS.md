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
3. Collect the [development mode](#development-mode) before launching any agent.
4. In multi-agent mode, read [meta-cortex.toml](meta-cortex.toml) and apply the
   [agent configuration rules](#agent-configuration).
5. In multi-agent mode, read and follow [team instructions](teams/AGENTS.md) to launch Gizmo Prime
   as a subagent through the host’s agent execution tool. Pass the task context
   into its assignment. That document defines subsequent subagent launches
   and coordination.

### Development mode

The current agent uses the [native user-input skill](teams/gizmo-team/agents/gizmo/skills/user-input/SKILL.md)
with [development.yaml](development.yaml). Ask for `development.mode` at the
start of each new development task, then retain the validated choice for that
task's follow-ups and pass it through assignments. Do not re-prompt for each
message or subagent assignment. An explicit mode already supplied by the user
(including a request to work without subagents) answers this field; validate it
without asking again. Never treat the host's preselected option as an answer.

- `single_agent`: use the current agent and thread. Do not spawn Gizmos, workers,
  reviewers, or integration subagents. Read the relevant team and role
  instructions, team docs, circuit breakers, and skills using the
  [assignment context](teams/AGENTS.md#assignment-context) requirements locally.
  The current agent performs implementation, validation, and delivery. Delegation
  and coordinator-only routing requirements apply only in multi-agent mode;
  technical requirements still apply. Keep the current host model/settings.
- `multi_agent`: use the existing Gizmo workflow and configured role settings.

The returned `answers["development.mode"]` is the task's `development.mode`.
It is not a persisted model setting. Do not rewrite `meta-cortex.toml` or save
user answers to the repository. Cancelled, unavailable, invalid, or pending
configuration must not launch agents or continue dependent development work.
Apply an explicit user mode change before further work; do not leave delegated
agents running when switching to single-agent mode.

**Prohibited:** launch Gizmo Prime before asking for a mode, then continue
using workers after the user chooses `single_agent`.

**Preferred:** validate `single_agent`, load the relevant team context locally,
and implement and verify the task in this thread.

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

[meta-cortex.toml](meta-cortex.toml) owns model and reasoning-effort choices.
Each role setting specifies both values:

- **Gizmo Prime**
  - Configuration: `[gizmo-prime]`.
- **Team Gizmo**
  - Configuration: `[team.gizmo]`.
- **Team agents and their subagents**
  - Configuration: `[team.agent]`.

Before each subagent launch, including Gizmo Prime:

1. Read the configuration and select the setting for the role.
   - If the configuration is missing, invalid, or unsupported by the host,
     report the specific blocker. Do not silently substitute settings.
2. Pass `model` and `reasoning_effort` explicitly to the host's agent execution
   tool. Adapt parameter names to that tool.
   - Reuse an existing Gizmo Prime session only if its settings match.
   - Otherwise, launch Gizmo Prime as a subagent with the configured settings through a capable host.

Reading the configuration does not change an already-running session.

## Prohibited actions

- Do not assume the project root is the library root or its immediate parent.
- Do not change the Meta-Cortex library unless the task concerns its rules, skills, roles, or configuration.
- Do not introduce execution defaults or per-agent overrides. Skills have no execution settings.
- Do not duplicate model choices in role instructions or delegation prompts.
