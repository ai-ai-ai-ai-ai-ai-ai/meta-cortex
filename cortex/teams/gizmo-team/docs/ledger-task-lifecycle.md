# Ledger Tasks and Recovery

Reference for recording activities, claiming work, reporting outcomes, and
recovering interruptions. The [operational overview](agent-ledger.md) identifies
the responsibilities; `meta-cortex list` supplies current request schemas.

## Record the entire feature workflow

Use ordinary tasks for every feature responsibility. A task identifies an
activity; `Task / Assign` records its intended role and reporting coordinator.
The reporting line is scoped to the feature's single Gizmo Prime coordinator.
Different tasks may belong to the same role. Role identities describe recorded
responsibilities, not host processes or proof that a subagent was launched.

1. Prepare or reuse the feature workspace and initialize its ledger through the
   existing bootstrap procedure. Before routine assignments begin, record Prime's
   coordination activity and the delegated workspace preparation activity. Include
   the initial scope, branch decision, and workspace setup results in progress.
   If the ledger already exists, record coordination before downstream launches.
2. Create one `read_only` coordination activity for Prime with `reports_to: {kind: Host}`.
   Prime claims that activity and records scope, scheduling, decisions, findings,
   acceptance checks, blockers, and next steps through `Task / Update`.
   Do not create a second coordinator activity or a Prime-to-Prime reporting line.
3. Create and assign activities for all selected specialists before their work.
   Include integration, verifier, documentation, security, pipeline, and PR
   responsibilities when selected. Integration and PR operations on the shared
   feature worktree use `workspace: {kind: feature}`. Implementation tasks retain
   their separate Git workspaces. Read-only review and coordination use
   `workspace: {kind: read_only}`.
4. Keep each activity's revision and attempt in its assignment context. Record
   progress at milestones and heartbeat while waiting for downstream results.
   Use a blocked phase when progress depends on a decision or failed operation.
   Never make a worker depend on completing its supervising coordinator;
   dependency gates require integrated or completed work.
5. Workers record readiness before notifying their coordinator. Integrate code
   tasks with the verified feature SHA. Accept ready read-only or feature
   activities through `Task / Coordinate` with `action.kind: complete`.
   Completion retains their ownership, reporting line, and evidence. Feature
   readiness requires a clean feature worktree and no worker checkpoint.
6. After the selected local or PR delivery outcome is recorded, Prime evaluates
   the combined result against the acceptance criteria. Record final acceptance
   once and complete Prime's coordination activity before the host handoff.

For example, after creating integration's activity, assign its reporting line:

```yaml
version: 1
project: /absolute/project
operation:
  group: Task
  command:
    name: Assign
    arguments:
      feature: example-feature
      task: integration
      expected_revision: 1
      actor: {team: Gizmo, role: GizmoPrime}
      assignment:
        agent: {team: Delivery, role: IntegrationAgent}
        reports_to: {kind: Gizmo, coordinator: GizmoPrime}
```

Use the observed revision in actual calls. Prime's assignment uses
`agent: {team: Gizmo, role: GizmoPrime}` with `reports_to: {kind: Host}`.
Every specialist, including integration, PR, and independent verification,
reports directly to `{kind: Gizmo, coordinator: GizmoPrime}`. Assignment validates
this hierarchy; ownership survives claim, readiness, integration, completion,
cancellation, and requeue.

## Worker instance identity

`AgentId` identifies a catalog role, such as `Ai/TechWriter`. `WorkerId`
identifies one host agent instance and is a validated, non-nil UUID. Stored
UUIDs use lowercase, hyphenated form. Several instances may share a role; one
instance may work on several tasks.

1. Generate a UUID once when a host agent instance starts. Generate it locally
   with an existing UUID tool, such as `uuidgen`; do not use the role, task ID,
   branch, hostname, or host task path as the ID.
2. Keep the exact UUID in that instance's session and continuation context.
   Retain it across turns, follow-ups, resumed execution, and later assignments
   to the same instance. Do not generate one per claim, task, or update.
