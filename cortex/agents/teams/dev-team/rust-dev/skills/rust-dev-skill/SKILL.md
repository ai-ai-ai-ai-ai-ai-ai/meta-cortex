---
name: rust-dev-skill
description: Apply Rust practices for ownership, workflow states, domain types, errors, and external boundaries.
---

# Rust Development Skill

Apply these practices to authored Rust product code, tooling, tests, examples,
and build scripts.

## Behavior and workflows

- [Function ownership](practices/function-ownership.md): Receivers, associated functions, enum methods, and external callback exceptions.
- [Workflow typestate](practices/workflow-typestate.md): Legal operation order, consuming transitions, and private capability construction.
- [Owned updates](practices/owned-updates.md): Replacing values through `self`, returning outcomes, and narrow `&mut self` exceptions.

## Types and APIs

- [Domain types](practices/domain-types.md): Newtypes, validated construction, named aggregates, and conversion traits.
- [Domain states](practices/domain-states.md): Enums, state-owned payloads, exhaustive matching, and legitimate `Option`/`bool` uses.
- [API inputs](practices/api-inputs.md): One non-receiver parameter, named requests, and fixed-signature exceptions.
- [Error handling](practices/error-handling.md): Concrete `thiserror` errors, typed sources, `?` propagation, and prohibited panic shortcuts.
- [Paths and imports](practices/path-imports.md): Two-segment use-site paths, module qualifiers, and Clippy configuration.
- [Macro minimization](practices/rust-macro-minimization.md): Restrictions on authored macros and permitted compiler, ecosystem, and generation cases.

## External boundaries

- [Serialization and ABI boundaries](practices/serialization-boundaries.md): Typed decoding, wire representations, and Rust/WASM boundary conversion.
- [Rust–TypeScript separation](practices/rust-typescript-code-separation.md): Rust domain ownership, browser lifecycle ownership, and generated contracts.
- [WASM name coherence](practices/rust-wasm-name-coherence.md): Exported names, generated ABI types, and established wire names.

## Supporting practices

- [Rust testing](practices/rust-testing.md): Inline unit tests, boundary coverage, and the 90% line-coverage floor.
- [Rust dependency selection](practices/dependency-selection.md): crates.io download thresholds and repository popularity checks.
