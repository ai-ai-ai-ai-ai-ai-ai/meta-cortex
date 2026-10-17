# Teams

Agents are part of Meta-Cortex. They carry out the framework's development work
in the consuming project. Each role defines what it owns, who it works with,
and what results it returns. Skills provide the reusable expertise an agent
applies to its assignment.

- The [Gizmo team](gizmo-team/AGENTS.md) contains Gizmo Prime, which owns feature coordination and direct specialist assignments.
- Agents in the [development team](dev-team/AGENTS.md), [security team](security-team/AGENTS.md), and [SRE team](sre-team/AGENTS.md) implement and validate work within their assigned responsibilities, using the relevant skills.
- The [AI team](ai-team/AGENTS.md) owns agent-facing documentation and programming-rule examples through its tech writer and read-only tech writer verifier.
- The [delivery team](delivery-team/AGENTS.md) owns local feature integration
  and GitHub pull-request management through separate agents. The SRE CI/CD
  agent owns pipeline execution and infrastructure, using project-owned procedures.

Each agent's `AGENTS.md` owns its role responsibilities. Keep technical guidance
in that role's linked skills so they can evolve independently.

Team catalogs may add a `Verifier:` role link to any agent's entry. Prime follows
that relationship through the shared
[agent verification handoff](gizmo-team/docs/agent-verification.md).
The verifier's own skill selects its subject catalogs; coordination is shared.

Read and apply the shared [agent configuration rules](gizmo-team/docs/agent-configuration.md)
before every launch, using the resolved configuration location supplied by the
entry point. Pass this context to delegated agents.

## Start with Gizmo Prime

Resolve the session's [delivery choice](../AGENTS.md#development-delivery) and
host capacity at the entry point. For each new task, read
[Gizmo Prime](gizmo-team/agents/gizmo-prime/AGENTS.md) and launch it
as a subagent through the host’s agent execution tool. This subagent is the
root coordinator, with execution settings assessed for the feature under the
shared configuration rules, using supported controls or known inheritance.
Carry the user's objective, constraints, acceptance criteria, project context,
and the loaded circuit-breaker policy into the assignment.
Follow-ups stay with the existing coordinator.

## Communication and decisions

