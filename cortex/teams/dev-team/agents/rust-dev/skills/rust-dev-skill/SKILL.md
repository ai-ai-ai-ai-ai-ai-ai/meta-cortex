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
[domain states](practices/modeling/domain-states.md),
[owned updates](practices/behavior/owned-updates.md),
[module layout](practices/tooling/module-layout.md),
[test placement](practices/tooling/rust-testing.md#test-placement), and
[Rust code checks](practices/tooling/rust-code-checks.md). These prerequisites are
mandatory, independent of the selected implementation practices. Complete the
[domain-type review](practices/modeling/domain-types.md#validation) before handoff.

Prohibit authored `&mut self` value-update methods, including private collection
helpers. Consume `mut self`, return the updated owner, and use the returned value
at each caller. Local mutation inside that owned method is permitted. Retain a
borrowed receiver only where the exact external trait or resource contract
requires it, as defined by [owned updates](practices/behavior/owned-updates.md).

For SQL schemas, queries, migrations, and database fixtures, load
[typed SQL construction](practices/boundaries/typed-sql.md). Use an established
builder/ORM and bind runtime values; do not author SQL strings.

For authored JSON/YAML, including catalogs and test fixtures, also load
[serialization boundaries](practices/boundaries/serialization-boundaries.md).
For command protocols and discovery catalogs, also load
[command name coherence](practices/boundaries/rust-wasm-name-coherence.md#preserve-command-identities),
even when the task has no WASM or TypeScript boundary. Use descriptive variants
directly; do not invent a second wire-name vocabulary.
[Group related operations](practices/boundaries/rust-wasm-name-coherence.md#group-operations-by-their-owning-domain)
in domain-specific enums carried by their enclosing group variants; a flat
list with repeated prefixes or suffixes is insufficient.
Apply its prohibition on building YAML from strings, including literals and
static examples, before choosing a text wrapper. For composite
text, apply [structured-string normalization](practices/modeling/domain-types.md#normalize-structured-strings-into-domain-components)
before deciding that a scalar newtype is sufficient.

**Prohibited:** select only code checks for a CLI metadata change and leave its
application fields as raw strings because compilation passes.

**Preferred:** load the modeling rules, classify the metadata fields, preserve
their wire format with domain types, and run the required checks.

Before adding primitive conversions, inspect the [owning vocabulary](practices/modeling/domain-types.md#model-a-known-vocabulary-as-a-closed-enum).
Known identities must be complete enums; preserve
[ownership hierarchies](practices/modeling/domain-types.md#preserve-ownership-hierarchies-in-enum-payloads)
with team-specific enums inside their enclosing variants. A flat role list is
insufficient. Use variants and named typed constants for authored known values. Do not replace a closed catalog with string validation.

Before wrapping strings or classifying constrained primitive input, apply
[explicit parse states](practices/modeling/domain-types.md#classify-primitive-wrapper-input-with-explicit-states).
Prohibit primitive-wrapper `TryFrom`/`FromStr`, renamed `Result` constructors,
and helper conversions that hide classification. Inspect catalogs, fixtures, and
Serde adapters as well as product callers. Genuine representation conversions
(such as text to a number) retain concrete `Result` errors.

For text constructors, apply [empty-text state modeling](practices/modeling/domain-states.md#represent-empty-prose-as-a-value).
Use infallible classification for valid empty prose; do not invent validation
failures merely because a domain wrapper holds a string.

For application/framework release identities, apply
[declared releases](practices/modeling/domain-types.md#enumerate-supported-application-releases).
A successful parse returns a supported enum variant, never a validated string.
Require a compile-time check that the package release belongs to that enum.

For versioned contracts, apply [supported schema revisions](practices/modeling/domain-types.md#model-supported-schema-revisions-explicitly):
name supported identities in producers and independent consumers (including tests),
bind differing payload shapes to their versions, and
review migration dispatch exhaustively. Distinguish these from open runtime
[update counters](practices/modeling/domain-types.md#distinguish-schema-revisions-from-update-counters).

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
