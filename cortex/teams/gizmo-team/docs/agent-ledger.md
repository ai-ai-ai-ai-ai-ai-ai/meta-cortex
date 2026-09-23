# Agent Work Ledger

The ledger is the durable record of a feature's assignments, progress, and
integration. Host messages notify coordinators; the ledger lets a replacement
coordinator or worker recover without the final message.

## Storage and ownership

Each feature has its own embedded Turso database. Resolve its location from any
linked project worktree:

```text
<git rev-parse --path-format=absolute --git-common-dir>/meta-cortex/features/<feature-id>.db
```

The CLI resolves this path. Pass the consuming project path and a stable feature
ID to every command. Do not use the library's repository as the project. The
feature ID stays fixed when a host session restarts. Reuse the ID and feature
branch on follow-ups. Different features use different files, even when task IDs
coincide. Preserve the database and its engine-managed sidecars together.

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

**Preferred:** initialize one ledger for the feature and supply its ID to every
worker before launch.

## Discover and invoke commands

The installed `meta-cortex` executable includes both framework installation and
ledger commands. No database server, separate database executable, or Rust
installation is needed when using a prebuilt binary.

1. Run `meta-cortex list`. It returns the command catalog, complete YAML request
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
  name: GetFeatureStatus
  arguments:
    feature: example-feature
