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
- **Integration agent**
  - Belongs to the delivery team and uses the team-agent execution setting.
  - Performs local Git integration under Team Gizmo's direction.

Agents read the project's instructions and relevant code before acting.
Work continues until the requested outcome is supported by evidence.

## Local feature work

For repository changes, the [local ownership model](agents/AGENTS.md#local-feature-ownership)
assigns feature decisions to Gizmo Prime, contribution acceptance to Team Gizmo,
and Git mechanics to the delivery team's integration agent.
The [local-feature skill](skills/repository-automation/local-feature/SKILL.md)
owns workspace setup, committed handoffs, merge rules, recovery, and cleanup.

Workers receive isolated task branches and worktrees. Accepted commits flow
through one integration writer into the feature branch. The result is a local
feature head with combined validation evidence, ready for review or a separately
authorized publishing workflow. Read-only tasks need no write worktrees.

These are instructions executed through the host and ordinary Git. Installing
Meta-Cortex does not provision worktrees or start an integration service.

**Prohibited:** assume launching several subagents automatically gives each one
an isolated checkout, then let them merge concurrently into the feature branch.

**Preferred:** issue task worktrees explicitly and have the integration agent
combine accepted commits in order, returning the resulting head and checks.

## Execution configuration

[meta-cortex.toml](meta-cortex.toml) selects the model and reasoning effort for
each role. The [configuration rules](AGENTS.md#agent-configuration) define how
the host applies those settings.

1. Check that the configured models and reasoning efforts are supported by your host.
2. Adjust the role settings to match your intended execution setup.
3. Start the task through a host capable of running the configured roles.
   - Unsupported settings or missing execution capabilities are reported as blockers.
   - Agents must not silently substitute another configuration.

## Skill composition

[Skill composition](skill-composition.md) selects common prerequisites and
specialized skills according to the assignment.
Each practice has one canonical owner.

- **Common skills**
  - Define language-independent practices grouped by subject.
  - Cover [coding](skills/dev/coding-skill/SKILL.md),
    [security](skills/security/security-skill/SKILL.md), and
    [local repository work](skills/repository-automation/local-feature/SKILL.md).
  - Do not depend on agent roles or team structure.
- **Specialized skills**
  - Live with their owning agents.
  - Extend common practices for the relevant language or task.
  - The [tech writer](agents/teams/ai-team/tech-writer/AGENTS.md)
    owns Context Engineering and Code Example Authoring for documentation and programming-rule examples.

The framework's instructions remain generic.
Project-specific requirements and architecture belong to the consuming project.
