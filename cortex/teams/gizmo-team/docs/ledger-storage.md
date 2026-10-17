# Ledger Storage and Compatibility

Reference for repository identity, storage ownership, persisted formats, and
migrations. Start with the [operational overview](agent-ledger.md) for routine
work; read these contracts before changing storage or upgrading a ledger.

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

For development coordination commands, pass the consuming project path and a
stable feature ID. Do not use the library's repository as the project. The
feature ID stays fixed when a host session restarts. Reuse the ID and feature
branch on follow-ups. Task IDs are scoped to their feature, so different features
can reuse a task ID in their separate databases. Never create a database per task,
agent, or worktree. Preserve the database and its engine-managed sidecars together.

- Gizmo Prime owns the feature objective, branch decision, and acceptance.
- Prime records assignments before direct launches, reads progress, and decides
  dependencies, reassignment, cancellation, and integration order.
- Prime delegates workspace preparation and integration. The assigned integration
  owner prepares worktrees, initializes the feature ledger, verifies code integration,
  and records the integrated revision.
- Workers claim their assigned tasks and persist their own progress and results.

Every participating role needs its own activity record: one Prime coordination
activity, plus selected workspace preparation, integration, verifier, and PR delivery
activities.
An integration event on a developer's task does not replace the integration
agent's own activity. An integrated task does not mean the feature was accepted
or its PR delivered.

Everyone assigned to the feature may read its status and history. Reading does
not authorize claiming a peer's assignment, expanding scope, or bypassing Prime.
Actor names describe trusted workflow participants; they are not credentials.
The CLI does not launch, stop, or monitor host agents.

- **Prohibited:** create a database inside each worker checkout or wait until a
  worker's final message to record its assignment.

- **Required:** initialize one ledger for the feature and supply its ID to every
  worker before launch.

## Versions and durable contracts

Command protocol, persisted record, and physical database versions are distinct.
This release writes command and feature version `1`, event-envelope version `2`,
task record version `4`, and database version `7`. `Task / Claim` and `Task / Update`
require `worker_id`; discover their current request shapes with `meta-cortex list`.
Typed readers retain task versions `1`, `2`, and `3` and event versions `1` and `2`.
Task versions `1` and `2` have unrecorded worker identity; version `1` ownership
also remains unrecorded. Readers never invent historical workers or reporting
lines. Historical envelopes, actors, revisions, attempts, timestamps, sequence,
provenance, and evidence remain intact.

### Current roles and recorded identities

Current requests and role catalogs accept only `Gizmo/GizmoPrime` as coordinator.
Prime reports to the host; every specialist reports directly to Prime. Historical
records retain the retired `Gizmo/Gizmo` identity and reporting coordinator exactly
as recorded. Reading or upgrading a ledger does not relabel that activity as Prime
or make the retired role available for a new assignment, claim, or update.

Task version `4` records the direct reporting contract. Earlier writers reject
that reporting relationship even though the fields have the same shape. Database
version `7` gates the changed contract so an older writer cannot append to an
upgraded feature. The event envelope stays at version `2` because checkpoint
outcomes and envelope fields keep their existing meaning.

- **Prohibited:** rename historical Team Gizmo actors or reporting lines to Prime,
  or write new direct-reporting tasks as version `3` because their fields look unchanged.
- **Required:** preserve historical identities and JSON bytes, and write current
  direct-reporting tasks as version `4` only after the selected feature reaches database version `7`.

### Checkpoint event records

Event version `2` records the explicit checkpoint `outcomes` set. Typed readers
retain version `1` events with no recorded outcomes; they never infer outcomes
from historical progress, titles, or checks. Reading and migration preserve the
historical JSON bytes. Outcomes belong to event evidence and keep their existing
contract; the task and database version changes above concern reporting ownership.

**Prohibited:** backfill version `1` checkpoints from their progress summaries
or rewrite their JSON as version `2` merely to populate Feature log.

**Required:** retain their history and leave missing outcomes missing. Record
explicit outcomes on a new valid checkpoint when continuing an assigned task.

### Retained task records

Version `1` task records retain their released flat format. Version `2` encloses
stable fields in `common`: identity, objective, acceptance, dependencies, revision,
attempt, timestamps, checkpoint, and progress. Ownership, workspace, and state
remain version-specific fields. Later records can reuse `TaskCommon` while its
field types and meanings remain unchanged; changes need a new common type so
retained readers keep their released contracts. Serde decodes both versions into
the current task model alongside version `3`; writers emit only version `4`.

Version `3` added `worker` beside `common`, `ownership`, `workspace`, and `state`.
Version `4` retains those fields with the current direct reporting contract.
The `worker` field is either `{kind: Unrecorded}` or
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

