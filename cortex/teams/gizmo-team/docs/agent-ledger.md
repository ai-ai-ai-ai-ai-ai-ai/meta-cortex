# Agent Work Ledger

The ledger is the durable record of the entire feature workflow: coordination,
assignments, implementation, verification, integration, and delivery.
Host messages notify coordinators; the ledger lets a replacement
coordinator or worker recover without the final message. The
[coordination state machine](coordination-state-machine.md) explains how ledger
states relate to workspace output, review, delivery, and the next responsible owner.

## Storage and ownership

Each feature has one embedded Turso database shared by its agents and linked
project worktrees.
Resolve its location from any linked project worktree:

```text
~/.meta-cortex/<repo-name>/<repo_id>/features/<feature>.db
```

- **Repository identity**
  - Framework or feature initialization creates a UUID in the main checkout's
    `.meta-cortex/repository-id` when it is missing.
  - Linked worktrees reuse that ID.
  - Repeated initialization and checkout renaming retain the ID.
  - Read-only commands never generate an ID.
  - Git's local exclude file ignores the identity file.
  - Initializing a fresh clone creates a new ID and storage directory, even if
    another repository has the same name.
  - Preserve the identity file when replacing the framework or restoring ledgers.
- **Storage location**
  - Keep application data outside `.git`.
  - `META_CORTEX_HOME` overrides the default `~/.meta-cortex` location.
  - The repository name labels the directory; the UUID identifies it. A renamed
    checkout reuses its existing named directory and database.
  - All repositories share Bun in that location's `bun/` directory.

Pass the consuming project path and a stable feature
ID to every command. Do not use the library's repository as the project. The
feature ID stays fixed when a host session restarts. Reuse the ID and feature
branch on follow-ups. Task IDs are scoped to their feature, so different features
can reuse a task ID in their separate databases. Never create a database per task,
agent, or worktree. Preserve the database and its engine-managed sidecars together.

- Gizmo Prime owns the feature objective and branch decision.
- Team Gizmo records assignments before launches, reads progress, and decides
  dependencies, reassignment, cancellation, and integration order.
- The integration agent prepares worktrees, initializes the feature ledger,
  verifies code integration, and records the integrated revision.
- Workers claim their assigned tasks and persist their own progress and results.
- In single-agent mode, the current agent performs these responsibilities locally.

Every participating role needs its own activity record, including both Gizmo
coordinators, workspace preparation, integration, verifiers, and PR delivery.
An integration event on a developer's task does not replace the integration
agent's own activity. An integrated task does not mean the feature was accepted
or its PR delivered.

Everyone assigned to the feature may read its status and history. Reading does
not authorize claiming a peer's assignment, expanding scope, or bypassing Gizmo.
Actor names describe trusted workflow participants; they are not credentials.
The CLI does not launch, stop, or monitor host agents.

- **Prohibited:** create a database inside each worker checkout or wait until a
  worker's final message to record its assignment.

- **Required:** initialize one ledger for the feature and supply its ID to every
  worker before launch.

## Discover and invoke commands

The installed `meta-cortex` executable includes both framework installation and
ledger commands. No database server, separate database executable, or Rust
installation is needed when using a prebuilt binary.

1. Run `meta-cortex list`. It returns the command catalog grouped into framework, feature, task, and Workbench operations, complete YAML request
   examples, and a JSON Schema generated from the actual Rust request types.
2. Adapt the example for the selected command. Set `project` to the consuming
   repository or its assigned worktree. Use the assigned feature and task IDs.
3. Send the YAML through a file or literal stdin. Do not interpolate user input
   into shell code.
4. Parse the YAML response. Exit `0` means success; exit `2` means a structured
   error with a stable code and explanation. Use the returned task revision.

```sh
meta-cortex run --request - <<'LEDGER_REQUEST'
version: 1
project: /absolute/project
operation:
  group: Feature
  command:
    name: Status
    arguments:
      feature: example-feature
LEDGER_REQUEST
```

This is a local discovery-and-call interface, similar to skill scripts. It is
not an MCP JSON-RPC server. `Framework / Initialize` and `Framework / Info` run
through the same typed YAML interface. `list` and `run` provide discovery and
request execution; `dashboard` opens interactive observation for the current repository.

