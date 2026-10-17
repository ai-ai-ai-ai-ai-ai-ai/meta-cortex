# Homeostat Dashboard

Reference for dashboard behavior and the meaning of recorded observations.
The [operational overview](agent-ledger.md) covers coordination; the dashboard
observes that work and does not execute agents.

## Homeostat dashboard

`meta-cortex dashboard` and typed `Workbench / Dashboard` requests observe
recorded Turso ledger content without automatic claims, heartbeats, requeues,
migrations or other updates. Desktop provides an explicit
[Upgrade and open action](#upgrade-and-open-one-feature) for a selected supported
feature; opening the dashboard and refreshing its catalog remain observational.
It does not collect host agent state, runtime metadata, chat content, or Git
work and authorship data.
Desktop does not discover a project, consult Git, or require an available checkout.
Snapshot resolves the existing repository identity and storage path from its
request project. Development coordination retains its project and Git requirements.
For example, a recorded integration SHA is ledger evidence; its event actor
identifies who recorded it, not who actually authored that Git commit.

### Open the dashboard

1. Run the installed command from any directory, including the user's home,
   without a request file or required arguments:

   ```sh
   meta-cortex dashboard
   ```

   It opens the native Tauri Homeostat window and reads the application home.
2. Select a stored repository group from the landing list. Each group shows its
   stored name, repository UUID, and feature count. The UUID distinguishes
   same-name clones; a retained group remains browsable after its
   checkout is deleted.
3. Browse that group's existing split feature preview, newest activity first.
   Brief cards show the title, precise first-task date, expandable objective,
   compact progress, recorded roles, and PR links. The selected briefing adds the
   task inventory, latest update, start/finish times, elapsed duration, and branch.
   Select **Open workflow** for the first/default tab, the compact
   [Feature log](#feature-log). A task block opens that task's **Log** chapter
   directly. A shared task index navigates **Log** and **Time windows**. The
   [Revision log](#revision-log-and-event-order) shows feature-local event order,
   task revisions, recording actors, time, and expandable evidence. Time windows
   show task creation through last update, including concurrent task lifetimes.
   PR links open in the system browser.
4. Use breadcrumbs or Back to return from a journal to its group's feature list,
   then to the repository list. A feature ID is always selected within its group;
   identical feature IDs in different groups do not share journals.
5. Close the window to exit.

The shipped executable embeds its Svelte/TypeScript frontend assets. Native IPC
reads bounded Workbench observations; no HTTP server or browser tab is required.
Loading, empty results, and observation errors are shown in the window.

### Feature log

Within the selected repository group and feature, **Open workflow** opens on
**Feature log**, a concise journal of explicit
[implementation outcomes](ledger-task-lifecycle.md#record-implementation-outcomes) whose owning Git
tasks have integrated. Each compact row shows the outcome summary, latest
checkpoint recorder, and labeled task integration time. Expand a row for its
detail, task, checkpoint and integration SHAs, and recorded evidence. Its task
link opens that task's **Log** chapter in the same selected journal.

- Outcomes come from the owning task's latest checkpoint complete set. The
  checkpoint event's SHA must match the integrated task's recorded checkpoint.
  Integration without recorded checkpoint inclusion supplies no outcome rows.
  Missing checkpoint or integration history supplies no row; current task state
  alone cannot reconstruct that evidence.
- Ready, requeued, or cancelled tasks, reviews, coordination, heartbeats, and
  ordinary progress do not become implementation outcomes. Historical checkpoints
  without explicit outcomes remain missing; summaries, task titles, and Git data
  are not substitutes.
- Rows show the newest feature-local integration sequence first, with first
  declaration sequence order within one integration. Recorded timestamps label
  their own events; clock values do not override that sequence order.
- A stable outcome ID identifies one milestone within its task. Reaffirmations
  update that milestone's checkpoint evidence. Different IDs remain separate
  even when their summaries or consolidated commit SHA are identical.

#### Outcome evidence

`FeatureWorkflow.feature_log` supplies each row's `id`, `task`, `summary`, and
`detail`, with three evidence references:

- **`first_recorded`**
  - Earliest declaration of this task-local ID.
  - Includes `at`, `actor`, `revision`, `sequence`, and `provenance`.
- **`checkpoint`**
  - Latest reaffirming checkpoint's `commit` and `recorded` reference.
  - Its reference has the same fields as `first_recorded`.
  - `checkpoint.recorded.actor` is the responsible recorder shown compactly.
- **`integration`**
  - Owning task's integration `commit` and `recorded` reference.
  - Its reference has the same fields as `first_recorded`.
  - `integration.recorded.at` is the task integration completion time.

These actors identify who recorded evidence. They do not establish Git
authorship. Task integration has the limits in
[recorded state meanings](#recorded-state-meanings); it does not establish CI
success, PR merge, deployment, or feature acceptance.

#### Selected journal evidence

Outcome rows, expanded checkpoint evidence, and task **Log** links belong to
the current repository group and feature selection. Changing that selection
removes the prior journal's results. A delayed observation reply for the prior
selection cannot restore its rows or open its task evidence in the new journal.

### Browse agent roles

The always-visible **Agent guide** button in the top bar opens the roles graph
inside the native Tauri window. The guide remains usable when the ledger
catalog is empty. It describes framework roles independently of recorded
feature activity.

1. Select **Agent guide** to open the graph.
2. Select any catalog agent to read its canonical role documentation beside
   the graph.
3. After following a bundled document link, select **Back to agent document**
   to return to the selected role document.
4. Select **Homeostat** to return to the prior browsing context.

The guide is embedded at build time from the current shipped framework's
canonical `cortex/teams/*/agents/*/AGENTS.md` files. Its content reflects the
framework bundled with that executable build. Browsing roles uses the embedded
assets without a runtime localhost server or retained preview JSON.

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

4. To open global Homeostat instead, replace the arguments with only
   `mode: Desktop`; Desktop accepts no `view` or `page`. Keep the required
   `project` envelope field, but Desktop ignores it for discovery and does not
   require that path to exist or belong to Git.

Both modes accept file or stdin requests. Snapshot reads once and returns the
normal versioned YAML response with `data.kind: dashboard` and
`data.value.content` containing the selected view’s text.

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
other recorded task depends on, excluding Prime coordination tasks; its latest
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
  as its task change. Database schema version `7` assigns its sequence through
  `AUTOINCREMENT`; no separate counter service or read-side increment exists.
- New entries have `CommittedAppend` provenance. Their sequence orders committed
  appends in this feature database, independently of worker clocks and task revisions.
- Retained historical entries keep their original sequence and provenance,
  including gaps. Migration and display never renumber them or claim a new
  global order.
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

For example, retain historical `R41` and `R44` with their provenance. If the
selected task is at revision `7`, use `expected_revision: 7`, not `44`.
Another feature's `R45` establishes no relative order.

### Historical ownership

Version `1` tasks did not record intended ownership or reporting lines.
Their views label that information `unrecorded`. A retained active or ready
claim can identify the claimed role, but it cannot establish a reporting line.
Current views and historical event snapshots use only their recorded information.

### Refresh and pages

Within a selected repository group, the native feature list reads up to 100
features, most recently active first; features without tasks follow in ID order.
It notes when more exist and refreshes every five seconds; Pause stops automatic
reads, Refresh reads at once, and Retry follows an observation failure. Selected workflow detail
consumes all task/history pages and refreshes when recorded activity changes.
Evidence repeated across revisions appears only when changed.

Feature, task, and history queries return at most 100 records per page. Snapshot
request page indexes and text remain zero-based. Snapshot retains
`Page end: More` or `Complete` to indicate whether another page exists, not
feature or task completion.
Each query releases its connection after reading. Pages use live offsets, so
concurrent writes can shift records between pages. For example, a new history
event can push an older event onto the next page.

### Storage requirements and errors

Homeostat discovers only existing repository groups at
`~/.meta-cortex/<repo-name>/<repository-UUID>/features/<feature>.db`.
`META_CORTEX_HOME` overrides the application home. Directory identity and the
existing feature databases are sufficient; no checkout, repository identity file,
or Git discovery is required for Desktop observation.

- Startup and refresh do not initialize anything, write records, create databases
  or directories, or automatically migrate storage.
- An absent application home or absent feature storage produces a useful empty
  view and remains absent. The empty view explains that no stored ledgers exist.
- Groups are identified by stored name and UUID. Feature IDs are scoped to the
  selected group, even when another group uses the same ID.
- Desktop lists and reads each existing feature independently. One unavailable
  file does not hide other readable features or repository groups.
- Old storage layouts are ignored and left untouched; there is no fallback search
  or import from shared `workbench.db` files.

Feature availability determines access:

- **Current schema:** the feature is available for detail observation.
- **Supported older schema:** read-only metadata keeps the feature visible with
  its stored schema version and an upgrade state. Detail remains gated until
  the selected upgrade succeeds.
- **Future per-feature schema:** identify the unavailable feature from its file
  name and schema header only. Do not decode future feature or task records.
- **Feature file read failure:** show the affected feature and concrete failure
  while retaining other readable feature cards.

Detail observation requires the current schema. The observer uses a short
250 ms database busy timeout. Desktop failures appear in the window; refresh to
retry or close the window to exit. Snapshot remains repository scoped: missing
Git context or repository identity returns a structured error with exit status `2`
without creating identity. Other Snapshot failures also return structured errors
with exit status `2`. A schema error identifies the affected feature and version.
Snapshot never upgrades storage. `Feature / List` and Snapshot feature listings
also expose metadata availability without forcing detail reads.

### Upgrade and open one feature

1. Select a feature whose catalog state reports a supported upgrade. Stop older
   writers before upgrading that feature under the
   [released format requirements](ledger-storage.md#released-format-support).
2. Choose **Upgrade and open**. This explicit action opens and migrates the
   existing feature database in the selected storage group without resolving Git
   or a checkout, under the
   [migration contract](ledger-storage.md#versions-and-durable-contracts).
3. Open the selected feature's detail after the operation succeeds. If it fails,
   show the concrete failure and retain the other catalog entries. Do not retry by
   downgrading storage or rewriting history.

The action preserves historical JSON, ordering, and provenance under the existing
migration contract. It does not migrate other features or read old storage layouts.
Future schemas have no supported upgrade action.