1. Inspect the active task's recorded role, reporting line, attempt, and host
   execution. Preserve its history and Git work.
2. If its ownership or reporting line uses the retired coordinator, Prime follows
   [recovery](ledger-task-lifecycle.md#recovery-and-stale-work): establish that the
   earlier execution stopped or finished, requeue, and explicitly assign a current
   role with its current reporting line. A replacement then makes a new claim.
   Do not silently translate historical ownership or continue the retired role.
3. For an active claim already valid under the current role and reporting contract,
   its actual continuing instance sends its retained UUID with the next valid
   `Task / Update`. The update checks its role and attempt before binding an
   unrecorded worker identity.
4. Use that UUID on every later update. Once recorded, another UUID is rejected.
   Prior event snapshots remain unrecorded; the successful update records the
   binding only in the new revision.

**Prohibited:** assign the current worker's UUID to all earlier snapshots, or
let a replacement bind an old active claim without inspected requeue.

**Required:** the continuing instance records its own UUID on its next valid
update. A replacement follows recovery and makes a new claim with its own UUID.

### Database constraints

Database version `7` retains the event sequence introduced in version `5`
and the integrity constraints introduced in version `6`.
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
and evidence. [Event order](homeostat-dashboard.md#revision-log-and-event-order) records whether its
sequence came from a committed append or preserved legacy storage order.

- **Prohibited:** an already-open writer trusts its startup schema check and
  appends after another executable upgrades the database to a future version.
- **Required:** check the schema inside the acquired write transaction and reject
  the unsupported version before changing the task or appending its event.

### Invalid legacy data during migration

A storage migration must fail atomically when legacy rows violate its
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

A command selecting a feature migrates supported version `1`, `2`, `3`, `4`, `5`,
or `6` storage to version `7` transactionally. It leaves other feature databases alone.
A future schema version is rejected without mutation or downgrade.

**Prohibited:** selecting `alpha` upgrades `beta`, or accepting version `99`
rewrites its schema as version `7`.

**Required:** migrate only `alpha` when supported; reject its future version
with feature/version context and leave committed data unchanged.

### Supported storage location

Only `~/.meta-cortex/<repo-name>/<repo_id>/features/<feature>.db` is supported.
Development commands resolve the repository group through the project identity;
Homeostat discovers existing groups directly from application storage.
`META_CORTEX_HOME` still overrides the application home. Old shared
`workbench.db` files and unnamed historical home layouts are ignored. Workbench never imports, deletes, or automatically
converts those files. Their presence does not populate an empty feature catalog.

**Prohibited:** fall back to `workbench.db` when the repository’s `features/`
directory is absent, or delete old files while listing features.

**Required:** show an empty catalog, leave old files untouched, and use only the
resolved per-feature location for subsequent feature initialization and access.

### Released format support

There are no historical command/record formats before version
`1`. When evolving those formats, retain typed readers for every released format
needed by supported history and migrations. Current support includes task versions
`1` through `4` and event versions `1` and `2`. Add explicit conversions into the
current domain model and fixture tests before advancing the writer. Do not
reinterpret older JSON through a generic map or silently add defaults that change
its meaning. Adding extension keys does not change a known schema version.

- Rebuild or install the current executable before using the new schema and
  request contract. Before the first write of a newer record format, stop older
  writers and move every active participant to the current executable. This
  applies to role and reporting semantics as well as field shapes. Complete that
  cutover before the database `7` upgrade and first version `4` task write. Do not
  mix executable versions against upgraded storage.
- Validate migration using an isolated cloned ledger. Do not upgrade a
  live feature ledger merely to obtain test evidence while older writers still use it.
- Migrations move forward. Current writers reject unsupported newer schemas
  within every write transaction; released legacy writers still require shutdown.
- Before an upgrade that changes record shapes, preserve a consistent backup
  with all writers stopped.
- To downgrade, restore that backup; do not rewrite newer records in place.
- The database stays in the local application home, grouped by repository. Push,
  clone, and ordinary source commits do not copy it; separate clones or machines
  do not share this ledger.

**Prohibited:** accept version `99` using the version `1` decoder or discard
history to make an upgrade work.

**Required:** reject the unsupported version with an upgrade message, leaving
its committed data intact.

- **Prohibited:** leave an older executable writing because the event envelope
  remains version `2` or the task field names are unchanged.
- **Required:** stop older writers, preserve a consistent backup, and move active
  participants to the current executable before upgrading the selected feature to
  database version `7`. Old binaries must reject that version without mutation.
