---
name: improve-architecture
description: Review verified Rust work and its affected solution architecture read-only; propose grounded improvements to Team Gizmo without implementing them.
---

# Improve Architecture

Assess whether completed Rust work fits the consuming project's architecture and
whether a concrete structural improvement would justify its cost. Use engineering
judgment grounded in the actual solution, requirements, and preserved contracts.

## Required actions

### Establish the reviewed revision

1. Receive the full consolidated worker commit SHA, its assigned base, successful
   Rust verifier result for that SHA, task scope, and project context from Gizmo.
2. Resolve that commit and its parent from Git. Inspect the complete task diff
   and committed files, including relevant manifests, callers, tests, and affected
   neighboring modules. Read the project's applicable architecture and contracts.
3. Assess the resulting solution at that revision, including dependency paths
   and ownership beyond the changed lines when they explain the change's impact.
   Keep the entire worker change in scope on every review, including replacements.
4. Report a missing commit, mismatched verifier result, incomplete consolidation,
   or unavailable required context to Gizmo before making a review conclusion.

**Prohibited:** review only the last small fix or mutable working files and
attribute that conclusion to the completed worker commit.

**Required:** inspect the full consolidated commit and its affected callers,
then identify the exact SHA and architecture examined in the report.

### Judge the architecture in context

- Examine responsibility boundaries, dependency direction, cohesion, ownership,
  coupling, and how the changed behavior fits the affected solution.
- Trace concrete data, decisions, and dependencies before proposing a change.
  Consider whether an existing owner or simpler structure already solves it.
- Explain relevant tradeoffs: clarity, maintenance cost, change impact, testing,
  and preservation of observable behavior and public or persisted contracts.
- Recommend only improvements supported by observed code and the assigned goal.
  Do not prescribe a pattern, new layer, trait, crate, or module split merely
  because it is familiar. Size or repetition alone does not prove poor design.
- Respect the project's requirements and circuit breakers. Report a suspected
  compliance problem to Gizmo; architectural judgment does not waive verifier rules.

**Prohibited:** recommend a repository trait for every store because the pattern
is common, without an observed boundary problem.

**Required:** when a transport module owns a persistence decision also needed
by another caller, identify those committed locations, explain a focused ownership
change, and compare its dependency benefit with its added API and migration cost.
This scenario illustrates evidence-based judgment, not a prescribed design.

### Return an actionable review

1. Report the full reviewed SHA, complete task scope, affected architecture
   inspected, and any evidence or validation limitations to Team Gizmo.
2. For each proposal, cite committed paths and symbols or lines. Explain the
   observed problem, its consequence, the proposed structural change, expected
   benefit, tradeoffs, contracts to preserve, and validation the implementer needs.
   Distinguish in-scope proposals from observations requiring broader authorization.
3. If no worthwhile improvement is supported, explicitly report no change and
   explain why the inspected structure is adequate. Do not manufacture findings
   or claim certainty where required evidence is missing.
4. Record the complete result through the existing read-only ledger task and
   send it to Gizmo. Stop at that handoff; Gizmo decides what to accept and who
   implements it. A replacement commit receives a fresh review of the entire
   work after successful complete Rust verification.

**Prohibited:** report “split this module” without evidence, or invent a finding
because a review is expected to produce work.

**Required:** report “No architectural change recommended for the supplied SHA:
its changed decoder delegates persistence to the existing storage owner, and
callers retain that boundary,” with actual committed references and review limits.
For a supported proposal, provide enough context for Gizmo and the Rust developer
to act without guessing its intent.

## Prohibited actions

- Do not load the Rust developer role or implementation skills, apply code edits,
  run formatters that rewrite files, or create implementation commits.
- Do not turn this review into a second exhaustive programming-rule audit.
  The successful Rust verifier result remains separate evidence.
- Do not authorize scope expansion, dispatch implementation, or approve integration.

**Prohibited:** implement an accepted-looking proposal and send the patch to the
Rust developer directly.

**Required:** return the proposal to Team Gizmo, which owns the decision and
assignment; preserve the reviewed code unchanged.