3. Report that UUID to the assigning coordinator through the existing host
   communication. The coordinator retains and forwards the reported value
   unchanged when continuing that same instance. Host names and task paths
   may identify message provenance; they are not globally unique worker IDs.
4. Give every newly spawned or replacement instance its own newly generated UUID.
   A replacement does not adopt its predecessor's ID, even when resuming the
   same role, task, or workspace. If the same instance's retained ID is missing,
   recover it from its continuation or coordinator context before updating.
5. Include `worker_id` in every `Task / Claim` and `Task / Update` request.
   Keep the catalog role in `agent`; the worker UUID does not replace it.
   Use the returned revision and attempt for subsequent updates.

### Claim and update requests

The following illustrative requests assume an assigned, dependency-ready task
at revision `2`. Replace the example UUID with the calling instance's retained
UUID and use actual returned revisions and attempts. Both requests require
`worker_id`; omission, `null`, nil or malformed UUIDs, and unknown aliases are rejected.

```yaml
version: 1
project: /absolute/project
operation:
  group: Task
  command:
    name: Claim
    arguments:
      feature: example-feature
      task: documentation
      expected_revision: 2
      agent: {team: Ai, role: TechWriter}
      worker_id: 0fdfbf88-dcff-49b5-81a2-17eae97da30c
      ttl_seconds: 3600
```

Assuming that claim returns revision `3` and attempt `1`, its heartbeat is:

```yaml
version: 1
project: /absolute/project
operation:
  group: Task
  command:
    name: Update
    arguments:
      feature: example-feature
      task: documentation
      expected_revision: 3
      agent: {team: Ai, role: TechWriter}
      worker_id: 0fdfbf88-dcff-49b5-81a2-17eae97da30c
      attempt: 1
      action: {kind: heartbeat, ttl_seconds: 3600}
```

## Assignment and worker lifecycle

Prepare the feature branch and worktree using the [local feature architecture](../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture). The ledger records these resources; it does not create or merge them.

1. The integration owner runs `Feature / Initialize` with the feature ID, objective,
   feature branch, and absolute feature worktree. Repeating an identical
   initialization reopens it; conflicting metadata is rejected.
2. Gizmo Prime runs `Task / Create` before launching each worker. Supply its
   objective, at least one acceptance criterion, dependencies, initial continuation
   notes, and the appropriate workspace. Dependencies must
   already exist; self-dependencies and duplicates are rejected.
   Run `Task / Assign` on the queued task with its observed revision, intended
   agent, and reporting line. Only queued tasks accept assignment changes.
   Reassignment to another role requires an inspected requeue first.
3. The worker reads `Task / Get` and runs `Task / Claim` with its catalog role,
   retained worker UUID, expected revision, and TTL. A claim succeeds only for a
   queued task whose dependencies are integrated or completed. The agent must match recorded
   ownership when available. The result contains its new attempt and revision.
