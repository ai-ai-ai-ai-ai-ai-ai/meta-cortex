---
name: agent-ledger
description: Initialize a feature's embedded Turso ledger and record verified local integration through the typed meta-cortex YAML CLI.
---

# Feature Ledger Integration

Apply the shared [agent ledger protocol](../../../../../gizmo-team/docs/agent-ledger.md).
Team Gizmo owns assignment and recovery decisions. This skill owns the delivery
agent's use of the ledger alongside its existing Git workspace procedure.
Use the [coordination transitions](../../../../../gizmo-team/docs/coordination-state-machine.md)
to distinguish a setup milestone from task readiness and delivery.

## Required actions

1. Discover the installed executable with `meta-cortex list`. If unavailable or
   incompatible, report the actual failure to Gizmo before launching untracked work.
2. After preparing the feature workspace, initialize `Feature / Initialize` using Gizmo's
   stable feature ID, objective, branch, and absolute worktree path.
3. Return the ledger path and feature ID with the task branch/worktree mappings.
   Team Gizmo records and assigns every participating role's activity through the
   [entire feature workflow](../../../../../gizmo-team/docs/agent-ledger.md#record-the-entire-feature-workflow).
   Claim the integration activity once assigned. Record workspace preparation,
   merge results, combined checks, conflicts, and cleanup on that activity.
4. Before integration, read the task's durable readiness and recorded checkpoint.
   Follow the local-feature skill for merging and combined validation.
5. Read the task again and record `Task / Coordinate` with the latest revision,
   `action.kind: integrate`, and the verified feature HEAD. A failed ledger
   update leaves the Git work intact; inspect both before retrying.
6. Preserve the ledger when cleaning completed worker worktrees. Report failures
   to Team Gizmo; it decides whether to requeue work or assign a repair.
7. Record readiness on the integration activity before the completion
   notification. Team Gizmo records its acceptance with `action.kind: complete`.
   An integration event on a worker task remains separate code-integration evidence.

**Prohibited:** merge code on an expired heartbeat alone or delete a feature's
ledger with a finished worker worktree.

**Required:** verify readiness, merge the checkpoint, run the combined checks,
and record the integration before reporting completion.
