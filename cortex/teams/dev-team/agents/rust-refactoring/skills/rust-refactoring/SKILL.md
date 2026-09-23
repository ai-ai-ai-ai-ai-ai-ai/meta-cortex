---
name: rust-refactoring
description: Apply a behavior-preserving workflow for structural Rust refactors while reusing the canonical Rust development practices.
---

# Rust Refactoring

Use this workflow for structural Rust changes whose intended behavior and
contracts remain unchanged. Apply the canonical [Rust development skill](../../../rust-dev/skills/rust-dev-skill/SKILL.md)
for Rust practices, checks, and boundary requirements.

## Baseline

- Inspect focused tests and affected public, wire, and Rust-owned WASM boundaries.
- Apply the Rust skill's mandatory modeling prerequisites and
  [domain-type review](../../../rust-dev/skills/rust-dev-skill/practices/modeling/domain-types.md#validation)
  to moved code and touched aggregates; existing code is not automatically compliant.
- Record the behavior, domain decisions, and contracts the refactor must preserve.
- Route an intended behavior or contract change through Team Gizmo to rust-dev.

## Small structural steps

- Name one cohesive structural seam before moving code.
- Apply the [module-layout rule](../../../rust-dev/skills/rust-dev-skill/practices/tooling/module-layout.md)
  when moving module files, including its include-path and reference checks.
- Keep ownership, dependency direction, and tests aligned with that seam.
- Make the smallest structural edit and keep unrelated behavior changes out.

## Preserve observable contracts

- Preserve public names, wire shapes, domain decisions, and boundary behavior.
- Keep tests with the implementation owner and do not relocate them to conceal
  an oversized production abstraction.
- Stop and report when the requested structure cannot preserve an existing
  contract; do not decide the change through a refactor.

## Validation

- Run the consuming project's required Rust checks and focused tests.
- Review the final diff for unintended behavior or contract changes.
- Report the structural seam, preserved contracts, test and check results, and
  unresolved dependencies to Team Gizmo.
