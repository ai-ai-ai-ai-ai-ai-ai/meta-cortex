# Agent Work Ledger

The ledger is the durable record of a feature's assignments, progress, and
integration. Host messages notify coordinators; the ledger lets a replacement
coordinator or worker recover without the final message.

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

Everyone assigned to the feature may read its status and history. Reading does
not authorize claiming a peer's assignment, expanding scope, or bypassing Gizmo.
Actor names describe trusted workflow participants; they are not credentials.
The CLI does not launch, stop, or monitor host agents.

**Prohibited:** create a database inside each worker checkout or wait until a
worker's final message to record its assignment.

**Required:** initialize one ledger for the feature and supply its ID to every
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
   current directory, then opens the native Tauri Features window.
2. Select a feature to open its execution tree. Expand an agent to see its
   recorded tasks, or select an agent or task to open a closable right detail
   panel. Narrow windows show the panel as a drawer. Use Graph, Git, and History
   for recorded relationships, dependencies, integrations, and recent activity.
   Full task records and individual event snapshots retain all ledger fields,
   including task-specific extensions.
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
         mode: Desktop
         view: {kind: Features}
         page: 0
   ```

3. Run the request to open the native window at the selected view:

   ```sh
   meta-cortex run --request dashboard.yaml
   ```

For headless observation, change the request to `mode: Snapshot`:

```sh
meta-cortex run --request dashboard.yaml > dashboard-output.yaml
```

Both modes accept file or stdin requests. Snapshot reads once and returns the
normal versioned YAML response with `data.kind: dashboard` and
`data.value.content` containing the selected view’s text.

**Prohibited:** expect `mode: Desktop` to produce a headless report.

**Required:** choose `mode: Snapshot` for scripted or redirected text output.

### Views and recorded fields

Typed requests require `mode`, `view`, and `page`. Modes and view kinds are
case-sensitive. `page` is a zero-based unsigned 32-bit integer; use `0` for task
detail, where paging does not apply. Initial views are:

- **Features:** `view: {kind: Features}` lists feature IDs, recorded branches,
  and objectives in ID order.
- **Tasks:** `view: {kind: Tasks, feature: example-feature}` lists tasks in ID
  order in Snapshot mode. Desktop mode opens the expandable execution tree with
  agent work summaries, status badges, task children, and checkpoint commits.
- **Task:** `view: {kind: Task, query: {feature: example-feature, task: example-task}}`
  shows objective, revision, attempt, created/updated/progress timestamps,
  recorded workspace, state, checkpoint and integration SHA when recorded,
  progress summary, acceptance criteria, dependencies, findings, next steps,
  checks with outcome, command and evidence, and task-specific extensions.
- **History:** `view: {kind: History, query: {feature: example-feature, task: example-task}}`
  lists events newest revision first with kind, revision, recorded-by actor,
  and note. Expand an event snapshot to inspect every recorded field and its
  full task snapshot at that revision.

States distinguish queued, working, blocked, ready, integrated, and cancelled.
Timestamps are recorded Unix milliseconds. Checks show recorded evidence and
are not rerun. Checkpoint and integration details refer to their history events
for the recording actor. Event snapshots retain their historical revision while
current views refresh. Full-feature state counts and an integrated-task percentage
summarize recorded task states. Group progress covers its loaded task page.
The hierarchy groups recorded creators and workers by role; it does not establish
host session ancestry. Each task contributes its latest 100 events to the overview;
full history can page through older records. No live execution status or agent
conversation is inferred. For example, a passed check is a worker’s recorded
result, not a new test execution by the dashboard.

**Prohibited:** treat a historical passed check as a fresh validation run.

**Required:** inspect its event revision and recorded evidence before reporting it.

### Navigation, refresh, and pages

Use the native window’s controls to navigate between features, tasks, detail,
history, and event snapshots. Scroll the window’s content to read long objectives,
notes, findings, checks, and extensions. Use Refresh to read current evidence or
Retry after an observation failure; the window does not refresh on a timer.

Feature, task, and history queries return at most 100 records per page. Typed
request page indexes and Snapshot text remain zero-based. Previous and Next
move between bounded pages. The native indicator starts at `Page 1`; its
`More`/`Complete` value describes whether another record page exists, not feature
or task completion. Snapshot retains
`Page end: More` or `Complete` to indicate whether another page exists.
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

## Assignment and worker lifecycle

Prepare the feature branch and worktree using the delivery team's existing Git
workflow. The ledger records these resources; it does not create or merge them.

1. The integration agent runs `Feature / Initialize` with the feature ID, objective,
   feature branch, and absolute feature worktree. Repeating an identical
   initialization reopens it; conflicting metadata is rejected.
2. Team Gizmo runs `Task / Create` before launching each worker. Supply its
   objective, at least one acceptance criterion, dependencies, initial continuation
   notes, and either a Git workspace or `kind: read_only`. Dependencies must
   already exist; self-dependencies and duplicates are rejected.
3. The worker reads `Task / Get` and runs `Task / Claim` with its catalog agent identity,
   expected revision, and TTL. A claim succeeds only for a queued task whose
   dependencies are integrated. The result contains its new attempt and revision.
4. While working, the worker runs `Task / Update` at meaningful milestones and
   before a potentially long operation. Choose the action from the catalog:
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
assignment even when multiple sessions execute the same role.

Prose fields accept empty strings and preserve whitespace exactly. A required
field must still be supplied as a string; omitting it or supplying `null` is a
decoding error. The acceptance list must contain at least one entry.

Workers use their returned revision for the next update. Every successful change
increments that revision and atomically appends the resulting task snapshot to
history. Two concurrent changes based on the same revision cannot both succeed.
On `conflict`, reread before deciding whether the operation still applies. Do not
blindly replay an old whole-document update.

- Worker identity and attempt must still match.
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
   progress, and history.
4. Give the replacement worker the existing task and workspace. Its next claim
   increments the attempt. Updates from the older attempt are rejected, even if
   that worker rereads the current revision.
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
This release writes command/record version `1` and database version `3`.
Version `3` uses a feature primary key, a `(feature_id, id)` task primary key,
and a `(feature_id, task_id, revision)` event primary key. Foreign keys require
each task's feature and each event's task to exist; parent deletion and key
changes are restricted while children exist. The primary-key indexes cover
feature status and ordered task history without redundant indexes. Required
columns reject nulls, revisions must be positive, and JSON IDs and revisions
must match their relational columns. Every Workbench connection enables foreign
keys. JSON retains progress, findings, checks, and task snapshots.

Version `1` and `2` databases migrate transactionally, retaining records and
history. On first access, Workbench imports the old
`~/.meta-cortex/<repo_id>/features/<feature-id>.db` files into the shared database.
Each feature imports atomically and only once; an invalid source leaves its
import uncommitted and reports an error. Stop older agents before upgrading:
old executables still write the old files. Sources and sidecars remain intact
as backups; after verifying the imported history, they may be archived or
removed together. Never resume older writers against those backups. Unsupported
versions are rejected; the CLI never resets a database or guesses how to decode
an unknown record.

There are no historical command/record formats before this feature's version
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
