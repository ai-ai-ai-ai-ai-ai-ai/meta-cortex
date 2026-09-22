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
The [agent instructions](teams/AGENTS.md) define the coordination workflow.

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

The [SRE team](teams/sre-team/AGENTS.md) owns portable infrastructure,
container builds, Kubernetes workloads, and cloud-native operations. Its
specialized skills are:

- [Docker](teams/sre-team/agents/docker-specialist/skills/docker-skill/SKILL.md) for deliberate
  image inputs, secret boundaries, and real BuildKit cache evidence.
- [Kubernetes](teams/sre-team/agents/kubernetes-specialist/skills/kubernetes-skill/SKILL.md) for
  workloads that stay within the cluster runtime boundary.
- [Cloud-Native](teams/sre-team/agents/kubernetes-specialist/skills/cloud-native-skill/SKILL.md) for
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

Each agent’s `AGENTS.md` links its skills. Each skill’s `SKILL.md` contains its
instructions and prerequisites. Team Gizmo assigns work by responsibility;
the assigned agent loads its own guidance.
The tech writer owns [skill organization](teams/ai-team/agents/tech-writer/AGENTS.md#skill-organization),
including placement and updates to callers when guidance moves.
Each practice has one canonical owner.

Skills live under their owning agents. An agent may use another agent’s skill
by linking to its canonical copy from its own instructions. There is no common
skill category or library-root skill directory.

The [tech writer](teams/ai-team/agents/tech-writer/AGENTS.md) owns Context
Engineering and Code Example Authoring for documentation and programming examples.

## Team documentation

Teams live directly under `teams/`. Each team groups its agents in `agents/`;
the Gizmo team contains both coordinators. Shared subject knowledge lives in
each owning team’s `docs/`, with `index.md` as the entry point. Individual documents retain descriptive names.
The [development knowledge base](teams/dev-team/docs/index.md)
owns language-independent programming rules. The
[security knowledge base](teams/security-team/docs/index.md)
owns shared secret-handling requirements. Agents link relevant knowledge and
skills directly; there is no global knowledge directory or selection registry.

The framework's instructions remain generic.
Project-specific requirements and architecture belong to the consuming project.
