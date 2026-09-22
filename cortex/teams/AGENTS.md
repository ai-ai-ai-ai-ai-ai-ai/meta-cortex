# Teams

Agents are part of Meta-Cortex. They carry out the framework's development work
in the consuming project. Each role defines what it owns, who it works with,
and what results it returns. Skills provide the reusable expertise an agent
applies to its assignment.

- The [Gizmo team](gizmo-team/AGENTS.md) contains Gizmo Prime and Team Gizmo, which own feature coordination and agent assignments.
- Agents in the [development team](dev-team/AGENTS.md), [security team](security-team/AGENTS.md), and [SRE team](sre-team/AGENTS.md) implement and validate work within their assigned responsibilities, using the relevant skills.
- The [AI team](ai-team/AGENTS.md) owns agent-facing documentation and programming-rule examples through its tech writer subagent.

Each agent's `AGENTS.md` describes its role. Keep role responsibilities here
and technical guidance in linked skills so they can evolve independently.

Use the configuration rules and resolved configuration location supplied by
the entry point before every launch. Pass this context to delegated agents.

## Start with Gizmo Prime

For a new user task, read [Gizmo Prime](gizmo-team/agents/gizmo-prime/AGENTS.md) and launch it
as a subagent through the host’s agent execution tool. This subagent is the
root coordinator, using its configured model and reasoning effort.
Carry the user's objective, constraints, acceptance criteria, and
project context into the assignment.
Follow-ups stay with the existing coordinator.

## Working model

Use the host's agent execution tools to launch subagents with their linked
role instructions and task context. Reading a role document does not launch
a subagent. Report unavailable subagent execution capabilities as blockers.

- Pass this team directory and its resolved document locations to coordinators.
- Keep the team directory complete. Each team's `AGENTS.md` catalogs every
  agent under its `agents/` directory with responsibilities, assignment boundaries, a role link,
  and any incomplete-role status, so Team Gizmo can select agents from these summaries.
- Gizmo Prime launches the single Team Gizmo as a subagent.
- Team Gizmo launches the team agents needed for its assignments as subagents.
- Assign instructions, specifications, skills, practices, and catalog edits to
  the tech writer subagent. Pass the subject owner's requirements and affected
  documents with the assignment.

- Each assignment names its objective, scope, dependencies, and expected evidence, and carries the library root, project root, assigned working directory, and relevant project instructions.
- Load roles and skills from the library; inspect, implement, and validate the consuming project's code in the assigned working directory. Pass this context through every delegation.
- Assigned agents load their own role and relevant skills directly; they do not restart root routing or become another Gizmo Prime.
- Each agent’s `AGENTS.md` links the skills it uses. Each `SKILL.md` owns that
  skill’s instructions and prerequisites. Agents load their skills themselves;
  coordinators assign responsibilities.
- Route skill organization and placement changes to the tech writer under its
  [skill organization rules](ai-team/agents/tech-writer/AGENTS.md#skill-organization).
- Coordinate independent work concurrently when supported and sequence work with shared scope or dependencies.
- Return results and blockers through Team Gizmo to Gizmo Prime; route corrections back to the responsible agent.
- Keep work within the user's request. Completion means the requested outcome is supported by evidence, with limitations stated clearly.
