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

Agents read the project's instructions and relevant code before acting.
Work continues until the requested outcome is supported by evidence.

The [SRE team](agents/teams/sre-team/AGENTS.md) owns portable infrastructure,
container builds, Kubernetes workloads, and cloud-native operations. Its
specialized skills are:

- [Docker](agents/teams/sre-team/docker-specialist/skills/docker-skill/SKILL.md) for deliberate
  image inputs, secret boundaries, and real BuildKit cache evidence.
- [Kubernetes](agents/teams/sre-team/kubernetes-specialist/skills/kubernetes-skill/SKILL.md) for
  workloads that stay within the cluster runtime boundary.
- [Cloud-Native](agents/teams/sre-team/kubernetes-specialist/skills/cloud-native-skill/SKILL.md) for
  bounded, observable infrastructure and operational changes, loaded by the
  Kubernetes specialist for cloud-native assignments.

## Execution configuration

[meta-cortex.toml](meta-cortex.toml) selects the model and reasoning effort for
each role. The [configuration rules](AGENTS.md#agent-configuration) define how
the host applies those settings.

1. Check that the configured models and reasoning efforts are supported by your host.
2. Adjust the role settings to match your intended execution setup.
3. Start the task through a host capable of running the configured roles.
   - Unsupported settings or missing execution capabilities are reported as blockers.
   - Agents must not silently substitute another configuration.

## Agent skills

Each agent’s `AGENTS.md` defines its skills and prerequisites. Team Gizmo
assigns work by responsibility; the assigned agent loads its own guidance.
The tech writer owns [skill organization](agents/teams/ai-team/tech-writer/AGENTS.md#skill-organization),
including placement and updates to callers when guidance moves.
Each practice has one canonical owner.

- **Common skills**
  - Define language-independent practices grouped by subject.
  - Cover [coding](skills/dev/coding-skill/SKILL.md) and
    [security](skills/security/security-skill/SKILL.md).
  - Do not depend on agent roles or team structure.
- **Specialized skills**
  - Live with their owning agents.
  - Extend common practices for the relevant language or task.
  - The [tech writer](agents/teams/ai-team/tech-writer/AGENTS.md)
    owns Context Engineering and Code Example Authoring for documentation and programming-rule examples.

The framework's instructions remain generic.
Project-specific requirements and architecture belong to the consuming project.
