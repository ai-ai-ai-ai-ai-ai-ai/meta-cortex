# Rust Module Layout

## Use named module files

Put each authored file-backed module in `<module>.rs`. Keep its child modules
under the sibling `<module>/` directory. Do not create or retain `mod.rs`, even
for a module containing only declarations or re-exports. Apply this convention
to product code, tooling, and test support modules.

These alternative layouts declare the same `agent` module and `agent::worker`
child. Both compile; the `mod.rs` layout violates this practice.

**Prohibited:** the owning module's filename loses its name.

```text
src/
├── lib.rs
└── agent/
    ├── mod.rs
    └── worker.rs
```

**Preferred:** name the module file and keep its children in the matching directory.

```text
src/
├── lib.rs
├── agent.rs
└── agent/
    └── worker.rs
```

The declarations need no path override:

```rust
// src/lib.rs
pub mod agent;

// src/agent.rs
pub mod worker;
```

Normal `mod` and `pub mod` declarations are required to connect module files.
Use `pub mod` for public modules and `mod` for private modules; this filename
convention does not change visibility. It prohibits the filename `mod.rs`, not
the `mod` keyword.

The convention also applies recursively: `agent/worker.rs` owns children under
`agent/worker/`. Crate entry points retain `lib.rs` and `main.rs`; integration
test entry points retain their normal names. Keep unit tests inline in their
implementation files as required by [test placement](rust-testing.md#test-placement).
Do not interpret named module files as a requirement to extract inline tests.
Dependency-owned and generated source layouts retain their external ownership.

## Preserve resolution when moving modules

Move `parent/child/mod.rs` to `parent/child.rs` and leave its children in
`parent/child/`. Preserve module names, visibility, re-exports, and test behavior.
Recalculate file-relative `include_str!`, `include_bytes!`, and `include!` paths;
update explicit path attributes and repository references affected by the move.

**Prohibited:** leave a forwarding `mod.rs`, create both layouts for one module,
or add `#[path]` merely to disguise the old layout.

**Preferred:** move the owner file and use ordinary `mod child;` declarations.
An include inside the moved file loses one parent traversal:

```rust
// Before: src/settings/mod.rs, reading the crate's defaults.toml.
let defaults = include_str!("../../defaults.toml");

// After: src/settings.rs, reading that same file.
let defaults = include_str!("../defaults.toml");
```

## Validation

- Inventory authored Rust module files across all workspace members and test
  support directories; verify no `mod.rs` remains in that scope.
- Check include paths and references against the destination file's directory.
- Run the [Rust code checks](rust-code-checks.md) and affected tests to verify
  module resolution, embedded assets, and preserved public behavior.
- Review the move separately from behavioral changes; a rename does not authorize
  API visibility or behavior changes. Keep the [test-placement rules](rust-testing.md#test-placement).
