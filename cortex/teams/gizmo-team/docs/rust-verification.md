# Rust Verification Handoff

Team Gizmo starts verification when rust-dev reports committed work ready.
The [Rust verifier](../../dev-team/agents/rust-verifier/AGENTS.md) reviews it;
rust-dev performs repairs. Gizmo requires a complete passing review before
integration and preserves every issue's repair context throughout the handoff.
Use the existing host channel, Git evidence, and [agent ledger](agent-ledger.md).

## Required actions

### Apply the selected execution mode

- **`multi_agent`**
  - Gizmo assigns development, verification, repairs, and integration to their
    respective agents through the existing host and ledger workflow.
- **`single_agent`**
  - Perform those responsibilities locally without launching subagents.
  - Keep the same inventories, exhaustive review, and complete issue reporting.
  - State that independent verifier context isolation was not exercised.

**Prohibited:** select `single_agent`, launch a verifier anyway, or describe
self-review as an independent subagent review.

**Preferred:** perform the full review locally in `single_agent` mode and report
that limitation. Use the assignments below when running in `multi_agent` mode.

### Receive the developer's committed result

1. Give rust-dev ordinary implementation requirements and the existing
   [task-completion procedure](../../delivery-team/agents/integration-agent/skills/local-feature/practices/local-feature-integration.md#finish-task-work).
   It must run required checks, commit the work, confirm a clean checkout, and
   record its final checkpoint and readiness before notifying Gizmo.
2. Keep verifier context out of the developer assignment. Do not supply this
   handoff, the verifier role or skill, or review bookkeeping. Gizmo owns the
   decision to start verification after receiving the developer's result.
3. Receive the branch, workspace, final SHA, changed-file list, validation
   evidence, and unresolved issues. Check durable readiness even if the host
   notification is missing.
   - If no changes were needed, retain the unchanged SHA and report that fact.
     Do not require an empty commit just to produce a handoff.

**Prohibited:** give rust-dev the verifier skill and ask it to manage its own
verification handoff, then treat its “done” message as integration approval.

**Preferred:** receive rust-dev's ordinary committed result, confirm its recorded
readiness, and let Gizmo arrange the separate review.

### Assign the read-only verifier

1. Before integration, record a `Development/RustVerifier` task with a read-only
   assignment. Include the developer task ID and reviewed SHA in its objective
   or continuation notes.
2. Supply the result from rust-dev and the normal
   [assignment context](../../AGENTS.md#assignment-context): project and library
   roots, workspace, session choices, acceptance criteria, required checks, and
   available validation evidence.
3. Supply the verifier's own skill and canonical Rust YAML catalog root.
   Use a fresh review context when the host supports it. Do not inherit the
   developer's conversation, skill, or Markdown practices.
   - If the host cannot provide that separation, report the limitation.
4. Sequence the review after developer readiness. Do not make the unintegrated
   developer task a ledger dependency: claims require dependencies to be integrated,
   so that dependency would prevent this pre-integration review from starting.
   Use ledger dependencies only for already integrated prerequisites.
5. Launch the verifier and send the explicit SHA through the
   [review request protocol](../../dev-team/agents/rust-verifier/skills/rust-verification/spec/communication-protocol.md#request-a-review).
   The request identifies one commit. If the verifier sends `need_commit`, resend
   a complete request with a resolvable SHA.
6. Keep the developer branch stable during review. Require all changed files,
   every cataloged rule, and all cross-rule checks to be covered. Do not restrict
   review to rules selected by rust-dev or findings from an earlier pass.

**Prohibited:** inherit rust-dev's full context or make the review depend on
integrating the very developer task it must check first.

**Preferred:** create an independently claimable read-only task with its own
verifier context, the developer's ready SHA, and the complete catalog scope.

### Check the complete result

1. Apply the protocol's
   [result rules](../../dev-team/agents/rust-verifier/skills/rust-verification/spec/communication-protocol.md#return-the-result-and-route-it).
   Require every issue and blocker in the verifier's message, with the full
   context, evidence, correction, and validation needed for repair.
2. Reconcile that message with the report in
   `progress.extensions.rust_verification_report`. Check its SHA, inventories,
   every rule/file and cross-rule decision, supporting evidence, and counts.
   Reject missing findings, unsupported decisions, or a summary-only handoff.
3. Act on the verified verdict. A review task marked `ready` means its report
   is complete; it does not mean the code passed. Keep integration blocked for
   violations, incomplete coverage, missing evidence, or unresolved policy.

**Prohibited:** accept “two issues; see the ledger” or integrate because a review
with verdict `changes_required` reached `ready`.

**Preferred:** require both fully explained issues in the message, verify their
coverage record, and route both repairs before considering integration.

### Route every repair and blocker

1. Put all implementation repairs into one bounded rust-dev assignment.
   Preserve each issue's rule/source, committed location, context, evidence,
   required correction, and validation. Require strict adherence to the rules.
   Do not shorten issues to titles or forward only a selection.
2. Keep the assignment an ordinary coding task. Include all repair context,
   but do not forward verifier instructions, review inventories, or ledger
   bookkeeping. Rust-dev returns its committed result to Gizmo.
3. Route catalog ambiguity to the subject owner and resulting instruction edits
   to the tech writer. Do not ask rust-dev to guess policy. Resolving a coding
   issue does not clear an unrelated catalog or evidence blocker.
4. Before resuming the developer, follow the ledger's
   [stopped-or-finished recovery procedure](agent-ledger.md#recovery-and-stale-work).
   Requeue the task and preserve its branch and worktree. The developer validates
   its fixes, records readiness, and supplies the new commit SHA.

**Prohibited:** send only the identity issue when the verifier also found an
export-mode violation, or ask rust-dev to decide an unclear catalog exception.

**Preferred:** assign both complete coding repairs to rust-dev and send the
policy question to its owner. Preserve the unresolved blocker until it is answered.

### Require a complete review of each repair

1. Create a new read-only verifier task for the replacement commit. Retain the
   previous report in its original task history and supply it as verifier context.
   Refresh the catalog snapshot if an authorized clarification changed it.
2. Require all rules and changed files to be checked again, including previous
   repair items and newly introduced defects. Do not accept a fixes-only review
   or reuse the previous task's ready state as approval of the new SHA.
3. Continue until the new report passes. If a repair repeats without progress
   or requirements conflict, report the concrete blocker to Prime. In
   `single_agent` mode, report it to the user. Do not accept the defect or repeat
   an unchanged assignment indefinitely.

**Prohibited:** accept the developer's “all fixed” message as approval of its
replacement commit without another complete verifier pass.

**Preferred:** give the new verifier the new SHA and previous report, then require
fresh evidence for all earlier repairs and the entire new change.

### Integrate the reviewed revision

1. Supply the integration agent with the passing report, reviewed SHA, and task
   branch. Require both the branch head and developer ready checkpoint to match
   that SHA. A later commit requires a new review before integration.
2. Follow the existing
   [integration procedure](../../delivery-team/agents/integration-agent/skills/local-feature/practices/local-feature-integration.md#integrate-finished-branches)
   and run combined checks. A verifier pass does not replace those checks.
   - Route conflict resolutions or later Rust repairs through rust-dev and a
     complete verifier pass before retrying integration.
3. Retain review results and repair history in the existing tasks. After accepting
   a read-only review's result, record its completion through the ledger's
   existing read-only integration path. Do not require a verifier code commit.

**Prohibited:** integrate a newer branch head using its predecessor's passing
report, or treat successful Git integration as proof that combined checks passed.

**Preferred:** integrate the matching reviewed revision, run the combined checks,
and return any required Rust repair through development and verification.
