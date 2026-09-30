# Lace Receipts

Read the [core ownership rules](../../../../../lace/AGENTS.md),
[Lace model](../../../../../lace/src/ts/lace.ts), and
[core job](../../../../../lace/core.lace.ts) before authoring receipts.

Keep receipt changes in this directory or the assigned receipt scope. Use only
the core's existing job, instruction, and shell-command vocabulary. Receipt
authoring does not authorize changes to the core or validation configuration.

**Prohibited:** edit Lace or compiler settings because a receipt fails checks.

**Preferred:** correct the receipt, run the existing checks, and report a missing
capability when it cannot be expressed with the existing types.
