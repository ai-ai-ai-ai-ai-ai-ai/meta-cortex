# Agents

Agents are part of Meta-Cortex. They carry out the framework's development work
in the consuming project. Each role defines what it owns, who it works with,
and what results it returns. Skills provide the reusable expertise an agent
applies to its assignment.

- [Gizmo Prime](gizmo-prime/AGENTS.md) owns the overall feature and directs Team Gizmo.
- [Team Gizmo](teams/gizmo/AGENTS.md) breaks work into assignments and coordinates team agents.
- Agents in the [development team](teams/dev-team/AGENTS.md) and [security team](teams/security-team/AGENTS.md) implement and validate work within their assigned responsibilities, using the relevant skills.
- The [AI team](teams/ai-team/AGENTS.md) owns agent-facing documentation and programming-rule examples through its tech writer subagent.
- The [delivery team](teams/delivery-team/AGENTS.md) owns local feature integration
  through its integration agent.

Each agent's `AGENTS.md` describes its role. Keep role responsibilities here
and technical guidance in linked skills so they can evolve independently.

Use the configuration rules and resolved configuration location supplied by
the entry point before every launch. Pass this context to delegated agents.

## Start with Gizmo Prime

For a new user task, read [Gizmo Prime](gizmo-prime/AGENTS.md) and launch it
as a subagent through the host’s agent execution tool. This subagent is the
root coordinator, using its configured model and reasoning effort.
Carry the user's objective, constraints, acceptance criteria, and
project context into the assignment.
Follow-ups stay with the existing coordinator.

## Working model

Use the host's agent execution tools to launch subagents with their linked
role instructions and task context. Reading a role document does not launch
a subagent. Report unavailable subagent execution capabilities as blockers.

- Pass the role directory above and its resolved document locations to coordinators.
- Keep the team directory complete. Each team's `AGENTS.md` catalogs every
  agent it contains with responsibilities, assignment boundaries, a role link,
  and any incomplete-role status, so Team Gizmo can select agents from these summaries.
- Gizmo Prime launches the single Team Gizmo as a subagent.
- Team Gizmo launches the team agents needed for its assignments as subagents.
- Assign instructions, specifications, skills, practices, and catalog edits to
  the tech writer subagent. Pass the subject owner's requirements and the
  applicable coding or security prerequisites with the assignment.

- Each assignment names its objective, scope, dependencies, and expected evidence, and carries the library root, project root, assigned working directory, and relevant project instructions.
- For repository changes, pass the local-feature skill selected by composition.
  Include the feature branch/worktree and each write assignment's task branch,
  worktree, and base branch. Resolve library paths independently of task paths.
- Load roles and skills from the library; inspect, implement, and validate the consuming project's code in the assigned working directory. Pass this context through every delegation.
- Assigned agents load their own role and relevant skills directly; they do not restart root routing or become another Gizmo Prime.
- Use the supplied skill-composition instructions to select common prerequisites and specialized skills. Pass the selections and their document locations with each assignment.
- Select coding, security, and automation skills according to the assignment. Common skills contain independent subject practices; specialized skills extend them. Agent instructions own task routing, and common skills never route back to agents or teams.
- Coordinate independent work concurrently when supported and sequence work with shared scope or dependencies.
- Return results and blockers through Team Gizmo to Gizmo Prime; route corrections back to the responsible agent.
- Keep work within the user's request. Completion means the requested outcome is supported by evidence, with limitations stated clearly.

## Local feature ownership

- Gizmo Prime owns the feature scope, base decision, and final acceptance.
- Team Gizmo assigns the integration agent from the delivery catalog for local
  write work. It accepts contributions, orders integration, routes repairs,
  and authorizes cleanup. Keep one active integration agent per feature.
- The integration agent owns feature and task workspace setup and is the sole
  feature-branch writer. Implementing agents save changes in their assigned task
  worktrees and return handoffs through Team Gizmo.
- Read-only work does not launch an integration agent or create write workspaces.
- Local completion ends at a validated feature branch. Publishing or PR work
  requires a separately authorized workflow and is outside this role's scope.

**Prohibited:** each worker merges its own branch into the feature while Gizmo
only collects completion messages.

**Preferred:** workers return task branches; Team Gizmo accepts and orders
them; the integration agent reports the feature branch and combined checks to Team Gizmo.
Gizmo Prime evaluates that result against the feature objective.
