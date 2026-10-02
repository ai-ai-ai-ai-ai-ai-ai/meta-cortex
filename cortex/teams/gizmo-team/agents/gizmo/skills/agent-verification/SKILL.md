---
name: agent-verification
description: Apply the shared review protocol using the assigned verifier's complete YAML catalogs. Keep subject practice context index-only.
---

# Agent Verification

Use this entry point for every cataloged verifier. Its own skill declares the
canonical subject catalog roots.

## Required actions

### Apply the existing review instructions

1. Load the [communication protocol](spec/communication-protocol.md) for request
   validation, exhaustive decisions, ledger progress, check evidence, complete
   findings, and repair rechecks.
2. Follow [committed Git reads](spec/git-review.md) to resolve the assigned SHA,
   inventory its change, and read every changed file without changing the checkout.
3. Load the catalog context below, then complete the protocol's review and result
   handoff. Use available read-only analysis; obtain missing validation evidence
   through Gizmo under the Git guide's validation procedure.

**Prohibited:** replace the protocol's complete review with a passing build log.

**Required:** use the committed evidence and complete catalog scope to produce
the protocol's report and send every finding to Gizmo.

### Keep subject practice context index-only

1. Start at every canonical catalog root declared by the assigned verifier's
   own skill. Require those roots before review; send `need_context` if they
   are missing. Recursively visit every navigation entry in order, including
   all practice leaves and cross-rule checks. Do not select only apparently
   relevant branches.
2. Load only `index.yaml` files for subject practice context. Do not load the
   worker role, worker skill, linked Markdown practices, or shared subject
   Markdown. This replaces selective catalog loading and general subject
   prerequisites for verifiers using this skill.
3. Retain the supplied project instructions, verifier role and skill, team
   instructions, circuit breakers, and ledger protocol as operational context.
4. Resolve references relative to their containing YAML file. Retain the loaded
   paths and cues as one fixed snapshot. Report a catalog change and follow the
   protocol's fresh-review requirement instead of mixing versions.
5. Check practice ownership, rule uniqueness, references, cycles, and source
   consistency. Preserve defective entries and report them as blockers; do not
   silently deduplicate them or claim the inventory is complete.
6. Keep `source` links as citations. If a cue cannot determine compliance,
   record the precise ambiguity as a blocker for Gizmo and the subject owner.
   Do not load its Markdown source or invent an exception to force a decision.
   Judge only the loaded cues; do not claim compliance with unloaded Markdown.

**Prohibited:** skip WASM indexes for a CLI change, or open practice Markdown
because a serialization cue leaves an exception unclear.

**Required:** include the WASM rules and justify their applicability decisions.
Record the unclear serialization exception as blocked and ask Gizmo to resolve it.
