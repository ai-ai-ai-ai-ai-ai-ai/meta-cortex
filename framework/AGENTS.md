# Meta-Cortex

Meta-Cortex is a composable development platform that organizes teams of agents
to turn ideas and requirements into working software. Projects include it as
an AI library. Its agents, rules, skills, and configuration form one framework
that manages development in the consuming project's repository. The host
provides the tools and execution environment used by Meta-Cortex.

## Project context

- The **library root** is the directory containing this file and `meta-cortex.toml`, wherever the project includes Meta-Cortex.
- The **project root** is the consuming repository where the user's development task belongs. Identify it from the host workspace and the project's instructions; do not assume it is the library root or its immediate parent.
- Read the consuming project's `AGENTS.md` and applicable directory instructions, requirements, and architecture before planning its development work.
- Resolve Markdown links relative to the document containing them. Resolve source paths, manifests, tests, and commands against the consuming project or the assigned project worktree.
- References to "the project" or "the repository" in skills mean the consuming project. Map architectural examples to its actual packages and paths while preserving the rules.
- Implement changes and run validation in the assigned project scope. Change the Meta-Cortex library itself only when the task concerns its rules, skills, roles, or configuration.

## Entry point

For a new user task, establish the project context above, load the execution
config below, then read and follow
[agents/AGENTS.md](agents/AGENTS.md). It defines how to start and coordinate
agents and compose their skills.

## Agent configuration

[meta-cortex.toml](meta-cortex.toml) defines the model and reasoning effort
used to run agents. Read it before starting Gizmo Prime and before each
subagent launch.

- Select settings by role: `[gizmo-prime]` for Gizmo Prime, `[team.gizmo]` for Team Gizmo, and `[team.agent]` for all team agents and their subagents.
- Pass the resolved `model` and `reasoning_effort` explicitly to the host's agent execution tool, adapting parameter names to that tool.
- Each role setting specifies both model and reasoning effort. There are no defaults or per-agent overrides. Skills do not have execution settings.
- Keep model choices in the config, not in role instructions or delegation prompts.
- If the config is missing, invalid, or unsupported by the host, report the specific blocker instead of silently substituting settings.
- Reading the config does not change an already-running session. Use an existing Gizmo Prime session only if its settings match; otherwise launch it with the configured settings through a capable host.