The [coordination architecture](gizmo-team/docs/coordination-state-machine.md)
owns the Host → Gizmo Prime → specialist hierarchy, decision authority, expected
handoffs, and [human messages](gizmo-team/docs/coordination-state-machine.md#write-useful-human-messages).
Use ordinary host tools for launches and notifications and the
[ledger overview](gizmo-team/docs/agent-ledger.md) for durable progress. Reading a
role or recording an assignment does not launch an agent. Report unavailable
host execution as a blocker.

**Prohibited:** a worker bypasses Gizmo Prime to ask a peer for repairs, or claims
that reading the peer's instructions launched it.

**Required:** report the failure and evidence to Gizmo Prime, which decides and
launches the needed assignment through the host.

## Working model

- Keep each team's catalog complete: every agent has responsibilities, assignment
  boundaries, a role link, readiness, and any cataloged verifier relationship.
  Gizmo Prime selects from these summaries and investigates relevant roles further
  when needed.
- Each agent's `AGENTS.md` links its skills; each `SKILL.md` owns its instructions
  and prerequisites. Assigned agents load those skills themselves without
  restarting root routing. Reading another skill does not assign its role.
- Load roles and skills from the library. Inspect, implement, and validate the
  consuming project in the assigned worktree. Pass both locations through
  delegation under the [assignment context](#assignment-context).
- Documentation and skill organization belong to the tech writer under its
  [organization rules](ai-team/agents/tech-writer/AGENTS.md#skill-organization).
  Subject owners retain authority over programming and security requirements.

**Prohibited:** preload every worker's skill collection to choose one role,
or edit the installed library to fix the consuming application's component.

**Required:** select the TypeScript role from its team catalog, supply the
application scope and both roots, and let that worker load its skills and edit
its assigned project worktree.

## Assignment context

Before launching an agent, the host agent or Gizmo Prime resolves the
following from the active library and supplies them in the launch instructions:

- Objective, target scope, permitted changes, dependencies, acceptance criteria,
  expected evidence, and stopping condition. Use the
  [handoff contract](gizmo-team/docs/coordination-state-machine.md#describe-each-transition-with-an-observable-outcome)
  to state the operation, output, and next owner. State whether the task is review
  or verification only, implementation, or an explicitly requested workflow exercise.
- For task workers after feature initialization: stable feature ID, task ID,
  ledger location, and the [agent ledger protocol](gizmo-team/docs/agent-ledger.md).
  Record the assignment before launching its worker. Coordinator and workspace
  bootstrap assignments establish this context before task workers launch.
- The activity's assigned role, recorded reporting coordinator, and current
  ledger revision and attempt. Carry the instance's retained worker UUID on
  continuations under the [worker identity protocol](gizmo-team/docs/ledger-task-lifecycle.md#worker-instance-identity).
  New instances establish their own identity through that protocol.
  Coordinator activities use the same context once the feature ledger is available.
- The assigning host agent or coordinator's identity and report destination, with the
  [communication and decisions](#communication-and-decisions) rules.
- The validated session `development.delivery` and any task-specific override;
  assigned agents inherit delivery and never repeat collection.
- The [capacity assessment](gizmo-team/docs/agent-configuration.md#check-host-capacity):
  project ceiling, known host limits and evidence, unresolved capabilities, and
  scheduling decisions.
- Project root, library root, working directory, and the scoped handoff required
  by [consuming project context](gizmo-team/docs/project-context.md).
- The global `CIRCUIT-BREAKER.md` policy and its resolved path.
- The assigned agent’s team directory and team `AGENTS.md`.
- The team’s `CIRCUIT-BREAKER.md`, when present, plus any other team rules that
  apply to the assignment’s subject.
- The team’s `docs/` directory, its `index.yaml` when present, and the documents
  relevant to the assignment. Include referenced subject documents from other
  teams when the task depends on them.
- The assigned agent’s own `AGENTS.md` and the execution configuration context,
  including the active host reference when needed, relevant limits, and consequential
  settings choices or continuation decisions under the
  [selection policy](gizmo-team/docs/agent-configuration.md#choose-settings-for-the-assignment).

Include the policies in the supplied context or require the receiving agent to
read their resolved files before any task work. Do not assume parent-session
memory, a directory name, or an inherited conversation includes their contents.
Identify an absent team documentation directory or team circuit breaker as
absent; do not invent a file or omit the global policy. An existing required
file that cannot be read is a context blocker, not an absent optional file.

The receiving agent must, before starting work:

1. Read the global and applicable team circuit-breaker rules.
2. Apply [consuming project context](gizmo-team/docs/project-context.md), then
   read its team instructions and documentation index and the relevant team
   documents and referenced subject requirements in full.
3. Read its own role instructions and follow its linked skills.
4. Report any required context it cannot access before doing dependent work.

The host and Prime carry these requirements through their assignments. Agents
report proposed scope changes to Prime. Prime may adjust assignments within
the user's scope; a broader goal requires user authorization through the hierarchy.
Load newly relevant documents only for the authorized assignment.
The skill’s own `SKILL.md` still owns its technical
instructions; this handoff does not select or duplicate skill contents.

- For verifiers, supply the review objective, committed scope, available evidence,
  and the verifier's role and skill. The shared
  [review contract](gizmo-team/agents/gizmo-prime/skills/agent-verification/SKILL.md)
  leaves further context selection and investigation to the reviewer.

**Prohibited:** launch a TypeScript agent with only “implement this component”
and its role path, assuming it already knows the development team’s programming
rules and circuit breaker.

**Required:** supply the project and library roots, global and development-team
circuit breakers, team instructions, documentation index and relevant programming
documents, and the TypeScript role. Require the agent to read them in the order
above before editing the component.
