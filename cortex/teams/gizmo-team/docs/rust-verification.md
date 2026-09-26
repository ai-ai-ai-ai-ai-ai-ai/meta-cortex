# Rust Verification Handoff

Rust developer readiness starts verification, not integration. Team Gizmo owns
the review and repair loop. The [Rust verifier](../../dev-team/agents/rust-verifier/AGENTS.md)
owns read-only assessment; rust-dev owns fixes. Use ordinary Git evidence and
the existing [agent ledger](agent-ledger.md), without another coordination service.

## Required actions

### Assign committed work for verification

1. Include the task's starting base in the Rust developer assignment. The developer
   follows [task completion](../../delivery-team/agents/integration-agent/skills/local-feature/practices/local-feature-integration.md#finish-task-work):
   run required checks, commit the changes, verify clean status, and record the
   final checkpoint and readiness before notifying Gizmo.
2. Receive the branch, workspace, base, final commit SHA, changed-file list,
   validation evidence, and unresolved issues. Inspect durable readiness even
   when the notification is missing. No-change work does not need an empty commit;
   report that fact and the unchanged SHA explicitly.
3. Before integrating rust-dev's branch, record and launch a read-only
   `Development/RustVerifier` task with those inputs, project/library roots,
   session choices, and normal [assignment context](../../AGENTS.md#assignment-context).
   Supply its own verification skill and canonical Rust YAML catalog root.
   Do not inherit the developer's full conversation or preload its skill and
   Markdown practices. Use a fresh review context when the host supports it;
   report a host limitation if that separation is unavailable.
4. Record the worker task ID, base, and SHA in the verifier's objective or
   continuation notes. Do not make the unintegrated developer task a ledger
   dependency: claims require dependencies to be integrated, which would
   deadlock this pre-integration review. Gizmo sequences the review after the
   developer is ready; use dependencies only for already integrated prerequisites.
5. Keep the worker branch stable during review. Ask the verifier for the full
   inventory, every rule/file outcome, cross-rule outcomes, all repair requirements,
   blockers, and reconciled counts under its skill. Do not narrow the assignment
   to rules selected by the developer or findings from a prior pass.

**Prohibited:** integrate the branch immediately on a “done” message or create
a verifier dependency that cannot become claimable until after integration.

**Preferred:** receive the ready SHA, record an independently claimable read-only
review, and require complete catalog coverage before considering integration.

### Route findings and require a complete new pass

1. Inspect the report against its original file and rule inventories. Reject
   missing outcomes, unexplained inapplicability, a mismatched SHA, or a pass with
   violations or blockers. The verifier skill owns the report and verdict rules.
2. Send all implementation repair requirements to rust-dev in one bounded
   assignment, with rule IDs, source links, committed paths/lines, evidence,
   required corrections, and expected validation. Require strict adherence to
   its practices. Route catalog ambiguity to the subject owner and any resulting
   instruction edits to the tech writer; do not ask rust-dev to guess policy.
3. Requeue the developer task through the existing stopped-or-finished recovery
   procedure before resuming it. Preserve its branch, worktree, and original
   review base. The developer commits validated fixes and supplies its new SHA.
4. Create a new read-only verifier task for a complete pass over that new SHA
   and the original base. Keep the previous report in its original task history;
   its ready state cannot approve the replacement commit.
   Refresh the catalog snapshot if an authorized clarification changed it.
   Recheck every rule and changed file, including unresolved previous findings
   and newly introduced defects. Do not accept a fixes-only review.
5. Repeat until the report passes. Keep integration blocked for violations,
   incomplete coverage, missing evidence, or unresolved policy. If a repair
   repeats without progress or requirements conflict, report the concrete blocker
   to Prime instead of accepting it or repeating an unchanged assignment.

**Prohibited:** forward only the most severe finding or approve a new SHA because
the developer says all findings are fixed.

**Preferred:** forward every requirement, preserve unresolved decisions, and
obtain complete coverage of the new committed result before integration.

### Integrate the reviewed revision

1. Supply the integration agent with the passing report, reviewed base, SHA, and
   task branch. Require its head and ready checkpoint to match that SHA. A later
   commit invalidates the report and returns to verification.
2. Integrate through the existing local-feature workflow and run combined checks.
   A verifier pass does not replace them. Conflict resolutions or later Rust
   repairs return through rust-dev and a new complete verifier pass.
3. Retain review results and repair history in the existing tasks. A read-only
   review's ready status means its report is complete, not that the code passed.
   After acceptance, record review completion using the ledger's existing
   read-only integration path; do not require a verifier code commit.

In `single_agent` mode, perform the developer, verification, repair, and
integration responsibilities locally without launching subagents. Keep the same
inventories and complete review; report that independent context isolation was
not exercised in this mode.

**Prohibited:** integrate a newer branch head using a passing report for its
predecessor, or claim single-agent self-review was an independent subagent review.

**Preferred:** integrate the reviewed SHA, run combined checks, and explicitly
return a conflict repair through verification before retrying integration.
