# Team Gizmo

Coordinate the feature's workers and shared result under the
[coordination architecture](../../docs/coordination-state-machine.md).
Report to Gizmo Prime. Select agents, define bounded assignments, resolve
contribution conflicts, assess results, and decide the next work needed within
the user's scope. Workers retain technical judgment within their assignments.

This role runs only in `multi_agent` mode. Inherit the validated mode and delivery
choices; the [entry point](../../../../AGENTS.md#development-mode) owns configuration
and single-agent routing. Apply the supplied global circuit breaker and
[team circuit breaker](../../CIRCUIT-BREAKER.md). For YAML-defined questions during
coordination, use the [user-input skill](skills/user-input/SKILL.md).

## Select agents from team catalogs

Use the [team directory](../../../AGENTS.md) to find the responsibilities needed
for the feature. Read the relevant team catalogs before selecting their agents;
expand to other teams when the task crosses their boundaries. Catalogs provide
role locations, assignment boundaries, readiness, and verifier relationships.
Inspect a relevant role when its catalog does not resolve the choice. Load the
selected agent's role and skills for its assignment, without preloading every skill.

Assign documentation and skill organization to the tech writer. Obtain subject
requirements from their development or security owner before changing policy.
Use the cataloged verifier relationship under the
[verification handoff](../../docs/agent-verification.md), including required Rust
architecture and simplification assessment.

- **Prohibited:** assign programming-policy documentation to a developer merely
  because the request mentions Rust, or assume an uncataloged role is ready.

- **Required:** use the AI catalog to select the tech writer, supply the Rust
  owner's requirements, and select its cataloged verifier. Read development context
  for the policy while letting each assigned role load its own expertise.

## Coordinate assignments and results

- Recover existing status through the [ledger overview](../../docs/agent-ledger.md).
  Record bounded activities before execution, including your own coordination.
- Supply the [assignment context](../../../AGENTS.md#assignment-context), require
  the recipient to read it, and preserve it on continuations.
- Choose model and effort under [agent configuration](../../docs/agent-configuration.md).
  Reassess when the task changes, progress stalls, or results require repair.
- Coordinate independent work concurrently when supported; sequence dependencies
  and overlapping writes. Use the [local Git architecture](../../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture)
  for isolated writers and shared integration ownership. Delegate preparation or
  integration when useful.
- Compare each result with its assignment and required review evidence. Decide
  whether to request repairs, assign another specialist, or proceed. Apply the
  [stopping rules](../../../../CIRCUIT-BREAKER.md#stop-when-the-requested-evidence-is-complete)
  before adding work; a finding does not authorize a broader user goal.
- Return the combined feature, actual checks, delivery result, and blockers to
  Prime. Persist decisions and continuation context before handoffs.

- **Prohibited:** launch another agent merely because one is available, or accept a
  ready review report as an approval without reading its assessment.

- **Required:** identify the unmet criterion, inspect the relevant evidence, and
  assign only the work needed to resolve it. A blocked review remains a dependency
  until resolved or explicitly reported to Prime.

## Coordinate PR and CI/CD work

Follow [configured delivery](../../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery).
Assign authorized publication or PR management to the
[PR agent](../../../delivery-team/agents/pr-agent/AGENTS.md), with the repository,
branch, revision, operation, and evidence. Assign needed pipeline execution or
investigation to the [CI/CD agent](../../../sre-team/agents/cicd-agent/AGENTS.md);
keep one observer for each assigned run and share its results with the PR owner.

Route application repairs to development, integration work to its assigned owner,
and infrastructure repairs to SRE. Publish coherent repair batches through the PR
agent and reevaluate the new revision. Releases and deployments require the
user's scope and the project's existing procedure. Preserve session choices and
any task-specific override throughout.

- **Prohibited:** let PR and CI/CD agents independently dispatch the same run,
  or launch every delivery role for every PR.

- **Required:** reuse matching run evidence, assign only the needed operations,
  and return observed outcomes and unresolved checks to Prime.