Commands use `operation.group` and a group-specific `operation.command` with
`name` and `arguments`. References such as `Task / Claim` below name that pair;
they are not literal wire aliases. A group accepts only its own operations.

YAML/JSON are wire formats; the application operates on concrete Rust types.

- Requests reject unknown groups, commands, fields, enum values, duplicate fields,
  unsupported versions, malformed IDs, and out-of-range TTLs.
- Put arbitrary task-specific content only in `progress.extensions`. Known fields
  remain strictly typed.

**Prohibited:** invent a command flag or put coordination state into extensions.

**Required:** discover the schema and send `action.kind: heartbeat` with the
current revision and attempt from the previous response.

## Workbench dashboard

`meta-cortex dashboard` and typed `Workbench / Dashboard` requests observe
recorded Turso ledger content without claims, heartbeats, requeues, imports,
migrations, or other updates. It does not collect
host agent state, runtime metadata, chat content, or Git work and authorship data.
Git is used only to resolve the existing repository identity and storage path.
For example, a recorded integration SHA is ledger evidence; its event actor
identifies who recorded it, not who actually authored that Git commit.

**Prohibited:** report “RustDev authored this commit” from its Checkpoint event.

**Required:** report “RustDev recorded this checkpoint; Git authorship is unrecorded.”

### Open the dashboard

1. Run the command from the consuming repository root, any subdirectory, or a
   linked worktree, without a request file or required arguments:

   ```sh
   meta-cortex dashboard
   ```

   It resolves the existing repository identity and feature storage from the
   current directory, then opens the native Tauri Workbench window.
