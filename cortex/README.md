# Using Meta-Cortex

Meta-Cortex coordinates agents to turn ideas and requirements into working
software in your project. Your AI host supplies the models and execution tools.

## Project context

The framework's [entry point](AGENTS.md) establishes the consuming project as
the workspace for development tasks.

- **Project repository**
  - Holds the code, requirements, and project-specific instructions.
  - Owns the implementation and validation work.
- **Framework library**
  - Holds reusable agent instructions, skills, practices, and configuration.
  - Changes only when the task concerns that guidance or configuration.

Document links resolve relative to their containing document.
Source paths and development commands resolve in the consuming project or its
assigned worktree.

## Agent coordination

Give your host a development task with the framework entry point loaded.
The host launches Gizmo Prime as a subagent. Gizmo Prime launches Team Gizmo,
which launches the team subagents needed for the task.
The [agent instructions](agents/AGENTS.md) define the coordination workflow.

- **Gizmo Prime**
  - Owns the overall outcome.
  - Directs Team Gizmo.
- **Team Gizmo**
  - Coordinates bounded assignments across teams.
  - Checks results and routes corrections to their owners.
- **Team agents**
  - Apply relevant skills to implement and validate their assignments.
  - Return evidence and unresolved blockers.
- **[Integration agent](agents/teams/delivery-team/integration-agent/AGENTS.md)**
  - Manages feature worktrees and merges completed task branches.

Agents read the project's instructions and relevant code before acting.
Work continues until the requested outcome is supported by evidence.

## Execution configuration

[meta-cortex.toml](meta-cortex.toml) selects the model and reasoning effort for
each role. The [configuration rules](AGENTS.md#agent-configuration) define how
the host applies those settings.

1. Check that the configured models and reasoning efforts are supported by your host.
2. Adjust the role settings to match your intended execution setup.
3. Start the task through a host capable of running the configured roles.
   - Unsupported settings or missing execution capabilities are reported as blockers.
   - Agents must not silently substitute another configuration.

## Skills

Each role selects its skills. Skills link directly to their prerequisites.
Each practice has one canonical owner.

- **Common skills**
  - Live in each owning team’s `common/` directory.
  - Define language-independent practices grouped by subject.
  - Cover [coding](agents/teams/dev-team/common/coding-skill/SKILL.md) and
    [security](agents/teams/security-team/common/security-skill/SKILL.md).
  - Do not depend on agent coordination or specialized skills.
- **Specialized skills**
  - Live with their owning agents.
  - Extend and directly reference common practices for the relevant language or task.
  - The [tech writer](agents/teams/ai-team/tech-writer/AGENTS.md)
    owns Context Engineering, Code Practice Writing, and Delivery Writing for
    documentation, coding practices, and delivery/Git instructions.

The framework's instructions remain generic.
Project-specific requirements and architecture belong to the consuming project.
