---
name: rust-dev-skill
description: Apply Rust coding rules for typed domain APIs, ownership, typestate, errors, and WASM boundaries.
---

# Rust Development Skill

Read and apply the [common coding skill](../../../../../../skills/dev/coding-skill/SKILL.md),
then the following Rust requirements. These apply to authored product code,
tooling, tests, examples, and build scripts.

## Required practices

- [Rust coding](practices/rust-coding.md): at most one non-receiver parameter, named request structs, validated domain newtypes, exhaustive enum modeling, typed errors, and non-use paths of at most two segments.
- [Action ownership and typestate](practices/rust-action-ownership.md): every function has a meaningful type owner; meaningful action flows encode legal sequencing in types. Consume replaced capabilities and keep advanced-state construction private.
- [Typed newtypes](practices/typed-newtypes.md): preserve domain meaning through public APIs and boundaries. Use named aggregate fields and validated construction rather than positional constructors.
- [Macro minimization](practices/rust-macro-minimization.md): repository-defined macros are prohibited for routine code; retain only the documented compiler, ecosystem, and code-generation exceptions.

Production errors use concrete `thiserror` enums. `anyhow` is test-only.
Do not call `unwrap`, `expect`, or `expect_err`, including in tests; fallible
tests return a concrete result or `anyhow::Result` and propagate with `?`.
Owned updates consume `self`; `&mut self` is limited to required traits or
externally owned mutation contracts. Preserve the narrow exceptions in the
linked rules.

## Cross-language work

When code crosses Rust, WASM, and TypeScript, read and apply:

- [Rust–TypeScript separation](practices/rust-typescript-code-separation.md): Rust owns portable domain models and decisions; TypeScript owns browser lifecycle and presentation. Consume generated contracts directly.
- [WASM name coherence](practices/rust-wasm-name-coherence.md): exported callables retain their Rust names; construct the exact generated ABI type and preserve established wire names.

Do not expose `Option<T>` through `Tsify` fields or `wasm_bindgen` parameters
or returns. Normalize domain absence into named Rust enums before export.
Internal truthful absence may still use `Option<T>` as specified in Rust coding.

## Supporting practices

- Apply [Rust testing](practices/rust-testing.md): inline unit-test placement, typed boundary coverage, and the combined portable Rust coverage floor of 90%.
- When adding or reviewing dependencies, apply [dependency selection](practices/dependency-selection.md), including the ecosystem download thresholds.
