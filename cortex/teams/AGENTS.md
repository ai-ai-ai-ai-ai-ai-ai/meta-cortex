# Teams

Agents are part of Meta-Cortex. They carry out the framework's development work
in the consuming project. Each role defines what it owns, who it works with,
and what results it returns. Skills provide the reusable expertise an agent
applies to its assignment.

- The [Gizmo team](gizmo-team/AGENTS.md) contains Gizmo Prime and Team Gizmo, which own feature coordination and agent assignments.
- Agents in the [development team](dev-team/AGENTS.md), [security team](security-team/AGENTS.md), and [SRE team](sre-team/AGENTS.md) implement and validate work within their assigned responsibilities, using the relevant skills.
- The [AI team](ai-team/AGENTS.md) owns agent-facing documentation and programming-rule examples through its tech writer subagent.
- The [delivery team](delivery-team/AGENTS.md) owns local feature integration
  and GitHub pull-request management through separate agents. The SRE CI/CD
  agent owns pipeline execution and infrastructure, using project-owned procedures.

Each agent's `AGENTS.md` owns its role responsibilities. Keep technical guidance
in that role's linked skills so they can evolve independently.

Use the configuration rules and resolved configuration location supplied by
the entry point before every launch. Pass this context to delegated agents.

## Start with Gizmo Prime

First resolve the session’s [development mode](../AGENTS.md#development-mode) at the entry
point. In `single_agent` mode, the current agent applies the assignment context
locally and performs the work; the launch and delegation instructions below
apply only to `multi_agent` mode.

For a new multi-agent task, read [Gizmo Prime](gizmo-team/agents/gizmo-prime/AGENTS.md) and launch it
as a subagent through the host’s agent execution tool. This subagent is the
root coordinator, using its configured model and reasoning effort.
Carry the user's objective, constraints, acceptance criteria, project context,
and the loaded circuit-breaker policy into the assignment.
Follow-ups stay with the existing coordinator.

## Communication and decisions

In multi-agent mode, team agents report results, blockers, questions, repair
needs, and recommendations only to their assigning Team Gizmo. They do not
contact peers, request work from another agent, launch subagents, or assign work.
Team Gizmo decides whether further work is needed, selects its owner, and passes
relevant evidence with that assignment. Reading another role's skill does not
authorize contacting that agent.

Team Gizmo reports to Gizmo Prime; Gizmo Prime reports to the current host agent.
Decisions and assignments travel back down the same hierarchy. Gizmo Prime does
not bypass Team Gizmo to direct workers. Agents retain technical judgment within
their assigned scope; coordination decisions belong to their Gizmo.

Use ordinary host communication tools. In single-agent mode, the current agent
performs the responsibilities locally without agent messages or launches.

**Prohibited:** the PR agent asks the CI/CD agent to rerun a failed workflow, or
the integration agent sends a conflict directly to a developer.

**Preferred:** the agent reports the failure and evidence to its Team Gizmo.
Gizmo decides the next step, assigns any repair, and supplies the resulting
evidence to agents that need it.

## Working model

Coordinators use the host's agent execution tools to launch their assigned
subagents with their linked role instructions and task context. Reading a role document does not launch
a subagent. Report unavailable subagent execution capabilities as blockers.

- Pass this team directory and its resolved document locations to coordinators.
- Keep the team directory complete. Each team's `AGENTS.md` catalogs every
  agent under its `agents/` directory with responsibilities, assignment boundaries, a role link,
  and any incomplete-role status, so Team Gizmo can select agents from these summaries.
- Gizmo Prime launches the single Team Gizmo as a subagent.
- Team Gizmo launches the team agents needed for its assignments as subagents.
- Team Gizmo assigns instructions, specifications, skills, practices, and catalog
  edits to the tech writer subagent. Pass the subject owner's requirements and affected
  documents with the assignment.

- Prepare every launch using the [assignment context](#assignment-context) below,
  including launches by Gizmo Prime and Team Gizmo.
- Load roles and skills from the library; inspect, implement, and validate the consuming project's code in the assigned working directory. Pass this context through every delegation.
- Assigned agents load their own role and relevant skills directly; they do not restart root routing or become another Gizmo Prime.
- Each agent’s `AGENTS.md` links the skills it uses. Each `SKILL.md` owns that
  skill’s instructions and prerequisites. Agents load their skills themselves;
  coordinators assign responsibilities.
- Team Gizmo assigns skill organization and placement changes to the tech writer under its
  [skill organization rules](ai-team/agents/tech-writer/AGENTS.md#skill-organization).
- Coordinate independent work concurrently when supported and sequence work with shared scope or dependencies.
- Team agents report only to Team Gizmo, which decides corrections and assignments and reports to Gizmo Prime.
- Keep work within the user's request. Completion means the requested outcome is supported by evidence, with limitations stated clearly.

## Assignment context

Before launching an agent, the host agent or Gizmo coordinator resolves the
following from the active library and supplies them in the launch instructions:

- Objective, scope, dependencies, acceptance criteria, and expected evidence.
- The assigning host agent or coordinator's identity and report destination, with the
  [communication and decisions](#communication-and-decisions) rules.
- The validated session development mode; assigned agents inherit it and never
  repeat configuration collection.
- Project root, library root, working directory, and relevant project instructions.
- The global `CIRCUIT-BREAKER.md` policy and its resolved path.
- The assigned agent’s team directory and team `AGENTS.md`.
- The team’s `CIRCUIT-BREAKER.md`, when present, plus any other team rules that
  apply to the assignment’s subject.
- The team’s `docs/` directory, its `index.md` when present, and the documents
  relevant to the assignment. Include referenced subject documents from other
  teams when the task depends on them.
- The assigned agent’s own `AGENTS.md` and the execution configuration context.

Include the policies in the supplied context or require the receiving agent to
read their resolved files before any task work. Do not assume parent-session
memory, a directory name, or an inherited conversation includes their contents.
Identify an absent team documentation directory or team circuit breaker as
absent; do not invent a file or omit the global policy. An existing required
file that cannot be read is a context blocker, not an absent optional file.

The receiving agent must, before starting work:

1. Read the global and applicable team circuit-breaker rules.
2. Read its team instructions and documentation index, then the relevant team
   documents and referenced subject requirements in full.
3. Read its own role instructions and follow its linked skills.
4. Report any required context it cannot access before doing dependent work.

Coordinators carry the same requirements through their assignments. Agents
report scope changes to their Gizmo for a decision and load newly relevant
documents for the resulting assignment. The skill’s own `SKILL.md` still owns its technical
instructions; this handoff does not select or duplicate skill contents.

**Prohibited:** launch a TypeScript agent with only “implement this component”
and its role path, assuming it already knows the development team’s programming
rules and circuit breaker.

**Preferred:** supply the project and library roots, global and development-team
circuit breakers, team instructions, documentation index and relevant programming
documents, and the TypeScript role. Require the agent to read them in the order
above before editing the component.
