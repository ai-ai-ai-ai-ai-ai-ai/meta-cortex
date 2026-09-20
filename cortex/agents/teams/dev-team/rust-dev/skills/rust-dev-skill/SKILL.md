---
name: rust-dev-skill
description: Apply Rust practices for ownership, workflow states, domain types, errors, and external boundaries.
---

# Rust Development Skill

Apply these practices to authored Rust product code, tooling, tests, examples,
and build scripts.

## Modeling

- [Domain types](practices/modeling/domain-types.md): Newtypes, validated construction, named aggregates, and conversion traits.
- [Domain states](practices/modeling/domain-states.md): Enums, state-owned payloads, exhaustive matching, and legitimate `Option`/`bool` uses.
- [Struct construction](practices/modeling/struct-construction.md): Derived single-field conversions, named-field literals, and the prohibition on authored `new` constructors.
- [Default values](practices/modeling/default-values.md): Derived struct defaults and explicit default enum variants.

## Behavior

- [Function ownership](practices/behavior/function-ownership.md): Function, constant, and state ownership; dependency direction; methods versus conversions; external boundary exceptions.
- [API inputs](practices/behavior/api-inputs.md): One non-receiver parameter, named requests, and fixed-signature exceptions.
- [Workflow typestate](practices/behavior/workflow-typestate.md): Legal operation order, consuming transitions, and private capability construction.
- [Owned updates](practices/behavior/owned-updates.md): Replacing values through `self`, returning outcomes, and narrow `&mut self` exceptions.
- [Error handling](practices/behavior/error-handling.md): Concrete `thiserror` errors, typed sources, `?` propagation, and prohibited panic shortcuts.

## Boundaries

- [Serialization and ABI boundaries](practices/boundaries/serialization-boundaries.md): Typed decoding, wire representations, and Rust/WASM boundary conversion.
- [Rust–TypeScript separation](practices/boundaries/rust-typescript-code-separation.md): Rust domain ownership, browser lifecycle ownership, and generated contracts.
- [WASM name coherence](practices/boundaries/rust-wasm-name-coherence.md): Exported names, generated ABI types, and established wire names.

## Tooling

- [Libraries](practices/tooling/libraries.md): Serde, thiserror, derive_more, and tracing as the Rust project library choices.

- [Paths and imports](practices/tooling/path-imports.md): Two-segment use-site paths, module qualifiers, and Clippy configuration.
- [Rust dependency selection](practices/tooling/dependency-selection.md): crates.io download thresholds and repository popularity checks.
- [Macro minimization](practices/tooling/rust-macro-minimization.md): Restrictions on authored macros and permitted compiler, ecosystem, and generation cases.
- [Rust testing](practices/tooling/rust-testing.md): Inline unit tests, boundary coverage, and the 90% line-coverage floor.
