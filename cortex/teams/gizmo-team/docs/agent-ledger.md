# Agent Work Ledger

The ledger is the durable record of the entire feature workflow: coordination,
assignments, implementation, verification, integration, and delivery.
Host messages notify coordinators; the ledger lets a replacement
coordinator or worker recover without the final message. The
[coordination state machine](coordination-state-machine.md) explains how ledger
states relate to workspace output, review, delivery, and the next responsible owner.

## Storage and ownership

All agents and features in one repository share one embedded Turso database.
Resolve its location from any linked project worktree:

```text
~/.meta-cortex/<repo-name>/<repo_id>/workbench.db
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
can reuse a task ID inside the same database. Never create a database per task,
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

   It resolves the existing repository identity and shared database from the
   current directory, then opens the native Tauri Workbench window.
2. The window opens on a split feature preview, newest activity first. Brief
   cards show the title, precise first-task date, expandable objective, compact
   progress, recorded roles, and PR links. The selected briefing adds the task
   inventory, latest update, start/finish times, elapsed duration, and branch.
   Open a task block or **Open workflow** to see task chapters. One shared index
   navigates both **Log** and **Time windows** in the right panel. Log actions
   show recording actors, time, revision, and expandable evidence. Time windows
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
cancelled. Integrated records Git inclusion at the feature SHA; completed records
coordinator acceptance of a read-only or feature activity.
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
shared database is missing. It does not create storage to recover from these errors.

Observation requires an existing repository identity and shared database at the
current schema version; it never initializes either. The observer uses a short
250 ms database busy timeout. Desktop read failures appear in the window;
refresh to retry or close the window to exit. Snapshot failures return structured errors
with exit status `2`.

An older or empty schema reports that migration is required; unsupported
versions are rejected. Use existing Workbench initialization/access under the
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
matches HEAD. Integration requires a clean feature worktree, a matching feature
HEAD, and the recorded checkpoint in its ancestry. These Git checks do not run
or prove tests; record actual check evidence and follow the assigned validation.
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
record version `3`, and database version `4`. `Task / Claim` and `Task / Update`
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
binding while preserving prior snapshots. The SQL layout remains version `4`;
reading older records does not rewrite them or backfill their history.

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

Database version `4` moves JSON key constraints to `common`, including nested
task snapshots in events. Feature discovery and task commands migrate older
storage transactionally, preserving historical actors and all task evidence.
Observation requires the current database schema and reports when migration is
needed; it never rewrites old storage itself. Executables without task version
`3` support cannot read newly written tasks even though the database version
remains `4`; stop older writers before upgrading.

Version `4` uses a feature primary key, a `(feature_id, id)` task primary key,
and a `(feature_id, task_id, revision)` event primary key. Foreign keys require
each task's feature and each event's task to exist; parent deletion and key
changes are restricted while children exist. The primary-key indexes cover
feature status and ordered task history without redundant indexes. Required
columns reject nulls, revisions must be positive, and JSON IDs and revisions
must match their relational columns. Every Workbench connection enables foreign
keys. JSON retains progress, findings, checks, and task snapshots.

### Storage migration and supported readers

Version `1`, `2`, and `3` databases migrate transactionally, retaining records
and history across every feature. On first access, Workbench imports the old
`~/.meta-cortex/<repo_id>/features/<feature-id>.db` files into the shared database.
Each feature imports atomically and only once; an invalid source leaves its
import uncommitted and reports an error. Stop older agents before upgrading:
old executables still write the old files. Sources and sidecars remain intact
as backups; after verifying the imported history, they may be archived or
removed together. Never resume older writers against those backups. Unsupported
versions are rejected; the CLI never resets a database or guesses how to decode
an unknown record.

There are no historical command/record formats before version
`1`. When evolving those formats, retain typed readers for the current version
and up to two previously released versions. Add explicit conversions into the
current domain model and fixture tests before advancing the writer. Do not
reinterpret older JSON through a generic map or silently add defaults that change
its meaning. Adding extension keys does not change a known schema version.

- Migrations move forward; older executables reject newer storage versions.
- Before an upgrade that changes record shapes, preserve a consistent backup
  with all writers stopped.
- To downgrade, restore that backup; do not rewrite newer records in place.
- The database stays local to the repository. Push, clone, and ordinary source
  commits do not copy it; separate clones or machines do not share this ledger.

**Prohibited:** accept version `99` using the version `1` decoder or discard
history to make an upgrade work.

**Required:** reject the unsupported version with an upgrade message, leaving
its committed data intact.
