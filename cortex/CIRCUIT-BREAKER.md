# Project-Wide Circuit Breaker

Use existing tools to solve the assigned problem. Do not invent security or
infrastructure for failures the task does not require handling.

## Required actions

### Apply before roles and skills

Every agent receives this policy before its role and skills. It overrides
conflicting Meta-Cortex implementation, review, and testing advice. The user's
request and the host's instruction hierarchy still govern the task.

**Prohibited:** “A review suggestion authorizes infrastructure that the task
does not require.”

**Preferred:** check the suggestion against this policy and the applicable team
rules before implementing it.

### Apply the rules for the subject

The global policy applies to the entire consuming project. Team documents own
the subject-specific rules:

- [Gizmo team](teams/gizmo-team/CIRCUIT-BREAKER.md): reviews, trusted handoffs, and evidence.
- [Development team](teams/dev-team/CIRCUIT-BREAKER.md): filesystem operations and persistence.
- [SRE team](teams/sre-team/CIRCUIT-BREAKER.md): remote runners, build caches, and deployment ordering.

Load the relevant team rules when the assignment reaches their subject,
regardless of the agent’s home team. Team rules supplement this policy; they
cannot weaken it or change the stop-and-recover procedure.

**Prohibited:** skip the SRE cache rules because the build change is assigned to
a development agent.

**Preferred:** apply the SRE cache rules to that build change while preserving
the development agent’s implementation responsibility.

### Check before adding a mechanism

Name the requirement or observed failure and the existing tool that owns the
operation. Check this policy before implementation and when reviews expand the
design. Coordinators check assignments and results at the same boundary.

**Prohibited:** “Saving might fail in unusual ways. I'll build a recovery service.”

**Preferred:** “The requirement is atomic replacement. The file library already
provides it; I'll use that operation and test replacement failure.”

### Keep the user's task boundary

- Record the requested outcome, target scope, permitted changes, acceptance
  evidence, and stopping condition in the existing assignment. Distinguish
  review or verification from implementation. Carry that boundary through delegation.
- Assistant plans, task lists, reviewer findings, and coordinator decisions do
  not authorize a broader user goal. A new goal needs user authorization through
  the existing communication hierarchy.
- For review-only work, return the complete findings, evidence, and limitations.
  Do not start repairs, refactor unrelated code, or turn a diagnostic fixture
  into an implementation project.
- For authorized implementation, continue necessary repairs, required checks,
  and configured delivery without requesting routine approval. Explain how each
  repair supports the requested behavior or a required check. Reading a changed
  file does not authorize refactoring unrelated pre-existing code within it.
  Report unrelated findings without adding them to the repair assignment.

**Prohibited:** “Review this PR and check the verifier” becomes an assignment to
repair synthetic Rust violations and rehearse the entire repair workflow.

**Preferred:** review the PR and use a bounded missing-SHA or seeded-violation
check when needed to establish verifier behavior. Report all findings and the
tested limits, then stop. An explicit request to exercise the complete repair
workflow includes that exercise; an implementation request includes the repairs
needed to deliver its requested behavior.

### Stop when the requested evidence is complete

1. Before adding an agent, fixture, environment, check, or repair cycle, identify
   the still-unmet acceptance criterion it will resolve. Use the smallest
   sufficient existing workflow. Do not add work merely because another role or
   capability is available.
2. Reassess when setup or repeated attempts grow beyond their purpose. Remove
   optional work that no longer helps answer the request. If a required check
   cannot finish, report the concrete blocker and remaining uncertainty.
3. Once the requested outcome has its required evidence and authorized delivery
   is complete, report and stop. Do not invent another acceptance criterion.
   Preserve mandatory exhaustive coverage within the assigned review; stopping
   rules never authorize sampling, skipped rules, or an unsupported pass.

**Prohibited:** after a complete verifier report detects every seeded violation,
start fixing the fixture merely to demonstrate that another review can pass.

**Preferred:** return the complete detection report when detection was the
requested check. If required coverage is incomplete, finish it or report that
blocker explicitly; do not call the partial review successful.

### Stop and recover

1. Stop the prohibited implementation and its tests. Report the violation as P1.
2. Say “Circuit breaker tripped,” name the mechanism, and identify the rule.
3. Replace it with the smallest existing workflow that meets the requirement.
4. Remove violating changes within the assigned write scope. Report violations
   outside that scope to the assigning Gizmo for a decision in multi-agent mode; preserve unrelated work.
5. Continue the task. Existing code and passing tests do not exempt a violation.

**Prohibited:** finish an unnecessary mechanism because its tests pass, or
delete another agent’s work to remove it.

**Preferred:** name the violated rule, remove the mechanism within the assigned
write scope, use the existing supported operation, and report out-of-scope
corrections to the assigning Gizmo in multi-agent mode.

## Prohibited actions

### Testing invented requirements

Coverage targets, acceptance criteria, and “defense in depth” cannot authorize
a prohibited mechanism or a replica of another tool's internals.

**Prohibited:** invent an unsupported mechanism, then use tests written for it
as proof that the mechanism was required.

**Preferred:** test whether the assigned workflow produces the required result
and reports actual failures through its existing interfaces.

## Preserve product security

Keep real authentication, authorization, encryption, secret storage, and
external-input protections. Name the actual asset and trust boundary when adding
security. Product security does not justify securing routine agent coordination.

**Prohibited:** remove customer authentication or store secrets in plaintext
because “the circuit breaker says security is overengineering.”

**Preferred:** protect customer accounts with the required authentication and
secret-handling controls. Internal agents use the host and follow the
[communication hierarchy](teams/AGENTS.md#communication-and-decisions).
