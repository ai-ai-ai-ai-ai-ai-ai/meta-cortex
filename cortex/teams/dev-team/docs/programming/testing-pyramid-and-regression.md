# Testing Pyramid and Regression Coverage

Unit and property tests own domain correctness. Boundary tests verify
contracts between components. End-to-end tests verify observable user flows.
Every executable bug fix requires reproducible regression coverage.

## Scope

Applies to:

- All domain logic, cryptographic operations, sync mechanisms, and state machines.
- All executable bug fixes, including domain code, adapters, interfaces, and tooling.
- Test authoring and authorized CI execution.

Does not apply to:

- Purely visual design tweaks with no behavioral defect.
- Instruction-only documentation edits without executable behavior changes.

These requirements apply across programming languages alongside the relevant
language skill.

**Prohibited:** apply the regression procedure only to Rust while changing the
same behavior in TypeScript without it.

**Preferred:** use these testing requirements for both implementations, then
apply each language’s skill to its implementation details.

## Required actions

### Testing pyramid

- Unit and property tests establish domain behavior and invariants.
- Boundary tests establish typed contracts and adapters without duplicating domain algorithms.
- End-to-end tests establish user-visible integration without replacing domain proof.

### Bidirectional specification and test review

Use product specifications and executable tests as two evidence sources that must remain
consistent.

1. Read the owning product or architecture specification.
2. Extract durable scenarios with security, authorization, persistence,
   recovery, data-loss, or user-observable consequences.
3. Assign each scenario to its authoritative test boundary.
   - Portable policy and invariants belong in domain tests.
   - Typed projections and storage adapters belong in boundary tests.
   - Complete user interactions belong in end-to-end tests.
   - Build, deployment, and repository wiring belong in preflight or artifact
     contracts.
4. Compare existing tests in the opposite direction.
   - Promote behavior into the owning specification when the scenario is
     durable, intentional, and useful for future product decisions.
   - Keep fixtures, selectors, timings, and implementation mechanics in tests.
5. Exclude draft or speculative behavior until the owning specification marks
   it as implemented.
6. Ensure every behavior specification belongs to an executable test gate.

Choose scenarios through architectural ownership and risk.

### Mandatory regression coverage for bug fixes

Every executable bug fix starts with a meaningful set of unit tests before
the implementation changes. Finding the root cause alone is not completion.

1. Understand the reported failure before changing implementation.
   - Identify the trigger, root cause, expected behavior, and owning boundary.
2. Author the unit regression set before implementing the fix.
   - Reproduce the original defect with an assertion on expected behavior.
   - Cover the relevant success, rejection, and edge cases around that defect.
   - Choose cases for distinct behavior and risk, not an arbitrary test count.
   - Exercise production contracts rather than copying implementation logic.
3. Keep coverage at the owning layer.
   - For domain bugs, write unit tests at the implementation owner.
   - Add property or integration tests when invariants or orchestration need
     further coverage.
   - For typed interface bugs, test the narrow owning boundary.
   - For browser-only bugs, cover the closest deterministic unit contract.
   - Retain an end-to-end regression for the actual user flow.
   - For cross-layer bugs, cover the affected contract and user flow.
4. Make the smallest correction in the implementation owner.
   - Retain the regression set in its existing automated test gate.
5. Hand off the regression cases and before/after verification requirements.
   - Identify the buggy revision, fixed revision, and focused test selection.
   - Review why the original-failure assertion detects the defect.
   - Record execution evidence as pending until authorized runs establish it.
6. Verify regression sensitivity with the project's test tooling.
   - Verify the original-failure test fails without the fix for the expected
     behavioral reason.
   - Verify the regression set and applicable suite pass with the fix.
   - Record the tested revisions, run references, and observed results.
   - Report unavailable before/after execution capability to the assigning Gizmo
     in multi-agent mode, or to the user in single-agent mode.
   - Keep missing evidence explicit rather than claiming verified protection.

## Prohibited actions

- Do not mechanically translate Markdown sentences into tests.
- Do not implement the fix first and add its unit tests afterward.
- Do not replace domain unit tests with integration or e2e coverage alone.
- Do not weaken assertions or accept unrelated failures as reproduction.
- Do not claim test authorship, semantic review, or compilation proves a pass.

## Validation

Use the project’s test, coverage, and browser validation tooling.

- Consult application logs when debugging test failures.
- Record test and coverage results.
- Confirm durable product scenarios have evidence at their authoritative boundary.
- Confirm specifications and tests agree on implemented behavior.

- Record failing-without-fix evidence for the original regression assertion.
- Record passing-with-fix evidence for the regression set and applicable suite.
- Record applicable browser regression results for changed user flows.
- Preserve pending or unavailable evidence explicitly in the handoff.
