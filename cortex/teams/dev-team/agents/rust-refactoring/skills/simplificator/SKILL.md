---
name: simplificator
description: Review the necessity and complexity of a verified Rust solution and related existing code; recommend grounded simplifications to Gizmo without implementing them.
---

# Simplificator

Determine whether the full proposed solution needs its added code and mechanisms,
and whether the combined old and new code can meet the requirements more simply.
Architectural fit and ownership remain the distinct concern of Improve Architecture.

## Required actions

### Examine the whole solution

1. Use the same full consolidated commit, successful Rust verifier result, scope,
   and project context supplied for the architecture review. Confirm that the
   committed solution and verifier evidence identify that exact revision.
2. Read the actual requirements and the complete proposed or completed solution.
   Inspect related existing code, callers, tests, and available tool capabilities
   at that revision, including unchanged code that explains the proposed mechanism.
3. Trace what requirement each candidate for simplification serves. Examine
   unnecessary new code, duplicated paths, and complexity in the combined old
   and new structure. Consider whether an existing operation already meets the need.
4. If required evidence or a requirement's meaning is missing, report the specific
   uncertainty to Gizmo. Do not convert an assumption into a removal recommendation.

**Prohibited:** call a new adapter redundant after reading only its diff, without
checking the existing path's contract or the requirement it serves.

**Required:** compare both committed paths with the actual contract, identify
whether the existing path already supplies the needed behavior, and report any
unresolved requirement before recommending removal.

### Judge necessity without losing required behavior

- Ask whether the proposed mechanism or feature is needed for the actual goal,
  including whether existing code or an established tool already supplies it.
- Compare concrete alternatives by maintenance burden, clarity, implementation
  and migration cost, and their ability to preserve required behavior.
- Recommend simplification of related existing code when it makes the combined
  solution clearer and remains within the authorized scope. Reading old code
  does not authorize its repair; report broader opportunities separately to Gizmo.
- Preserve requested capabilities, observable contracts, domain requirements,
  and real security protections. Do not remove a requirement merely because
  omitting it would be simpler, or replace meaningful distinctions with clever
  compressed code. Fewer lines or abstractions alone do not establish a benefit.
- Question an unnecessary feature only with evidence about the actual requirement.
  If necessity depends on an unresolved product decision, return that decision
  to Gizmo instead of treating the feature as optional.

**Prohibited:** remove requested durable saves because an in-memory implementation
is shorter, or recommend a new write-recovery service for an unrequested guarantee.

**Required:** preserve the stated save guarantee and assess whether the existing
file library already provides it. Propose removing redundant mechanics only with
contract evidence; ask Gizmo to resolve an unspecified durability requirement.
This comparison preserves the capability while questioning its implementation cost.

### Report a concrete simplification decision

1. Identify the reviewed SHA, requirements, full solution, and related existing
   code examined. State evidence gaps and validation limits.
2. For every proposal, cite committed paths and symbols or lines, the unnecessary
   complexity, and the requirement it serves. Name the simpler existing tool,
   path, or structure, expected benefit, tradeoffs, contracts to preserve, and
   validation needed to demonstrate equivalent required behavior.
3. Distinguish actionable in-scope proposals from requirement questions and
   broader observations needing authorization. If no worthwhile simplification
   is supported, say so with a concrete reason; never manufacture a finding.
4. Record this assessment alongside the architecture assessment in the existing
   read-only task and report to Gizmo. Gizmo decides accepted work and assigns
   RustDev; stop without implementing. Reassess the entire replacement solution
   and related existing code after its fresh complete Rust verifier pass.

**Prohibited:** report “delete the extra layer” without showing which required
behavior survives, or invent a reduction to avoid returning no findings.

**Required:** report “No worthwhile simplification for this SHA: the two paths
serve distinct required save guarantees,” citing their requirements and committed
locations. When redundancy is proven, identify the existing replacement path and
checks needed before Gizmo can assign the change.

## Prohibited actions

- Do not edit code, tests, configuration, or documentation, or create implementation
  commits. Only record the assigned review's ledger progress and result.
- Do not load the Rust developer role or implementation skill bundle.
- Do not dispatch workers, approve integration, or treat a proposal as permission
  to change scope. Simplification does not waive the successful verifier's rules.

**Prohibited:** delete the proposed redundant path during review and contact RustDev
with the patch.

**Required:** send the grounded proposal to Gizmo and leave the committed solution
unchanged for the coordinator's decision and implementation assignment.
