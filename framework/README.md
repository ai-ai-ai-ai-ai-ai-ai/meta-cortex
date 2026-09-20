# Meta-Cortex

Meta-Cortex is a composable development framework that organizes teams of AI
agents to turn ideas and requirements into working software. Its agents,
rules, skills, and configuration form one AI library, included in a project's
`.meta-cortex/` directory.

The project's root `AGENTS.md` activates the framework with:

```markdown
For development tasks, read and follow [.meta-cortex/AGENTS.md](.meta-cortex/AGENTS.md).
```

When given a task, Meta-Cortex reads the project's instructions, requirements,
and relevant code. Gizmo Prime owns the overall outcome, Team Gizmo coordinates
the work, and team agents implement and validate their assignments. Agents
apply common and specialized skills, return evidence and blockers, and resolve
gaps until the requested work is complete.

Development happens in the project's codebase. `.meta-cortex/` holds the
framework; agents change it only when the task concerns the framework itself.
The host supplies execution tools, and [meta-cortex.toml](meta-cortex.toml)
selects the model and reasoning effort for each role. Unsupported settings or
unavailable execution capabilities are reported rather than silently replaced.

[AGENTS.md](AGENTS.md) is the framework's entry point. It establishes project
context and links to the [agent instructions](agents/AGENTS.md). Internal
document links resolve within the library; source paths and development
commands resolve in the consuming project or its assigned worktree.

Common practices live under `skills/`, grouped by subject: coding and security
have separate skills. Specialized skills live with their owning agents and
extend common practices. Agent instructions compose the skills needed for an
assignment; common skills do not depend on agent roles or team structure.
