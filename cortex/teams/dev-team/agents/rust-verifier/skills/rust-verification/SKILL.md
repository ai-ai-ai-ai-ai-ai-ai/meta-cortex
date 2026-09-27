---
name: rust-verification
description: Verify committed Rust work against every rule in the Rust YAML catalogs and return exhaustive coverage and repair requirements to Team Gizmo. Read-only; does not implement fixes.
---

# Rust Verification

Review a fixed Git revision using the existing Rust catalogs as the practice
context. A complete report accounts for every rule and changed file; passing
builds alone cannot establish compliance.

## Required actions

### Require the commit SHA

1. Load the [Gizmo/verifier communication protocol](spec/communication-protocol.md).
   It defines the exact request, report, notification, and repair-message formats.
   Require an explicit commit SHA from Team Gizmo before starting verification.
   If it is missing or cannot be resolved, follow the protocol's `need_commit`
   and `commit_reply` exchange; do no review work until it is resolved.
2. Review only that commit. Do not guess a revision, substitute `HEAD` or a
   branch tip, or construct a task-wide commit range.

**Prohibited:** start reviewing the current checkout when Gizmo supplies no SHA.

**Preferred:** stop and tell Gizmo, “Provide the commit SHA to verify.” Resume
only when Gizmo supplies a resolvable commit.

### Keep practice context index-only

1. Start at the canonical [Rust catalog](../../../rust-dev/skills/rust-dev-skill/index.yaml).
   Recursively read every navigation entry in order, including all practice
   leaves and cross-rule check leaves. Do not select only apparently relevant
   branches or stop after finding a violation.
2. Read only `index.yaml` files for Rust practice context. Do not preload the
   Rust developer role, `rust-dev-skill/SKILL.md`, linked Markdown practices,
   or shared programming Markdown. This specialized review replaces the
   general selective catalog-loading procedure and programming prerequisites.
   Keep the supplied project instructions, role, verification skill, team
   instructions, circuit breakers, and ledger protocol as operational context.
3. Resolve paths relative to each containing YAML file. Record the library
   revision when available and catalog paths used. Freeze that catalog snapshot
   for the review; report a catalog change instead of mixing rule versions.
4. Retain `source` links as citations for Gizmo and the repair owner. Do not
   infer exceptions or full policy from a short cue. If a summary cannot decide
   compliance, record `blocked` with the precise ambiguity for Gizmo to resolve
   with the subject owner. Never substitute a guessed pass or violation.

**Prohibited:** skip WASM catalogs for a CLI commit, or silently read all source
practices when a serialization cue lacks the needed exception.

**Preferred:** inventory WASM rules and give each an evidence-backed applicability
decision. Report an unclear serialization exception as blocked for Gizmo.

### Establish the committed file inventory

1. Use Git to list all files changed by the supplied commit, not only `.rs` files.
2. Read each changed file in full at that commit and inspect its diff. Read
   deleted content from the commit's parent and both sides of a rename.
   Report unreadable content as blocked instead of skipping it.

**Prohibited:** review only the files mentioned in the developer's summary.

**Preferred:** obtain the changed-file list from the supplied commit and read
every file before checking the practices.

### Build the practice and rule inventory

1. Create one record per practice leaf: `owner`, catalog path, canonical source
   file, and the ordered set of rule IDs, source anchors, and summaries. This is
   one practice, one source file, and its rules; it is not one record per code file.
2. Check unique practice ownership and rule IDs. Report missing or unreadable
   indexes, invalid references, cycles, or inconsistent sources as blockers.
   Preserve all encountered entries in the report; do not quietly deduplicate
   away a catalog defect.
3. Inventory every cross-rule check separately with its compared IDs and source
   references. Reuse practice records for those IDs rather than duplicating rules.
4. Record expected file, practice, rule, and cross-rule check counts from the
   inventories before beginning judgments. Do not hard-code today's counts.

**Prohibited:** list only practice filenames and claim that all their rules
were examined.

**Preferred:** retain each leaf's complete rule set and every comparison leaf,
so the final coverage record can be checked against the original inventory.

### Verify every rule against every changed file

1. Walk practices in catalog order and rules in leaf order. For each rule,
   examine every file in the committed inventory, including its changed code
   and the surrounding context required to assess it.
2. Record one outcome per rule/file pair: `pass`, `violation`, `not_applicable`,
   or `blocked`. Include the evidence or reason. A rule with no applicable file
   still needs explicit applicability decisions; never omit an entire practice.
3. For repository-wide requirements, inspect the relevant workspace configuration
   or validation evidence too. Attach that evidence to affected pairs. A passing
   file-level review cannot substitute for a required workspace check.
4. Evaluate every cross-rule check against the whole change. Record its outcome,
   compared IDs, affected paths, and evidence or applicability reason.
5. Collect every observed violation, including multiple violations of one rule
   in one file. Include severity, rule ID and source, committed path and lines
   (deleted lines for deletions), observed behavior, required correction, and the
   evidence needed to verify the fix. Distinguish code defects from catalog or
   evidence blockers. Do not invent unrelated requirements.
6. Verify supplied check evidence identifies the reviewed revision, commands,
   workspace, targets, and results. Report missing or failed required checks.
   Run read-only analysis where possible; route checks needing checkout changes
   or unavailable tools through Gizmo rather than modifying the worker workspace.
7. Save completed outcomes through the existing ledger at each practice boundary.
   Carry forward earlier outcomes when updating progress. Record the next
   unchecked rule/file so a resumed review cannot skip work after context loss.

**Prohibited:** mark an entire practice “OK,” treat unreviewed rules as inapplicable,
or stop after the first domain-type violation.

**Preferred:** record each rule/file judgment, cite the exact typed field for a
pass, explain the absent boundary for inapplicability, and list every violation
with its own repair requirement. Continue through the last catalog entry.

### Complete and return the report

1. Build the full report using the protocol's
   [durable report fields](spec/communication-protocol.md#durable-report-fields).
   Include the actual inventories and all outcomes, not only totals.
2. Apply its [outcome and completion rules](spec/communication-protocol.md#outcome-and-completion-rules)
   to reconcile coverage and derive the verdict. Having every row recorded
   does not mean every decision is resolved.
3. Persist the report and send its
   [result notification](spec/communication-protocol.md#result-notification-and-gizmo-response).
   Gizmo reads the saved report before routing repairs or integration.
4. On a repair assignment, require the new commit SHA, regenerate its file
   inventory, and repeat the entire review. Track previous requirements as fixed,
   still violated, or blocked using fresh evidence. Inspect new violations too.

**Prohibited:** return “all rules passed” with no coverage record, reuse approval
of an old SHA, or review only the developer's listed fixes.

**Preferred:** return the complete report with the new SHA and reconciled counts.
Gizmo can identify unfinished checks and route every repair to its owner.

## Prohibited actions

- Do not edit implementation or catalogs to make verification pass.
- Do not waive rules, sample practices, or collapse unchecked entries into a pass.
- Do not claim catalog completeness proves full Markdown-policy compliance.
  This report establishes review against the loaded catalog cues; insufficient
  cues remain blockers until the subject owner resolves them through Gizmo.

**Prohibited:** expand a cue's meaning from memory and report compliance with
source requirements that were never loaded.

**Preferred:** cite the loaded cue and report exactly what prevents a decision.
