---
name: rust-verification
description: Verify one committed Rust change against every rule in the Rust YAML catalogs. Record exhaustive coverage and send Team Gizmo every issue with enough context to fix it. Read-only; does not implement repairs.
---

# Rust Verification

Given a commit SHA from Team Gizmo, review every changed file against every
cataloged Rust rule. Record all decisions and send every issue with its repair
context. Passing builds or finding one violation does not complete the review.
Apply the [task boundary](../../../../../../CIRCUIT-BREAKER.md#keep-the-users-task-boundary):
the verifier's outcome is a complete review, not a repaired implementation.

## Required actions

### Require the assigned commit

1. Load the [communication protocol](../../../../../gizmo-team/docs/verifier-protocol.md).
   It owns request fields, report sections, result payloads, and Gizmo's responses.
   Load [committed Git reads](../../../../../gizmo-team/docs/committed-review.md) for the exact SHA, parent,
   inventory, patch, and file-reading commands. Run them in the assigned project repository.
2. Require an explicit, resolvable commit SHA before starting review.
   - If it is missing, ambiguous, or unresolvable, send `need_commit` to Gizmo.
     Stop review work until Gizmo supplies a valid request.
3. Review only the supplied commit. Do not substitute `HEAD`, follow a branch
   tip, or construct a task-wide commit range.

**Prohibited:** start reading the checkout's diff because Gizmo supplied a branch
name without a SHA.

**Required:** request the SHA through `need_commit`, then review the commit
identified by Gizmo's corrected request.

### Keep Rust practice context index-only

1. Start at the [canonical Rust catalog](../../../rust-dev/skills/rust-dev-skill/index.yaml).
   Recursively visit every navigation entry in order, including all practice
   leaves and cross-rule checks. Do not select only apparently relevant branches.
2. Load only `index.yaml` files for Rust practice context. Do not load the Rust
   developer role, developer skill, linked Markdown practices, or shared
   programming Markdown. This replaces selective catalog loading and general
   programming prerequisites for this verifier.
3. Retain the supplied project instructions, verifier role and skill, team
   instructions, circuit breakers, and ledger protocol as operational context.
4. Resolve references relative to their containing YAML file. Record the loaded
   paths and cues as one fixed catalog snapshot. Report a catalog change instead
   of mixing versions during a review.
5. Keep `source` links as citations. If a cue cannot determine compliance,
   record the precise ambiguity as a blocker for Gizmo and the subject owner.
   Do not load its Markdown source or invent an exception to force a decision.

**Prohibited:** skip WASM indexes for a CLI change, or open practice Markdown
because a serialization cue leaves an exception unclear.

**Required:** include the WASM rules and justify their applicability decisions.
Record the unclear serialization exception as blocked and ask Gizmo to resolve it.

### Inventory and read every changed file

1. Obtain the complete changed-file list from the supplied Git commit.
   Include manifests, tests, build scripts, configuration, and other non-Rust files.
2. Read each changed file in full at that revision, together with its diff.
   Read deleted content from the commit's parent and both sides of a rename.
   - If content cannot be read, record an access blocker rather than skipping it.

**Prohibited:** review only `src/lib.rs` when the commit also changes `Cargo.toml`
and deletes a test file.

**Required:** inventory all three files, read the manifest and library at the
reviewed SHA, and inspect the deleted test from the parent revision.

### Inventory every practice, rule, and comparison

1. Create one record per practice leaf with its owner, catalog path, canonical
   source file, and ordered rules. Each rule retains its ID, source anchor, and
   loaded summary. The grouping is one practice, one source file, and all its rules.
2. Check practice ownership, rule uniqueness, and catalog references.
   - Record missing or unreadable indexes, invalid references, cycles, duplicate
     ownership or IDs, and inconsistent sources as blockers.
   - Preserve defective entries so the report exposes the problem. Do not silently
     deduplicate them or treat the resulting inventory as complete.
3. Inventory each cross-rule check with its compared rule IDs and source citations.
   Reference the existing practice rules; do not count them again as new rules.
4. Derive expected file, practice, rule, and cross-rule check counts from these
   inventories before making judgments. Do not hard-code catalog counts.

**Prohibited:** record a practice filename while omitting half its rules, then
count repeated comparison references as additional rules.

**Required:** retain every owned rule once in its practice inventory and record
cross-rule checks separately, with references to those same rule IDs.

### Evaluate every rule against every changed file

1. Visit practices in catalog order and rules in leaf order. For each rule,
   inspect every changed file and the surrounding code needed to decide compliance.
2. Record exactly one outcome per rule/file pair: `pass`, `violation`,
   `not_applicable`, or `blocked`. Give concrete evidence or a precise reason.
   A rule that applies to no changed files still needs those applicability decisions.
3. For repository-wide requirements, inspect the relevant workspace configuration
   and validation evidence. Attach that evidence to the affected decisions.
   A file-level pass does not satisfy a required workspace check.
4. Evaluate every cross-rule check against the whole change. Record its outcome,
   compared IDs, affected paths, and evidence or applicability reason.
5. At each practice boundary, save all accumulated decisions in the existing
   ledger. Record the next unchecked practice/rule/file or comparison in
   `next_steps`. Preserve earlier decisions when resuming.

**Prohibited:** mark a practice “OK,” skip remaining rules after finding a
violation, or mark unfinished work `not_applicable` before an interruption.

**Required:** finish every rule/file decision, save the completed work, and
resume from the exact next unchecked entry. Continue through the last catalog entry.

### Record every issue and blocker

1. Record each observed violation as a separate issue, including multiple
   violations of the same rule in one file. Use the protocol's
   [issue payload and examples](../../../../../gizmo-team/docs/verifier-protocol.md#complete-issues-example).
2. Include the rule/source, committed location, context, offending evidence,
   required correction, and validation needed to fix the issue. Use parent
   lines when the offending content was deleted.
3. Keep catalog ambiguities and unavailable evidence as separate blockers.
   State what Gizmo must obtain to resolve each one. Preserve all established
   violations even when a blocker prevents a final compliance decision.
4. Tie each correction to a catalog rule or assigned requirement. Do not invent
   unrelated requirements while describing a fix.

**Prohibited:** report only the first identity violation, or replace its repair
instructions with “type safety needs work.”

**Required:** report both the identity and export-mode violations from the
protocol's example, with each one's evidence, affected callers, correction,
and validation steps. Include any unresolved blockers alongside them.

### Verify required check evidence

1. Check that each required result identifies the reviewed SHA, exact command,
   workspace, target scope, execution outcome, and supporting evidence.
2. Record missing or failed checks using the protocol's
   [validation and verdict rules](../../../../../gizmo-team/docs/verifier-protocol.md#save-one-complete-report).
   A demonstrated code defect needs a repair; unavailable or ambiguous evidence
   remains a blocker. A passing command does not replace rule review.
3. Run available read-only analysis. Ask Gizmo to arrange checks that need
   unavailable tools or checkout changes; do not modify the worker workspace.

**Prohibited:** accept a test log from the previous SHA as evidence that the
reviewed commit passed its required checks.

**Required:** record the revision mismatch as a blocker, request evidence for
the reviewed SHA, and retain every code violation already established.

### Return the complete review

1. Build the protocol's [five report sections](../../../../../gizmo-team/docs/verifier-protocol.md#save-one-complete-report).
   Include the actual inventories and all decisions, not only counts.
2. Reconcile exact decision keys and expected counts under the protocol's
   [completion rules](../../../../../gizmo-team/docs/verifier-protocol.md#return-the-result-and-route-it).
   A present but blocked decision still prevents approval.
3. Persist the report, then send the complete `review_result` payload to Gizmo.
   The message must contain every issue and blocker with all required context.
   Follow the protocol's verdict and ledger-state rules.
4. Finish the review assignment after that handoff. Do not initiate repairs,
   build a new fixture, or add another review cycle. Gizmo decides follow-on work
   within the parent task's authorized scope; a new assigned SHA starts a new review.

**Prohibited:** send “two issues found; see the ledger,” or claim success because
all rows exist while one decision remains blocked.

**Required:** save the complete coverage report and send both fully explained
issues to Gizmo. Include the blocker and use `blocked` until it is resolved.
For a review-only task, return those findings without starting a repair exercise.

### Review repair commits completely

1. Require the new commit SHA and regenerate its changed-file inventory.
   Repeat the full catalog review, including newly introduced defects.
2. Recheck every previous repair item at the new SHA, even if its file was not
   changed by the repair. Record `fixed`, `still_violated`, or `blocked` with
   fresh evidence, as required by the protocol.
3. Return a new complete report and all remaining issues. An earlier pass does
   not approve a replacement commit; a developer's fix list does not limit review.

**Prohibited:** approve the new SHA after checking only the first issue that
the worker says it fixed.

**Required:** recheck all earlier issues, evaluate every cataloged rule against
the new change, and report any remaining or newly introduced violation.

## Prohibited actions

- Do not edit implementation or catalogs, create commits, or perform repairs.
- Do not waive rules, sample practices, limit the number of reported issues,
  or turn unchecked work into a pass.
- Do not claim compliance with Markdown requirements that were never loaded.
  The review covers catalog cues; insufficient cues remain blockers until Gizmo
  obtains the subject owner's decision.

**Prohibited:** guess a source practice's exception from memory and approve code
that the loaded cue cannot classify.

**Required:** cite the cue, explain the exact unresolved decision, and return it
to Gizmo while preserving every other finding.
