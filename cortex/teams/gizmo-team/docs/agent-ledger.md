# Agent Work Ledger

The ledger preserves the feature's assignments, decisions, progress, and results
so another coordinator or worker can continue without a final chat message.
Use one stable feature ID and ledger across its linked worktrees and follow-ups.
The [coordination architecture](coordination-state-machine.md) owns responsibilities;
the ledger records their actual work. It does not launch agents or perform Git operations.

## Use the ledger during work

1. Read `Feature / Status` before scheduling existing work. For a new feature,
   prepare its workspace and use `Feature / Initialize` with the consuming
   project path, not the library's repository.
2. Follow the [task lifecycle](ledger-task-lifecycle.md) to record, assign, and
   claim activities before execution. Use returned revisions and attempts;
   record meaningful progress and renew activity before its lease expires.
3. Record results before notifying Prime. Prime evaluates them and records the
   selected delivery outcome and final acceptance. Ready means a result is
   available, not that its assessment passed or the feature is complete.

## Choose the relevant reference

- **First claim or assignment:** [task lifecycle](ledger-task-lifecycle.md#assignment-and-worker-lifecycle)
  and [worker identity](ledger-task-lifecycle.md#worker-instance-identity).
  Read these before making the corresponding calls; reuse them once loaded.
- **Activity coverage:** [participating roles](ledger-task-lifecycle.md#record-the-entire-feature-workflow)
  explains coordinator, worker, integration, and delivery records.
- **Git checkpoint or final readiness:** [implementation outcomes](ledger-task-lifecycle.md#record-implementation-outcomes)
  explains complete outcome sets and revision evidence.
- **Interruption, expired lease, conflict, or replacement:** [recovery](ledger-task-lifecycle.md#recovery-and-stale-work).
  Expiration does not prove execution stopped. Preserve newer Git work even when
  the recorded checkpoint is older; inspect the previous execution before requeueing.
- **Inspecting recorded results:** [Homeostat](homeostat-dashboard.md) explains
  browsing and [state meanings](homeostat-dashboard.md#recorded-state-meanings).
  Ledger completion does not prove tests, PR merge, or deployment.
- **Storage or upgrade work:** [storage and compatibility](ledger-storage.md).
  Opening or refreshing Homeostat must not migrate a feature; only the explicit
  selected **Upgrade and open** action does so.

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
request execution; `dashboard` opens Homeostat for global storage observation.

Commands use `operation.group` and a group-specific `operation.command` with
`name` and `arguments`. References such as `Task / Claim` below name that pair;
they are not literal wire aliases. A group accepts only its own operations.

YAML/JSON are wire formats; the application operates on concrete Rust types.

- Requests reject unknown groups, commands, fields, enum values, duplicate fields,
  unsupported versions, malformed IDs, and out-of-range TTLs.
- Put arbitrary task-specific content only in `progress.extensions`. Known fields
  remain strictly typed.
