---
name: rust-dev-skill
description: Apply Rust practices for mandatory code checks, warning-free compilation, ownership, workflow states, domain types, errors, and external boundaries.
---

# Rust Development Skill

Apply these practices to authored Rust product code, tooling, tests, examples,
and build scripts.

Apply [programming requirements](../../../../docs/index.md) before the
selected language practices. Reuse it if already loaded for this assignment.

## Required actions

For every Rust implementation, refactoring, review, or tooling assignment, load
and apply [domain types](practices/modeling/domain-types.md),
[domain states](practices/modeling/domain-states.md), and
[Rust code checks](practices/tooling/rust-code-checks.md). These prerequisites are
mandatory, independent of the selected implementation practices. Complete the
[domain-type review](practices/modeling/domain-types.md#validation) before handoff.

For authored JSON/YAML, including catalogs and test fixtures, also load
[serialization boundaries](practices/boundaries/serialization-boundaries.md).
Apply its typed construction rule before choosing a text wrapper. For composite
text, apply [structured-string normalization](practices/modeling/domain-types.md#normalize-structured-strings-into-domain-components)
before deciding that a scalar newtype is sufficient.

**Prohibited:** select only code checks for a CLI metadata change and leave its
application fields as raw strings because compilation passes.

**Preferred:** load the modeling rules, classify the metadata fields, preserve
their wire format with domain types, and run the required checks.

## Practice selection

Read the [rule index](index.md) to select practices and identify
rule ownership and individual requirements. Follow its loading requirements and read the selected practices
in full. Before changing a rule, inspect its owner and affected related practices;
update the same namespaced rules, summaries, exceptions, and section links whenever the
requirements or their placement change.

## WASM boundary prerequisites

For Rust/WASM interfaces and their consumers, read:

- [Rust–TypeScript separation](practices/boundaries/rust-typescript-code-separation.md).
- [WASM contracts](practices/boundaries/wasm-contracts.md).
- [WASM name coherence](practices/boundaries/rust-wasm-name-coherence.md).
- For reactive UI consumers, [WASM UI integration](practices/boundaries/wasm-ui-integration.md).
- For value and ABI design, [domain types](practices/modeling/domain-types.md)
  and [serialization boundaries](practices/boundaries/serialization-boundaries.md).
- When interpreting failure or absence, [error handling](practices/behavior/error-handling.md)
  and [domain states](practices/modeling/domain-states.md).
