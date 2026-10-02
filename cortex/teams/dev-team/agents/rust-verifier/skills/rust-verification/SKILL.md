---
name: rust-verification
description: Verify one committed Rust change against every rule in the Rust YAML catalogs using the shared index-only, exhaustive verifier protocol. Read-only; reports every issue and blocker to Team Gizmo.
---

# Rust Verification

Review the supplied commit against every practice and rule in the
[canonical Rust catalog](../../../rust-dev/skills/rust-dev-skill/index.yaml).
This is the review catalog for the shared
[verifier protocol](../../../../../gizmo-team/docs/verifier-protocol.md).
The protocol owns context loading, complete inventories, every rule/file
and cross-rule decision, validation evidence, reports, and replacement reviews.

## Required actions

### Review the complete Rust catalog

1. Load the shared verifier protocol and
   [committed Git reads](../../../../../gizmo-team/docs/committed-review.md).
   Require the explicit SHA and use committed objects in the assigned repository.
2. Apply the protocol's
   [index-only context loading](../../../../../gizmo-team/docs/verifier-protocol.md#keep-practice-context-index-only).
   Traverse the entire Rust catalog, including every practice and cross-rule
   check. Do not load the Rust developer role, skill, practice Markdown, or shared
   programming Markdown. Retain the supplied operational context.
3. Apply its
   [exhaustive review](../../../../../gizmo-team/docs/verifier-protocol.md#evaluate-every-rule-against-every-changed-file).
   Include non-Rust files, repository-wide requirements, and every applicability
   decision. Do not sample rules or stop after finding a violation.
4. Save and return the complete report under the protocol's
   [report and verdict rules](../../../../../gizmo-team/docs/verifier-protocol.md#save-one-complete-report).
   Cite cataloged IDs and sources for every issue. An ambiguous cue remains
   blocked; do not open Markdown to force a compliance decision.
5. For each newly assigned repair SHA, repeat the complete catalog review and
   recheck every prior repair with fresh evidence, including unchanged locations.
   Finish after the complete handoff; Gizmo owns subsequent work.

**Prohibited:** skip WASM rules for a CLI change, open the Rust developer skill,
or approve a repair after inspecting only the worker's fix list.

**Required:** record every Rust rule/file and cross-rule decision, preserve every
issue and blocker, and review the entire replacement change under the same protocol.

## Prohibited actions

- Do not edit code or catalogs, commit, launch agents, or perform repairs.
- Do not waive rules, cap findings, or turn unchecked work into a pass.
- Do not claim compliance with Markdown requirements that were never loaded.
  Verification covers catalog cues; unresolved requirements remain blockers.

**Prohibited:** guess a serialization exception from memory and approve the code.

**Required:** cite the unresolved cue, identify the missing decision, and report
it to Gizmo alongside every established violation.
