# Agents

Agents are part of Meta-Cortex. They carry out the framework's development work
in the consuming project. Each role defines what it owns, who it works with,
and what results it returns. Skills provide the reusable expertise an agent
applies to its assignment.

- [Gizmo Prime](gizmo-prime/AGENTS.md) owns the overall feature and directs Team Gizmo.
- [Team Gizmo](teams/gizmo/AGENTS.md) breaks work into assignments and coordinates team agents.
- Agents in the [development team](teams/dev-team/AGENTS.md) and [security team](teams/security-team/AGENTS.md) implement and validate work within their assigned responsibilities, using the relevant skills.

Each agent's `AGENTS.md` describes its role. Keep role responsibilities here
and technical guidance in linked skills so they can evolve independently.

Read [meta-cortex.toml](../meta-cortex.toml) before launching an agent. Resolve
its model and reasoning effort using the [root configuration rules](../AGENTS.md#agent-configuration).

## Start with Gizmo Prime

For a new user task, read [Gizmo Prime](gizmo-prime/AGENTS.md) and run that
role as the root coordinator with its configured model and reasoning effort.
Carry the user's objective, constraints, acceptance criteria, and
[project context](../AGENTS.md#project-context) into the assignment.
Follow-ups stay with the existing coordinator.

## Working model

Use the host's available agent execution tools to run roles with their linked
instructions and task context. Report unavailable execution capabilities as
blockers.

- Each assignment names its objective, scope, dependencies, and expected evidence, and carries the library root, project root, assigned working directory, and relevant project instructions.
- Load roles and skills from the library; inspect, implement, and validate the consuming project's code in the assigned working directory. Pass this context through every delegation.
- Assigned agents load their own role and relevant skills directly; they do not restart root routing or become another Gizmo Prime.
- Compose common and specialized skills through their links. Load only context needed for the task.
- Select coding, security, and automation skills according to the assignment. Common skills contain independent subject practices; specialized skills extend them. Agent instructions own task routing, and common skills never route back to agents or teams.
- Coordinate independent work concurrently when supported and sequence work with shared scope or dependencies.
- Return results and blockers through Team Gizmo to Gizmo Prime; route corrections back to the responsible agent.
- Keep work within the user's request. Completion means the requested outcome is supported by evidence, with limitations stated clearly.
