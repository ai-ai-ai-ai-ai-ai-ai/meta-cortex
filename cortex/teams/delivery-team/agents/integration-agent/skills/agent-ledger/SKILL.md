---
name: agent-ledger
description: Initialize a feature's embedded Turso ledger and record verified local integration through the typed meta-cortex YAML CLI.
---

# Feature Ledger Integration

Apply the shared [agent ledger protocol](../../../../../gizmo-team/docs/agent-ledger.md).
Team Gizmo owns assignment and recovery decisions. This skill owns the delivery
agent's use of the ledger alongside its existing Git workspace procedure.

## Required actions

1. Discover the installed executable with `meta-cortex list`. If unavailable or
   incompatible, report the actual failure to Gizmo before launching untracked work.
2. After preparing the feature workspace, initialize `ledger.init` using Gizmo's
   stable feature ID, objective, branch, and absolute worktree path.
3. Return the ledger path and feature ID with the task branch/worktree mappings.
   Team Gizmo records each assignment before launching the worker.
4. Before integration, read the task's durable readiness and recorded checkpoint.
   Follow the local-feature skill for merging and combined validation.
5. Read the task again and record `task.coordinate` with the latest revision,
   `action.kind: integrate`, and the verified feature HEAD. A failed ledger
   update leaves the Git work intact; inspect both before retrying.
6. Preserve the ledger when cleaning completed worker worktrees. Report failures
   to Team Gizmo; it decides whether to requeue work or assign a repair.

**Prohibited:** merge code on an expired heartbeat alone or delete a feature's
ledger with a finished worker worktree.

**Preferred:** verify readiness, merge the checkpoint, run the combined checks,
and record the integration before reporting completion.
