---
name: tech-writer-verification
description: Verify one committed documentation change against every rule in the writing YAML catalogs using the shared index-only, exhaustive verifier protocol. Read-only; reports every issue and blocker to Team Gizmo.
---

# Tech Writer Verification

Review the supplied commit against every practice and rule in the
[writing review catalog](index.yaml). It composes the tech writer's canonical
writing catalogs and Git delivery catalog without copying their rules.
This is the review catalog for the shared
[verifier protocol](../../../../../gizmo-team/docs/verifier-protocol.md).
The protocol owns context loading, complete inventories, every rule/file
and cross-rule decision, validation evidence, reports, and replacement reviews.

## Required actions

### Review the complete writing catalog

1. Load the shared verifier protocol and
   [committed Git reads](../../../../../gizmo-team/docs/committed-review.md).
   Require the explicit SHA and use committed objects in the assigned repository.
2. Apply the protocol's
   [index-only context loading](../../../../../gizmo-team/docs/verifier-protocol.md#keep-practice-context-index-only).
   Traverse the entire review catalog, including Context Engineering, Code
   Practice Writing, Delivery Writing, Git delivery, and cross-rule checks.
   Do not load the tech writer's role, authoring skills, or practice Markdown.
   Retain the supplied operational context.
3. Apply its
   [exhaustive review](../../../../../gizmo-team/docs/verifier-protocol.md#evaluate-every-rule-against-every-changed-file).
   Include all changed files, catalogs, configuration, executable examples,
   supporting code, deletions, and renames. Record applicability for every rule;
   unrelated-looking branches remain part of the review.
4. Check document meaning, ownership, context flow, examples, affected callers,
   and validation claims against the loaded cues and committed evidence. A link
   audit does not prove semantic compliance. Request unavailable subject-owner
   decisions or exact-revision example evidence through Gizmo as blockers; do
   not load extra authoring context or invent technical policy.
5. Save and return the complete report under the protocol's
   [report and verdict rules](../../../../../gizmo-team/docs/verifier-protocol.md#save-one-complete-report).
   Cite cataloged IDs and sources for every issue. Repeat the complete review
   for every newly assigned replacement SHA and recheck every previous repair,
   including unchanged locations. Finish after the complete handoff.

**Prohibited:** skip Code Practice Writing for a prose change, load the writer's
full role to discover requirements, or approve after a successful link audit.

**Required:** traverse every writing and delivery rule, record each rule/file
and cross-rule decision, and report all violations and unresolved cues to Gizmo.

## Prohibited actions

- Do not author repairs, commit, change policy, launch agents, or bypass Gizmo.
- Do not sample rules, cap findings, or turn unexecuted examples into passes.
- Do not load canonical Markdown to resolve a catalog ambiguity. Source paths
  remain citations; the subject owner supplies unresolved decisions through Gizmo.

**Prohibited:** open the canonical example practice to guess an exception, or
stop after the first contradiction.

**Required:** keep the index-only context, continue every remaining decision,
and return all established issues with the precise blocker.