4. While working, the worker runs `Task / Update` at meaningful milestones and
   before a potentially long operation. Supply the same worker UUID with each
   update. Choose the action from the catalog:
   - `heartbeat` renews activity and expiration without claiming meaningful progress.
   - `progress` records findings, next steps, checks, and a working or blocked phase.
   - `checkpoint` records a real commit from the task branch with continuation notes
     and an explicit [implementation outcome set](#record-implementation-outcomes).
   - `ready` records the final result before sending the completion notification.
5. Gizmo Prime reads durable readiness and decides integration. After
   integrating and running the assigned combined checks, the integration owner records
   `Task / Coordinate` with `action.kind: integrate` and the feature HEAD.

`agent` and `actor` contain a team and a role from that team's catalog. The
Rust identity encloses a team-specific role enum; the generated schema permits
only its matching combinations. Examples of these identity fields:

```yaml
actor:
  team: Gizmo
  role: GizmoPrime
agent:
  team: Development
  role: RustDev
```

The active coordinator is `Gizmo/GizmoPrime`. Specialist teams are
`Development`, `Ai`, `Security`, `Sre`, and `Delivery`; discover their roles
with `meta-cortex list`. For example, integration uses
`{team: Delivery, role: IntegrationAgent}`. `Sre/RustDev` is impossible in the
Rust model and rejected in requests and stored records. Flat strings such as
`rust-dev`, unknown roles, and host session identifiers are rejected. Do not
silently relabel historical actors or move them between teams. Historical
`Gizmo/Gizmo` records retain their retired coordinator identity under the
[storage contract](ledger-storage.md#versions-and-durable-contracts); they do not
make that retired role available for new assignments or claims.
Task IDs remain per-assignment values. The task and attempt identify the claimed
assignment; the [worker UUID](#worker-instance-identity) identifies the executing
instance across assignments.

Prose fields accept empty strings and preserve whitespace exactly. A required
field must still be supplied as a string; omitting it or supplying `null` is a
decoding error. The acceptance list must contain at least one entry.

Workers use their returned revision for the next update. Every successful change
increments that revision and atomically appends the resulting task snapshot to
history. Two concurrent changes based on the same revision cannot both succeed.
On `conflict`, reread before deciding whether the operation still applies. Do not
blindly replay an old whole-document update.

- Catalog role, worker UUID, and attempt must still match the active claim.
- TTLs range from 1 to 86400 seconds. Choose enough time for the next operation
  and renew before expiry.
- Timestamps are Unix milliseconds generated by the CLI.
- Keep checkpoints on the task branch. A checkpoint may contain unfinished code;
  state and continuation notes must say so.

A write task can become ready only when its worktree is clean and its checkpoint
matches HEAD. The [integration transition](homeostat-dashboard.md#recorded-state-meanings) checks the
clean feature worktree and its current tip, with checkpoint ancestry only when
a checkpoint is recorded. These Git checks do not run or prove tests; record
actual check evidence and follow the assigned validation.
The current integration command requires checkpoint ancestry. An integration
that drops that checkpoint from history cannot be recorded by this API; this is
a runtime limitation, not a prescribed Git command sequence.

## Record implementation outcomes

Workers record concise implementation outcomes at real Git checkpoints. These
describe implemented behavior or durable guidance, rather than activity such as
“started work” or “ran tests.” Progress and checks keep their existing evidence
fields. The [Feature log](homeostat-dashboard.md#feature-log) projects outcomes only after the owning
Git task integrates with recorded checkpoint inclusion.

### Declare checkpoint outcomes

1. Commit the implemented milestone on the assigned task branch. Inspect its
   changes and use the full valid checkpoint SHA.
2. Send `Task / Update` with `action.kind: checkpoint` and `outcomes`. Each
   outcome has a validated task-local `id`, a concise `summary`, and a `detail`
   explaining the concrete result. Discover the current request with
   `meta-cortex list`; use the active worker UUID, attempt, and returned revision.
3. Supply the complete set of outcomes accepted at this checkpoint. IDs must be
   unique within the set. Reuse an ID when updating or reaffirming the same
   milestone; use distinct IDs for distinct milestones.
4. Record findings, actual checks, and next steps in `progress` as before.
   An unfinished checkpoint may record implemented milestones, but its task
   remains active and those outcomes do not appear in Feature log yet.

### Reaffirm the complete final set

Each checkpoint's `outcomes` replaces the prior complete set. Omission and an
empty list both mean no outcomes at that checkpoint. An omitted milestone is
not automatically included from an earlier private checkpoint. Readiness does
not copy or restore earlier outcome declarations. Removed outcomes remain in
history but disappear from the current Feature log projection.

1. Before final readiness, follow the
   [local feature architecture](../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture).
   Validate the final revision.
2. Record a checkpoint at that final SHA with the complete accepted outcome set.
   Reaffirm retained milestones using their existing IDs. Several milestones
   may share this final SHA; equal summaries do not merge their IDs.
3. Record readiness using the next returned revision. Send the final SHA and
   validation evidence to Gizmo Prime. Integration later supplies its own evidence;
   the final checkpoint alone does not prove inclusion in the feature branch.

For example, a worker has implemented both journal navigation and expandable
evidence across private checkpoints. At readiness, reaffirm both against
the final commit. This illustrative request assumes revision `8`, attempt `1`,
an active TechWriter claim, and a valid committed task HEAD. Replace all example
identity, revision, and commit values with the observed assignment values:

```yaml
version: 1
project: /absolute/project-docs
operation:
  group: Task
  command:
    name: Update
    arguments:
      feature: example-feature
      task: journal-guidance
      expected_revision: 8
      agent: {team: Ai, role: TechWriter}
      worker_id: 0fdfbf88-dcff-49b5-81a2-17eae97da30c
      attempt: 1
      action:
        kind: checkpoint
        ttl_seconds: 3600
        commit: 0123456789abcdef0123456789abcdef01234567
        outcomes:
          - id: journal-navigation
            summary: Document journal navigation
            detail: Explain the default Feature log and links to task Log chapters.
          - id: journal-evidence
            summary: Document journal evidence
            detail: Distinguish checkpoint recorder and time from task integration evidence.
        progress:
          summary: Journal guidance consolidated and validated at final task HEAD.
          findings: []
          next_steps: [Record readiness and hand the final SHA to Gizmo Prime.]
          checks: []
          extensions: {}
```

## Recovery and stale work

Apply [execution reassessment](agent-configuration.md#reassess-and-change-execution-settings)
when recovering work or assigning repairs. Retain meaningful continuation
decisions and evidence in existing notes; notes do not configure or stop a host
agent.

A lease expiring is an observation, not proof the worker has stopped. There is
no background TTL process. Status computes expiration when queried.

1. On startup, after interruption, and before assigning more work, Prime reads
   `Feature / Status`. Use `Feature / List` to rediscover feature IDs and paths
   when the coordinator context is lost. Inspect `last_update`, `last_progress`, the lease health,
   current checkpoint, and continuation notes. Read `Task / History` when needed.
   Recover session delivery from the
   [assignment context](../../AGENTS.md#assignment-context). An integrated ledger
   task does not imply PR delivery is complete. Apply the
   [delivery policy](../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery)
   before the final handoff; collect missing delivery through the entry
   point rather than inferring it from an existing branch or ledger.
2. For expired or stalled work, inspect the host execution and its worktree.
   Stop the previous execution or establish that it finished before reassignment.
   Long tests may still be running even when no heartbeat arrives.
3. Record `Task / Coordinate` with `action.kind: requeue`, a reason, and
   `previous_execution: stopped_or_finished`. This is the coordinator's explicit
   acknowledgement, not an automatic host check. Preserve the branch, checkpoint,
   progress, and history. Requeue clears the current worker binding; historical
   snapshots retain their recorded identity.
4. Give the replacement worker the existing task and workspace. Its next claim
   increments the attempt and binds its own worker UUID. Resuming the same host
   instance retains its UUID; a replacement uses a new one under the
   [worker identity rules](#worker-instance-identity). Updates from the older
   attempt are rejected, even if that worker rereads the current revision.
5. For integration failures, requeue the task after inspecting the previous
   execution and pass the repair context. After all integrated work and checks are
   complete, follow existing workspace cleanup rules. Keep the feature ledger.

- Use cancellation only when the assignment is no longer wanted.
- Retain cancelled records and history.
- Neither cancellation nor requeue stops an agent process.

Git commits and Turso transactions are separate operations. If a worker commits
and exits before recording its checkpoint, inspect the existing task branch and
worktree to recover that newer work. Never reset or remove an interrupted
worktree merely because its ledger checkpoint is older. Uncommitted edits still
need that worktree; the ledger is not a copy of their contents.
