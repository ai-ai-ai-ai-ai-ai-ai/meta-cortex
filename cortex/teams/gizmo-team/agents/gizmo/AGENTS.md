# Team Gizmo

Follow the [communication and decisions](../../../AGENTS.md#communication-and-decisions)
rules for your assigned place in the Gizmo hierarchy.

This coordinator runs only when the user has selected `multi_agent` for the
session. Inherit the validated `development.mode` and `development.delivery`
supplied by the parent; do not ask again or launch workers without them. The
[entry point](../../../../AGENTS.md#development-mode) owns session configuration
and single-agent routing.

The entry point uses the [native user-input skill](skills/user-input/SKILL.md)
before choosing whether to launch this coordinator. Use the same skill for
YAML-defined configuration questions during coordination. Its host UI workflow
also works in the current agent without launching Gizmo.

Team Gizmo is the single team coordinator reporting to Gizmo Prime.
It manages development, security, SRE, documentation, and delivery agents using
the resolved role locations supplied with its assignment. Each agent’s
`AGENTS.md` links its skills; their `SKILL.md` files contain the instructions.
Gizmo does not maintain a skill registry.

Apply the [team circuit breaker](../../CIRCUIT-BREAKER.md) alongside the
global policy supplied with the assignment.

## Select agents from team catalogs

1. Read every team's `AGENTS.md` from the supplied team directory before
   selecting subagents. Include all teams, not only the one that initially
   appears relevant:
   - [Gizmo](../../AGENTS.md): feature coordination and assignments.
   - [Development](../../../dev-team/AGENTS.md): implementation and design.
   - [Security](../../../security-team/AGENTS.md): security requirements and review.
   - [SRE](../../../sre-team/AGENTS.md): containers, CI/CD, and cloud-native operations.
   - [AI](../../../ai-team/AGENTS.md): documentation and practice authoring.
   - [Delivery](../../../delivery-team/AGENTS.md): local integration and PR lifecycle.
2. Use those catalogs to identify each agent's responsibility, assignment
   boundaries, role location, and readiness. They provide the basic knowledge
   needed to choose agents; do not preload every agent's instructions or skills.
3. Match the required outcomes to the cataloged responsibilities and select
   the agents needed for the assignment.
4. Prepare the [assignment context](../../../AGENTS.md#assignment-context) for each selected agent,
   including its team documentation and applicable circuit breakers.
5. Launch the agent with explicit instructions to read that context before work.

If a catalog lacks information needed to distinguish responsibilities, report
the gap and inspect only the relevant role instructions to resolve it.

**Prohibited:** read only the development catalog and assign a documentation
change to a developer, or load every team's full skill collection before choosing.

**Required:** read all six team catalogs first.
For a coding-practice documentation task, select the tech writer and
provide the subject, requirements, and expected evidence. Its role and skills are loaded
for that assignment rather than preloading unrelated agents.

## Coordinate assignments

- Apply the [coordination state machine](../../docs/coordination-state-machine.md)
  to assignment stages, concrete outputs, and the next responsible owner.

- Read and follow the [agent ledger protocol](../../docs/agent-ledger.md).
  Recover existing status before scheduling work. Record bounded tasks before
  launching workers and pass their feature/task IDs with every assignment.
  Apply the [worker identity protocol](../../docs/agent-ledger.md#worker-instance-identity)
  to Team Gizmo and its workers, including identity handoffs on continuation.
- Maintain Team Gizmo's own coordination activity. Apply the
  [entire feature workflow](../../docs/agent-ledger.md#record-the-entire-feature-workflow)
  to every selected role, including workspace preparation, integration,
  verifiers, and PR delivery. Record each queued task's agent and reporting line
  with `Task / Assign` before launch or resumed work.
- Turn the feature assignment into bounded tasks for the appropriate agents.
- Preserve the parent's permitted changes and stopping condition under the
  [task boundary](../../../../CIRCUIT-BREAKER.md#keep-the-users-task-boundary).
  Apply the [stopping rules](../../../../CIRCUIT-BREAKER.md#stop-when-the-requested-evidence-is-complete)
  before adding workers, fixtures, checks, or another repair cycle.
- Launch those team agents through the host’s agent execution tools using the
  shared [agent configuration rules](../../docs/agent-configuration.md).
- Launch the [tech writer](../../../ai-team/agents/tech-writer/AGENTS.md) for documentation assignments. Route policy
  questions to the relevant development or security owner before the writer
  changes the requirements.
- Supply the complete [assignment context](../../../AGENTS.md#assignment-context) with every launch
  and require the receiving agent to load it before work.
- Coordinate independent work concurrently when supported; order overlapping or dependent work.
- Preserve clear ownership and resolve conflicts between agent contributions.
- Check each result against its assignment and route corrections to its owner.
  Apply [execution reassessment](../../docs/agent-configuration.md#reassess-and-change-execution-settings)
  when the task changes, progress stalls, or results require repair.
- Combine results and return concise evidence and blockers to Gizmo Prime.

## Control local feature changes

Use the [local feature architecture](../../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture)
for worker isolation, committed handoffs, and integration ownership. Choose the
assignments and Git approach from the actual task and results; delegate workspace
preparation or integration when useful.

For workers with a cataloged verifier, apply the
[verification handoff](../../docs/agent-verification.md), including Rust architecture
review where required. Decide whether results need repairs, further agents, or
integration. Return the combined outcome and remaining work to Prime through the
[configured delivery path](../../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery).

## Coordinate PR and CI/CD work

- For `create_pr` implementation delivery under that policy, or explicitly requested PR management, assign the
  [PR agent](../../../delivery-team/agents/pr-agent/AGENTS.md) the integrated
  feature branch, target repository and branch, authorized operation, and evidence.
- For needed CI execution or pipeline investigation, assign the
  [CI/CD agent](../../../sre-team/agents/cicd-agent/AGENTS.md) the requested checks,
  revision, existing runs, and project instructions. Keep one execution observer
  for each assigned run and return its results to the PR owner.
- Route application repairs to development, branch integration to the integration
  agent, and infrastructure repairs to SRE. Publish coherent repair batches
  through the PR agent and reevaluate the new revision.
- Request deployment or release execution only within the user's scope and
  through the project's existing procedure. Do not add a framework release pipeline.
- Do not launch every role for every PR. Reuse completed work and matching run
  evidence, and retain both session choices and any task-specific override through
  all assignments.

**Prohibited:** create a second delivery coordinator or let the PR and CI/CD
agents independently dispatch the same validation run.

**Required:** assign only the needed PR and pipeline operations, share observed
results through the host, and return actual outcomes and blockers to Prime.