2. The window opens on a split feature preview, newest activity first. Brief
   cards show the title, precise first-task date, expandable objective, compact
   progress, recorded roles, and PR links. The selected briefing adds the task
   inventory, latest update, start/finish times, elapsed duration, and branch.
   Open a task block or **Open workflow** to see task chapters. One shared index
   navigates both **Log** and **Time windows** in the right panel. The
   [Revision log](#revision-log-and-event-order) shows feature-local event order,
   task revisions, recording actors, time, and expandable evidence. Time windows
   show task creation through last update, including concurrent task lifetimes.
   PR links open in the system browser.
3. Close the window to exit.

The shipped executable embeds its Svelte/TypeScript frontend assets. Native IPC
reads bounded Workbench observations; no HTTP server or browser tab is required.
Loading, empty results, and observation errors are shown in the window.

**Prohibited:** tell the user a request file is required to open the current
repository’s Features view.

**Required:** run `meta-cortex dashboard` from that repository or its linked worktree.

### Advanced typed requests

1. Run `meta-cortex list` to discover the typed `Workbench / Dashboard` request.
2. Save this request as `dashboard.yaml`, replacing `project` with the absolute
   consuming project or linked worktree path:

   ```yaml
   version: 1
   project: /absolute/project
   operation:
     group: Workbench
     command:
       name: Dashboard
       arguments:
         mode: Snapshot
         view: {kind: Features}
         page: 0
   ```

3. Run the request to read the selected view once as text:

   ```sh
   meta-cortex run --request dashboard.yaml > dashboard-output.yaml
   ```

4. To open the native window for that project instead, replace the arguments
   with only `mode: Desktop`; Desktop accepts no `view` or `page`.

Both modes accept file or stdin requests. Snapshot reads once and returns the
normal versioned YAML response with `data.kind: dashboard` and
`data.value.content` containing the selected view’s text.

**Prohibited:** expect `mode: Desktop` to produce a headless report.

**Required:** choose `mode: Snapshot` for scripted or redirected text output.

### Views and recorded fields

Snapshot requests require `mode`, `view`, and `page`. Modes and view kinds are
case-sensitive. `page` is a zero-based unsigned 32-bit integer; use `0` for task
detail, where paging does not apply. Snapshot views are:

- **Features:** `view: {kind: Features}` lists feature IDs, recorded branches,
  and objectives in ID order.
- **Tasks:** `view: {kind: Tasks, feature: example-feature}` lists tasks in ID
  order with ID, state, revision, progress summary, assigned agent, and reporting
  coordinator.
- **Task:** `view: {kind: Task, query: {feature: example-feature, task: example-task}}`
  shows objective, assigned agent and reporting line, revision, attempt,
  created/updated/progress timestamps,
  recorded workspace, state, checkpoint and integration SHA when recorded,
  progress summary, acceptance criteria, dependencies, findings, next steps,
  checks with outcome, command and evidence, and task-specific extensions.
  An active task also shows its claimed agent, expiration, and blocked reason.
- **History:** `view: {kind: History, query: {feature: example-feature, task: example-task}}`
  lists events newest revision first with kind, revision, recorded-by actor,
  and note. Expand an event snapshot to inspect every recorded field and its
  full task snapshot at that revision.

States distinguish queued, working, blocked, ready, integrated, completed, and
cancelled. Use the [recorded state meanings](#recorded-state-meanings) to interpret
their guarantees and limits.
Timestamps are recorded Unix milliseconds. Checks show recorded evidence and
are not rerun. Checkpoint and integration details refer to their history events
for the recording actor. Event snapshots retain their historical revision while
current views refresh. Full-feature state counts summarize recorded task states
in the split feature preview. A feature's deliverables are its non-cancelled tasks that no
other recorded task depends on, excluding Gizmo coordination tasks; its latest
delivery is the most recently updated integrated or completed task. A feature's
pull requests are GitHub pull request URLs found in its tasks' current progress
extensions, most often recorded first; no pull request field is stored. Feature
start uses the earliest task creation. Finish is available when all tasks are
closed and terminal events are recorded; later annotations do not extend it.
Elapsed duration includes waiting. Timeline windows instead use task creation
and last update and do not imply uninterrupted agent execution.
Feature creation and completion events are not stored.
Recorded ownership identifies the assigned role and reporting target. Task
creators, claimed workers, and event actors remain separate recorded facts; none
of them establishes an unrecorded reporting line or host session ancestry.
No live execution status or agent conversation is inferred. For example, a passed check is a worker’s recorded
result, not a new test execution by the dashboard.

**Prohibited:** treat a historical passed check as a fresh validation run.

**Required:** inspect its event revision and recorded evidence before reporting it.

### Recorded state meanings

Workbench supplies shared `StateMeaning` metadata for all seven `FlowState`
values through its generated Rust observation contract. The frontend discloses
those meanings; it must not maintain a second interpretation of the states.
The following qualifications distinguish recorded results from stronger claims:

- **Working:** the task records an active assignment with a working phase. This
  is not a measurement of a running host process or uninterrupted execution.
- **Integrated:** a ready task with a Git or read-only workspace records the
  current feature branch tip (`HEAD`) after checking that worktree is clean.
  A recorded checkpoint must be an ancestor of that tip; `Unrecorded` is allowed
  and supplies no checkpoint-inclusion evidence. This operation performs no
  merge and does not require its recording actor to be `IntegrationAgent`.
  Framework policy still assigns integration work to that role. The state does
  not establish CI success, PR merge, deployment, or feature acceptance.
- **Completed:** a ready read-only or feature activity records coordinator
  acceptance. Git workspace tasks use integration instead. Completed and
  Integrated are alternative terminal outcomes, not consecutive stages; an
  integrated task cannot transition to completed.

**Prohibited:** “Working proves the agent is executing; Integrated proves its PR
merged; the next step is to mark that integrated task Completed.”

**Required:** report the recorded working phase or integration tip with its
actual evidence. Accept a ready read-only or feature activity through completion;
report feature acceptance and delivery separately.

### Revision log and event order

The selected feature's **Revision log** orders events by `EventSequence` in
that feature's database. New appends use a feature-local sequence. The log
shows this as `R`; `Task r` remains the task-local `TaskRevision` used for
optimistic updates. Its numeric wire format is unchanged. An attempt identifies
a task claim, not an event's position. `FeatureWorkflow.revision_log` exposes
entries with `feature`, `task`, `sequence`, `provenance`, and the recorded
`FeedEntry` in `entry`. Event JSON stays unchanged; sequence and provenance
belong to the storage envelope and observation result.

- A successful mutation appends its event in the same `IMMEDIATE` transaction
  as its task change. Database schema version `6` assigns its sequence through
  `AUTOINCREMENT`; no separate counter service or read-side increment exists.
- New entries have `CommittedAppend` provenance. Their sequence orders committed
  appends in this feature database, independently of worker clocks and task revisions.
- Imported entries retain their original sequence and provenance. Historical
  positions from the shared repository database may have gaps belonging to other
  features. Import and display never renumber them or claim a new global order.
- Entries migrated from pre-sequence schemas `1` through `4` retain actual event
  `rowid` values with `LegacyStorageOrder` provenance, including holes. These
  values preserve storage order; they cannot recover original commit chronology.
- Migration from version `5` to `6` preserves existing sequence values and
  provenance, including `CommittedAppend`, without renumbering events.
- Sequence values are not promised to be gapless. A rolled-back allocation can
  be reused. Equal or larger `R` values in different feature databases establish
  no cross-feature ordering.
- Reading the log does not change event order, task revisions, attempts, or stored
  snapshots. Use the current task revision, never `R`, in `expected_revision`.

**Prohibited:** relabel imported `R41` and `R44` as `R1` and `R2`, infer that
another feature's `R45` happened later, or send `expected_revision: 44` when the
selected task is at revision `7`.

**Required:** retain `R41` and `R44` with their provenance, show task revisions
separately, and use that task's observed revision `7` for its next update.
Interpret later appends within the selected feature only.

### Historical ownership

Version `1` tasks did not record intended ownership or reporting lines.
Their views label that information `unrecorded`. A retained active or ready
claim can identify the claimed role, but it cannot establish a reporting line.
Current views and historical event snapshots use only their recorded information.

**Prohibited:** infer that a historical integration event proves a coordinator
or integration activity existed.

**Required:** show the old reporting line as unrecorded and record the actual
roles and activities when continuing the feature.

### Refresh and pages

The native feature list reads up to 100 features, most recently active first;
features without tasks follow in ID order. It notes when more exist and refreshes every five seconds; Pause stops automatic reads, Refresh
reads at once, and Retry follows an observation failure. Selected workflow detail
consumes all task/history pages and refreshes when recorded activity changes.
Evidence repeated across revisions appears only when changed.

Feature, task, and history queries return at most 100 records per page. Snapshot
request page indexes and text remain zero-based. Snapshot retains
`Page end: More` or `Complete` to indicate whether another page exists, not
feature or task completion.
Each query releases its connection after reading. Pages use live offsets, so
concurrent writes can shift records between pages. For example, a new history
event can push an older event onto the next page.

- **Prohibited:** assume a page retains the same records while new events arrive.
- **Required:** refresh and compare event revisions across the live pages.

### Storage requirements and errors

`meta-cortex dashboard` reports a structured error with exit status `2` before
opening the window when run outside Git or when repository identity or the
ledger storage is missing. It does not create storage to recover from these errors.

Observation requires an existing repository identity and ledger storage at the
current schema version; it never initializes either. Feature discovery reads
feature files and legacy sources without importing or migrating them. The current
per-feature file takes precedence over legacy copies. The observer uses a short
250 ms database busy timeout. Desktop read failures appear in the window;
refresh to retry or close the window to exit. Snapshot failures return structured errors
with exit status `2`.

An older or empty schema reports that migration is required; unsupported
versions are rejected. Errors identify the affected feature and schema version.
Use existing Workbench initialization/access under the
[version and migration contract](#versions-and-durable-contracts), then retry.
Those operations retain their migration and import semantics; opening the
dashboard does not perform them. For example, observing a version `2` database
reports the required migration instead of upgrading it.

- **Prohibited:** expect Dashboard to migrate a version `2` database.

- **Required:** complete the existing Workbench upgrade workflow, then retry observation.

## Record the entire feature workflow

Use ordinary tasks for every feature responsibility. A task identifies an
activity; `Task / Assign` records its intended role and reporting coordinator.
The reporting line is scoped to the feature's single Prime and Team Gizmo.
Different tasks may belong to the same role. Role identities describe recorded
responsibilities, not host processes or proof that a subagent was launched.

1. Prepare or reuse the feature workspace and initialize its ledger through the
   existing bootstrap procedure. Before routine assignments begin, record Prime,
   Team Gizmo, and workspace preparation activities. Include the initial scope,
   branch decision, and workspace setup results in their progress. If the ledger
   already exists, record coordination before launching downstream work.
2. Create a `read_only` activity for Prime and another for Team Gizmo.
   Use `Task / Assign` with their actual roles and reporting lines. Each
   coordinator claims its own activity and records decisions, findings,
   acceptance checks, blockers, and next steps through `Task / Update`.
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
6. Complete Team Gizmo's activity only after the selected local or PR delivery
   outcome is recorded. Prime accepts that result, records its final acceptance
   evidence, and completes its own activity before the final host handoff.
   In single-agent mode, the current agent records these responsibilities locally
   without claiming that separate host agents ran.

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
      actor: {team: Gizmo, role: Gizmo}
      assignment:
        agent: {team: Delivery, role: IntegrationAgent}
        reports_to: {kind: Gizmo, coordinator: Gizmo}
```

Use the observed revision in actual calls. Prime's assignment uses
`agent: {team: Gizmo, role: GizmoPrime}` with `reports_to: {kind: Host}`.
Team Gizmo uses `agent: {team: Gizmo, role: Gizmo}` with
`reports_to: {kind: Gizmo, coordinator: GizmoPrime}`. Every specialist reports to
`{kind: Gizmo, coordinator: Gizmo}`. Assignment validates this hierarchy and
survives claim, readiness, integration, completion, cancellation, and requeue.

**Prohibited:** record only developer tasks, put relationships in extensions,
or mark the feature complete while integration and PR delivery are unrecorded.

**Required:** retain Prime → Team Gizmo → integration and specialist reporting
lines, with progress and acceptance evidence on each participating role's activity.

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

**Prohibited:** a resumed TechWriter generates a new UUID for each heartbeat,
then a replacement copies the last UUID because it has the same role.

**Required:** the resumed instance keeps its original UUID for every task and
update. A replacement generates its own UUID and claims the task after the
coordinator's inspected requeue. Both keep `agent: {team: Ai, role: TechWriter}`.

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

**Prohibited:** omit `worker_id` because `agent` already names TechWriter, or
copy this illustrative UUID into a real agent's first claim.

**Required:** generate the instance's UUID once, then supply that same value
in its claim and heartbeat alongside the matching role and attempt.

## Assignment and worker lifecycle

Prepare the feature branch and worktree using the delivery team's existing Git
workflow. The ledger records these resources; it does not create or merge them.

1. The integration agent runs `Feature / Initialize` with the feature ID, objective,
   feature branch, and absolute feature worktree. Repeating an identical
   initialization reopens it; conflicting metadata is rejected.
2. Team Gizmo runs `Task / Create` before launching each worker. Supply its
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
   - `checkpoint` records a real commit from the task branch with continuation notes.
   - `ready` records the final result before sending the completion notification.
5. Team Gizmo reads durable readiness and directs the integration agent. After
   merging and running the assigned combined checks, that agent records
   `Task / Coordinate` with `action.kind: integrate` and the feature HEAD.

`agent` and `actor` contain a team and a role from that team's catalog. The
Rust identity encloses a team-specific role enum; the generated schema permits
only its matching combinations. Examples of these identity fields:

```yaml
actor:
  team: Gizmo
  role: Gizmo
agent:
  team: Development
  role: RustDev
```

The two coordinators are `Gizmo/GizmoPrime` and `Gizmo/Gizmo`. Specialist teams
are `Development`, `Ai`, `Security`, `Sre`, and `Delivery`; discover their roles
with `meta-cortex list`. For example, integration uses
`{team: Delivery, role: IntegrationAgent}`. `Sre/RustDev` is impossible in the
Rust model and rejected in requests and stored records. Flat strings such as
`rust-dev`, unknown roles, and host session identifiers are rejected. Do not
silently relabel historical actors or move them between teams.
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
matches HEAD. The [integration transition](#recorded-state-meanings) checks the
clean feature worktree and its current tip, with checkpoint ancestry only when
a checkpoint is recorded. These Git checks do not run or prove tests; record
actual check evidence and follow the assigned validation.
The command does not support recording a squash/rebase that drops the checkpoint
from ancestry; retain the existing merge-based local integration workflow.

**Prohibited:** merge unfinished code into the feature merely to publish a
heartbeat, or treat a successful database write as proof of passing tests.

**Required:** commit a worker milestone, record its SHA and next steps, then
continue on the worker branch until ready for integration.

## Recovery and stale work

A lease expiring is an observation, not proof the worker has stopped. There is
no background TTL process. Status computes expiration when queried.

1. On startup, after interruption, and before assigning more work, Gizmo reads
   `Feature / Status`. Use `Feature / List` to rediscover feature IDs and paths
   when the coordinator context is lost. Inspect `last_update`, `last_progress`, the lease health,
   current checkpoint, and continuation notes. Read `Task / History` when needed.
   Recover session mode and delivery choices from the
   [assignment context](../../AGENTS.md#assignment-context). An integrated ledger
   task does not imply PR delivery is complete. Apply the
   [delivery policy](../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery)
   before the final handoff; collect any missing session choice through the entry
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

**Prohibited:** start a replacement solely because the TTL elapsed, or require
a lost final message before inspecting an existing branch.

**Required:** inspect the execution, preserve its workspace, then resume from
the recorded task plus any newer Git changes.

## Versions and durable contracts

Command protocol, persisted record, and physical database versions are distinct.
This release writes command, feature, and event-envelope version `1`, task
record version `3`, and database version `6`. `Task / Claim` and `Task / Update`
require `worker_id`; discover their current request shapes with `meta-cortex list`.
Task readers explicitly convert supported version `1` and `2` records into the
current model with unrecorded worker identity. Version `1` ownership also remains
unrecorded. Readers never invent historical workers or reporting lines. Historical
envelopes, actors, revisions, attempts, timestamps, and evidence remain intact.

Version `1` task records retain their released flat format. Version `2` encloses
stable fields in `common`: identity, objective, acceptance, dependencies, revision,
attempt, timestamps, checkpoint, and progress. Ownership, workspace, and state
remain version-specific fields. Later records can reuse `TaskCommon` while its
field types and meanings remain unchanged; changes need a new common type so
retained readers keep their released contracts. Serde decodes both versions into
the current task model alongside version `3`; writers emit only version `3`.

Version `3` adds `worker` beside `common`, `ownership`, `workspace`, and `state`.
It is either `{kind: Unrecorded}` or
`{kind: Recorded, worker_id: <UUID>}`. Claim records the worker; readiness,
integration, completion, and cancellation retain it. Requeue clears the current
binding while preserving prior snapshots. Worker identity belongs to the task
record, independently of database event ordering. Reading older task records
does not rewrite them or invent historical worker identities.

- **Prohibited:** derive UUIDs from old roles or event actors while reading
  version `1` or `2` records.
- **Required:** read their worker as `Unrecorded` and preserve their historical
  snapshots. Only a current claim or valid worker update can record a worker UUID.

### Continue an older active claim

1. Preserve the existing active task's role and attempt after upgrading.
2. Have its actual continuing instance send its retained UUID with the next
   valid `Task / Update`. The update checks the recorded role and attempt before
   binding an unrecorded worker identity.
3. Use that UUID on every later update. Once recorded, another UUID is rejected.
   Prior event snapshots remain unrecorded; the successful update records the
   binding only in the new revision.

**Prohibited:** assign the current worker's UUID to all earlier snapshots, or
let a replacement bind an old active claim without inspected requeue.

**Required:** the continuing instance records its own UUID on its next valid
update. A replacement follows recovery and makes a new claim with its own UUID.

### Database constraints

Database version `6` retains the event sequence introduced in version `5`.
Its JSON identity and revision constraints accept the supported record shapes:
flat version `1` fields and the `common` fields in later versions. Migration
preserves original JSON bytes instead of rewriting old event snapshots to match
a newer record shape. Event sequences use an `AUTOINCREMENT`
primary key; `(feature_id, task_id, revision)` remains unique. Feature and task
keys, foreign keys, and JSON identity/revision checks retain their existing
meaning. Each task requires its feature and each event requires its task;
parent deletion and key changes remain restricted while children exist.
Required columns reject nulls, task revisions must be positive, and JSON IDs
and revisions must match their relational columns. Every Workbench connection
enables foreign keys.

Commands selecting a feature migrate only its supported older storage
transactionally. `Feature / List` and dashboard observation never migrate storage;
they report when migration is needed. Every write transaction checks the current
schema after acquiring the transaction, before changing records. An already-open
writer therefore rejects a schema upgraded beyond its supported version.
JSON retains actors, task snapshots, findings, checks,
and evidence. [Event order](#revision-log-and-event-order) records whether its
sequence came from a committed append or preserved legacy storage order.

- **Prohibited:** an already-open writer trusts its startup schema check and
  appends after another executable upgrades the database to a future version.
- **Required:** check the schema inside the acquired write transaction and reject
  the unsupported version before changing the task or appending its event.

### Invalid legacy data during migration

A version `6` migration must fail atomically when legacy rows violate its
constraints. Leave the prior schema and committed history intact and report the
failure. Diagnose and resolve the integrity problem separately before rollout;
an upgrade must not silently remap sequence values, deduplicate rows, or rewrite
recorded history to make invalid data pass.

**Prohibited:** migration finds conflicting legacy identities, renumbers or
drops their events, and reports that the upgrade succeeded.

**Required:** abort the migration transaction, preserve the source, and report
the constraint failure. Keep rollout blocked until the integrity problem is
resolved through separately authorized work and the isolated migration succeeds.

### Storage migration and supported readers

A command selecting a feature migrates supported version `1`, `2`, `3`, `4`, or `5`
storage to version `6` transactionally. It leaves other feature databases alone.
A future schema version is rejected without mutation or downgrade.

**Prohibited:** selecting `alpha` upgrades `beta`, or accepting version `99`
rewrites its schema as version `6`.

**Required:** migrate only `alpha` when supported; reject its future version
with feature/version context and leave committed data unchanged.

### Selected legacy import

When the current feature file is absent, Workbench can import that feature from
the historical repository-wide
`~/.meta-cortex/<repo-name>/<repo_id>/workbench.db` or the older
`~/.meta-cortex/<repo_id>/features/<feature>.db` layout. Legacy sources are read
only. Import copies only the selected feature, preserving record and event JSON,
actors, timestamps, revisions, sequence values, provenance, and gaps. It does not
migrate or update the source database. An invalid source leaves the import
uncommitted and reports an error. Sources and their engine-managed sidecars
remain intact; preserve them together.

**Prohibited:** importing `alpha` copies every feature or renumbers its events.

**Required:** copy only `alpha`, preserve its stored JSON and ordering envelope,
and leave the legacy source and sidecars intact.

### Legacy writer shutdown

Stop **all legacy shared-store writers** before transitioning any feature.
Released older binaries cannot be fenced by the new executable and may continue
writing the shared source after import. Mixed-layout writers are unsafe, even
when they work on different features. Keep old writers stopped throughout the
transition and use the current executable for later work. The transactional
schema check protects current writers against a newer schema; it cannot control
released binaries writing a different file.

**Prohibited:** import feature `alpha`, leave an older agent writing
`workbench.db`, and assume the new `alpha.db` will receive its later updates.

**Required:** stop legacy writers, preserve the source and sidecars, import
`alpha` through its selected command, and continue it only with current writers.
Verify retained history before separately deciding whether to archive backups.

### Released format support

There are no historical command/record formats before version
`1`. When evolving those formats, retain typed readers for the current version
and up to two previously released versions. Add explicit conversions into the
current domain model and fixture tests before advancing the writer. Do not
reinterpret older JSON through a generic map or silently add defaults that change
its meaning. Adding extension keys does not change a known schema version.

- Rebuild or install the current executable before using the new schema and
  request contract. Stop older writers before upgrading; do not mix executable
  versions against upgraded storage.
- Validate migration using an isolated cloned ledger. Do not upgrade a shared
  live ledger merely to obtain test evidence while older writers still use it.
- Migrations move forward. Current writers reject unsupported newer schemas
  within every write transaction; released legacy writers still require shutdown.
- Before an upgrade that changes record shapes, preserve a consistent backup
  with all writers stopped.
- To downgrade, restore that backup; do not rewrite newer records in place.
- The database stays local to the repository. Push, clone, and ordinary source
  commits do not copy it; separate clones or machines do not share this ledger.

**Prohibited:** accept version `99` using the version `1` decoder or discard
history to make an upgrade work.

**Required:** reject the unsupported version with an upgrade message, leaving
its committed data intact.