LEDGER_REQUEST
```

This is a local discovery-and-call interface, similar to skill scripts. It is
not an MCP JSON-RPC server. `InitializeFramework` and `GetFrameworkInfo` run
through the same typed YAML interface. `list` and `run` are the CLI commands.

Requests reject unknown commands, fields, enum values, duplicate fields,
unsupported versions, malformed IDs, and out-of-range TTLs. YAML/JSON are wire
formats; the application operates on concrete Rust types. Arbitrary task-specific
content belongs only in `progress.extensions`. Known fields remain strictly typed.

**Prohibited:** invent a command flag or put coordination state into extensions.

**Preferred:** discover the schema and send `action.kind: heartbeat` with the
current revision and attempt from the previous response.

## Assignment and worker lifecycle

Prepare the feature branch and worktree using the delivery team's existing Git
workflow. The ledger records these resources; it does not create or merge them.

1. The integration agent runs `InitializeFeature` with the feature ID, objective,
   feature branch, and absolute feature worktree. Repeating an identical
   initialization reopens it; conflicting metadata is rejected.
2. Team Gizmo runs `CreateTask` before launching each worker. Supply its
   objective, at least one acceptance criterion, dependencies, initial continuation
   notes, and either a Git workspace or `kind: read_only`. Dependencies must
   already exist; self-dependencies and duplicates are rejected.
3. The worker reads `GetTask` and runs `ClaimTask` with its catalog agent identity,
   expected revision, and TTL. A claim succeeds only for a queued task whose
   dependencies are integrated. The result contains its new attempt and revision.
4. While working, the worker runs `UpdateTask` at meaningful milestones and
   before a potentially long operation. Choose the action from the catalog:
   - `heartbeat` renews activity and expiration without claiming meaningful progress.
   - `progress` records findings, next steps, checks, and a working or blocked phase.
   - `checkpoint` records a real commit from the task branch with continuation notes.
   - `ready` records the final result before sending the completion notification.
5. Team Gizmo reads durable readiness and directs the integration agent. After
   merging and running the assigned combined checks, that agent records
   `CoordinateTask` with `action.kind: integrate` and the feature HEAD.

`agent` and `actor` use the fixed identities of the bundled agent catalog, such
as `gizmo`, `rust-dev`, and `integration-agent`. The CLI discovery schema lists
all supported identities. Use the role's directory name, not a host session ID,
`worker`, or an invented agent name. An unknown name is rejected, including in
stored records; do not silently relabel historical actors to another role.
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

Worker identity and attempt must still match. TTLs range from 1 to 86400 seconds;
choose enough time for the next operation and renew before expiry. Timestamps
are Unix milliseconds generated by the CLI. Keep checkpoints on the task branch.
A checkpoint may be unfinished code; state and continuation notes must say so.

A write task can become ready only when its worktree is clean and its checkpoint
matches HEAD. Integration requires a clean feature worktree, a matching feature
HEAD, and the recorded checkpoint in its ancestry. These Git checks do not run
or prove tests; record actual check evidence and follow the assigned validation.
The command does not support recording a squash/rebase that drops the checkpoint
from ancestry; retain the existing merge-based local integration workflow.

**Prohibited:** merge unfinished code into the feature merely to publish a
heartbeat, or treat a successful database write as proof of passing tests.

**Preferred:** commit a worker milestone, record its SHA and next steps, then
continue on the worker branch until ready for integration.

## Recovery and stale work

A lease expiring is an observation, not proof the worker has stopped. There is
no background TTL process. Status computes expiration when queried.

1. On startup, after interruption, and before assigning more work, Gizmo reads
   `GetFeatureStatus`. Use `ListFeatures` to rediscover feature IDs and paths
   when the coordinator context is lost. Inspect `last_update`, `last_progress`, the lease health,
   current checkpoint, and continuation notes. Read `GetTaskHistory` when needed.
   Recover session mode and delivery choices from the
   [assignment context](../../AGENTS.md#assignment-context). An integrated ledger
   task does not imply PR delivery is complete. Apply the
   [delivery policy](../../delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery)
   before the final handoff; collect any missing session choice through the entry
   point rather than inferring it from an existing branch or ledger.
2. For expired or stalled work, inspect the host execution and its worktree.
   Stop the previous execution or establish that it finished before reassignment.
   Long tests may still be running even when no heartbeat arrives.
3. Record `CoordinateTask` with `action.kind: requeue`, a reason, and
   `previous_execution: stopped_or_finished`. This is the coordinator's explicit
   acknowledgement, not an automatic host check. Preserve the branch, checkpoint,
   progress, and history.
4. Give the replacement worker the existing task and workspace. Its next claim
   increments the attempt. Updates from the older attempt are rejected, even if
   that worker rereads the current revision.
5. For integration failures, requeue the task after inspecting the previous
   execution and pass the repair context. After all integrated work and checks are
   complete, follow existing workspace cleanup rules. Keep the feature ledger.

Use cancellation only when the assignment is no longer wanted. Retain cancelled
records and history. Neither cancellation nor requeue stops an agent process.

Git commits and Turso transactions are separate operations. If a worker commits
and exits before recording its checkpoint, inspect the existing task branch and
worktree to recover that newer work. Never reset or remove an interrupted
worktree merely because its ledger checkpoint is older. Uncommitted edits still
need that worktree; the ledger is not a copy of their contents.

**Prohibited:** start a replacement solely because the TTL elapsed, or require
a lost final message before inspecting an existing branch.

**Preferred:** inspect the execution, preserve its workspace, then resume from
the recorded task plus any newer Git changes.

## Versions and durable contracts

Command protocol, persisted record, and physical database versions are distinct.
This release writes command/record version `1` and database version `2`.
Database migrations run transactionally: initial tables establish version `1`;
version `2` adds the unique task/revision event index. Existing version `1` data
is preserved. Unsupported versions are rejected; the CLI never resets a database
or guesses how to decode an unknown record.

There are no historical command/record formats before this feature's version
`1`. When evolving those formats, retain typed readers for the current version
and up to two previously released versions. Add explicit conversions into the
current domain model and fixture tests before advancing the writer. Do not
reinterpret older JSON through a generic map or silently add defaults that change
its meaning. Adding extension keys does not change a known schema version.

Migrations move forward; older executables reject newer storage versions.
Before a future upgrade that changes record shapes, preserve a consistent backup
with all writers stopped. Downgrade requires restoring that backup; it must not
rewrite newer records in place. The database stays local to the repository:
push, clone, and ordinary source commits do not copy it. Separate clones or
machines do not share this ledger.

**Prohibited:** accept version `99` using the version `1` decoder or discard
history to make an upgrade work.

**Preferred:** reject the unsupported version with an upgrade message, leaving
its committed data intact.
