# Coordination State Machine

Meta-Cortex turns a user's idea into an evidenced result through bounded agent
responsibilities. Its coordination state machine describes who can perform the
next operation, which inputs make it possible, and what result transfers
responsibility. This is the framework's evolving architecture and communication
specification; update it when an authorized workflow change alters that boundary.

## Required actions

### Keep the state domains separate

Use the following distinctions when planning, reporting, and recovering work.
They describe the existing framework, not additional stored states.

- **Feature:** the user's objective, accepted scope, dependencies, and selected
  delivery outcome. Prime owns acceptance; a task finishing does not finish the
  feature. The ledger does not store feature creation or acceptance events.
- **Task:** the bounded responsibility and its recorded lifecycle. The
  [ledger protocol](agent-ledger.md#assignment-and-worker-lifecycle) owns its
  transitions: `queued`; `active` with `working` or `blocked` phase; `ready`;
  `integrated`; `completed`; and `cancelled`. Apply the ledger's
  [recorded state meanings](agent-ledger.md#recorded-state-meanings): a working
  phase is recorded activity, while integration and completion are alternative
  terminal outcomes. Cancellation is not success.
- **Worker:** the executing host instance, separate from its catalog role.
  Apply the [worker identity protocol](agent-ledger.md#worker-instance-identity)
  for UUID retention. Revision, attempt, and identity checks remain ledger
  preconditions; an assignment record does not prove a host agent launched.
- **Workspace:** the concrete branch/path/base and its inspected Git condition.
  A prepared workspace is an operation's output, not a task lifecycle state.
  Workspace readiness neither means implementation is ready nor ends an
  integration activity that still has merges or checks to perform.
- **Review:** a report about one exact committed revision, with its verdict,
  coverage, findings, and limitations. A review task's `ready` state means the
  report is ready, not that the reviewed change passed.
- **Delivery:** the actual local result or published PR required by the selected
  session choice. Integration does not establish publication, and publication
  does not establish merge, deployment, or feature acceptance.

**Prohibited:** “The workspace is ready, so integration is complete and the
feature is delivered.” This confuses three independent outcomes.

**Required:** “Integration prepared the worker workspace. Team Gizmo can now
launch implementation. The integration activity still awaits the verified worker
revision and combined checks; PR delivery remains later work.”

### Distinguish event order from task progress

The [ledger's event order](agent-ledger.md#revision-log-and-event-order) places
new committed events in a feature-local sequence. It does not replace a task's
optimistic revision, claim attempt, or worker UUID. Historical events preserve
their historical sequence positions, provenance, and gaps. Legacy storage order
does not recover commit chronology, and separate feature sequences establish
no cross-feature order.

**Prohibited:** treat a larger `R` in another feature as a later event, or fill
historical gaps by renumbering the feature's events.

**Required:** cite the feature and `R` when locating a ledger event, and the task's
own revision and attempt when describing update preconditions. Preserve historical
positions and ordering limitations without changing recorded history.

### Describe each transition with an observable outcome

For every bounded operation, identify its preconditions and inputs, its owner
and permitted scope, the evidence it produces, the expected output, and the next
responsible owner or dependency. The stages below are human descriptions of the
existing workflow. They do not add a state enum, command, or tracking service.
Use the linked subject procedures for execution and durable transitions.

**Prohibited:** “Claim own activity and execute assigned scope.” Claiming names
a bookkeeping operation but leaves the actual work and next dependency unknown.

**Required:** “Integration, prepare the supplied feature and worker workspaces
from the assigned base; return their paths, branches, starting SHAs, and checks
to Team Gizmo so it can launch the named implementation tasks.”

#### Establish feature scope

- **Preconditions and inputs:** the host has resolved session choices, project
  context, the requested outcome, and its permitted changes.
- **Owner and operation:** Prime defines the bounded feature outcome and gives
  Team Gizmo its scope, acceptance criteria, feature workspace decision, and
  delivery choice through the existing communication hierarchy.
- **Evidence and output:** the assignment names the feature, selected workspace,
  constraints, and stopping condition. Record bootstrap decisions in the
  [feature activities](agent-ledger.md#record-the-entire-feature-workflow) once
  the ledger is available.
- **Next owner and expected state:** Team Gizmo can plan concrete activities and
  assign workspace preparation. Neither implementation nor feature acceptance
  has occurred merely because the plan exists.

**Prohibited:** treat Prime's feature plan as evidence that worker tasks ran.

**Required:** pass the plan to Team Gizmo, which records and assigns the next
bounded activity before launching its owner.

#### Prepare workspace output

- **Preconditions and inputs:** Team Gizmo supplies the feature/base decision,
  existing workspaces, named worker tasks, dependency order, and required checks.
- **Owner and operation:** integration prepares or reuses the feature branch and
  workspace, prepares the assigned worker workspaces, and initializes or reopens
  the ledger as required. Follow [workspace setup](../../delivery-team/agents/integration-agent/skills/local-feature/practices/local_feature/workspace-setup.md#set-up-workspaces)
  and [feature ledger integration](../../delivery-team/agents/integration-agent/skills/agent-ledger/SKILL.md).
- **Evidence and output:** return each task's branch, absolute path, fixed base
  SHA, and branch/status checks to Team Gizmo, alongside the feature branch/path
  and ledger context. Report existing edits or setup failures concretely.
- **Next owner and expected state:** Team Gizmo can launch the named assignments
  in the prepared workspaces. Integration records this milestone as progress
  when its activity also owns later merges; its next dependency is a verified
  ready worker revision, not “execute scope.”

**Prohibited:** “Workspace ready; integration done.” Then mark the whole
integration activity `ready` even though assigned merges and checks remain.

**Required:** “Integration → Team Gizmo, workspace preparation for `parser`:
`task/parser` at `/project-parser` is clean at the supplied base SHA. Feature
`feature/editor` remains at `/project`. Launch the parser task there; integration
now awaits its verified ready SHA.” These paths and names are illustrative;
actual handoffs contain the observed full SHAs and check results.

#### Assign and perform task work

- **Preconditions and inputs:** the task exists, its role and reporting line are
  assigned, and the worker has its bounded scope, workspace, checks, and context.
  Claiming also requires the ledger's dependency and revision preconditions.
- **Owner and operation:** Team Gizmo launches the selected worker. That worker
  claims its task and performs the concrete function in its assignment, using
  its retained UUID and returned attempt/revision under the ledger protocol.
- **Evidence and output:** milestone progress names what changed or was learned,
  checks actually run, and the next operation. A blocker names the failed or
  missing input and who must resolve it. A heartbeat reports activity only.
- **Next owner and expected state:** working or blocked progress keeps the task
  active. A completed worker result and its required evidence permit readiness
  and a handoff to Team Gizmo. For write work, use the existing
  [task completion procedure](../../delivery-team/agents/integration-agent/skills/local-feature/practices/local_feature/task-commits.md#finish-task-work).

**Prohibited:** “RustDev is blocked; retry later,” without the failed operation
or the dependency needed to continue.

**Required:** “RustDev → Team Gizmo, parser task, validation: the assigned check
cannot resolve the supplied fixture path. The implementation checkpoint is
recorded; please resolve the fixture location before I rerun that check.” Include
the retained worker UUID and diagnostic when needed to distinguish the execution.

#### Review the committed result

- **Preconditions and inputs:** Team Gizmo has a durable ready worker result and
  has checked its Git handoff. The selected verifier receives a resolvable exact
  commit SHA, permitted review scope, operational context, and required evidence.
- **Owner and operation:** the cataloged verifier performs read-only review under
  the [verification handoff](agent-verification.md). Existing review requests,
  complete coverage, and report requirements remain authoritative.
- **Evidence and output:** return the exact reviewed SHA, verdict, complete
  findings, coverage, and validation limitations to Team Gizmo.
- **Next owner and expected state:** Team Gizmo routes in-scope repairs to the
  worker for authorized implementation, or directs integration of the matching
  passing revision. A review-only task ends with its report; it does not authorize
  repairs. A replacement revision needs its own complete review.

**Prohibited:** “RustVerifier, review the parser when ready,” without an exact
revision or a defined review result.

**Required:** “Team Gizmo → RustVerifier, parser review: review the supplied full
`commit_sha` read-only using your complete catalog and the attached verification
request. Return the verdict, all findings, coverage, and check limitations to me.
I will route repairs or assign integration of that exact SHA.” Here `commit_sha`
stands for the actual resolvable commit in the request, not a branch name or a
literal placeholder sent to the verifier.

#### Integrate the verified change

- **Preconditions and inputs:** Team Gizmo supplies the ready task's branch,
  workspace, checkpoint, and required review evidence for the same SHA.
- **Owner and operation:** integration applies the
  [reviewed integration gate](../../delivery-team/agents/integration-agent/skills/local-feature/spec/reviewed-integration.md)
  and existing merge procedure, then runs the assigned combined checks.
- **Evidence and output:** report the task and destination branch, resulting
  feature SHA, actual check outcomes, and durable integration result. A conflict
  or failed check includes its operation, revisions, and diagnostic.
- **Next owner and expected state:** after the policy-required merge and checks,
  record the worker task as `integrated` under the
  [transition's actual guarantees](agent-ledger.md#recorded-state-meanings).
  Team Gizmo routes a failure to its responsible owner or
  advances to remaining integration and delivery work. The integration activity
  itself completes only after its assigned responsibilities are accepted.

**Prohibited:** call a clean merge “feature verified” when combined checks failed.

**Required:** return the merge SHA and failed check separately to Team Gizmo;
name the repair dependency before any later integration or delivery claim.

#### Deliver and accept the feature

- **Preconditions and inputs:** the integrated feature satisfies its required
  checks, and the selected delivery choice and project policy are known.
- **Owner and operation:** Team Gizmo follows
  [configured delivery](../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery).
  The PR agent owns authorized publication under `create_pr`; `local_only`
  returns the validated local result. Prime owns final feature acceptance.
- **Evidence and output:** PR delivery reports its URL, published revision, and
  observed checks. Local delivery reports the feature branch/path, validation,
  and remaining work. Preserve the user's feature worktree in either case.
- **Next owner and expected state:** Team Gizmo returns the actual delivery result
  to Prime. Prime compares it with acceptance criteria and returns the supported
  outcome or remaining blocker to the host. Complete coordination activities
  through the ledger's existing workflow; do not invent feature terminal events.

**Prohibited:** “PR delivered” because the implementation task is integrated,
or “CI passed” while the published revision's checks are pending.

**Required:** “PR agent → Team Gizmo: the assigned feature revision is published
at the returned PR URL; CI remains pending. Team Gizmo can report publication
and the pending check to Prime, without claiming a passing result.”

### Write useful human messages

Use concise prose for assignments, progress, blockers, review results, handoffs,
and delivery reports. Keep material context visible to the recipient:

- Identify sender and recipient, the task, and the retained worker UUID when
  needed to distinguish instances. Follow the existing hierarchy.
- Name the current stage and concrete operation within its permitted scope.
- State the expected or achieved result, relevant evidence, and the next
  responsible owner or dependency. Distinguish an intended next step from an
  observed transition.
- Carry changed revisions, paths, check results, or blockers when they matter.
  Reuse known assignment context instead of repeating it on every routine ping.
- Keep durable milestones in the ledger. Host messages notify their recipient;
  they do not replace task history or manufacture evidence of execution.

**Prohibited:** repeat a giant state dump on every heartbeat, or send “all done”
without the result and next owner.

**Required:** “TechWriter → Team Gizmo, documentation task: the canonical draft
is committed at the supplied SHA and its link check passed. The worktree is
clean; the result is ready for your handoff check and paired review.” A routine
waiting ping can simply name the unchanged dependency in that established context.

### Keep recorded facts distinct from plans

Record assignment facts from the actual actor, task, assigned role, reporting
target, and objective. Put a planned next operation in explicit continuation
notes when it is known. Missing plans remain unrecorded; an assignment event
cannot establish that a worker claimed, launched, or executed that operation.
Preserve existing history when improving later notes.

**Prohibited:** an assignment note says “RustDev started implementation” when
only the queued task's ownership changed, or rewrites old notes to imply that plan.

**Required:** report who assigned which task to RustDev, its reporting target,
and the recorded objective. Separately state the intended implementation step
in continuation notes when supplied by the coordinator.

## Prohibited actions

Do not implement this narrative as a second ledger, forced JSON message envelope,
new lifecycle enum, string validator, or workflow service. Existing host tools,
role instructions, and typed ledger operations own execution. In single-agent
mode, the current agent performs the responsibilities locally and accurately
reports that no separate host agents ran.

**Prohibited:** reject ordinary progress because it lacks a new message schema,
or infer host execution from a task's recorded role.

**Required:** improve the assignment's concrete wording and use the existing
host and ledger workflow. Keep claims tied to observed operations and evidence.
