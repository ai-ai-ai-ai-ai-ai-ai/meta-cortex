---
name: secret-lifecycle-skill
description: Implement and review secret lifetimes across Rust, WASM, TypeScript, and Svelte.
---

# Secret Lifecycle Skill

Apply this skill after the assigned agent has loaded security practices.
For each affected boundary, read the applicable practice:

- [Rust secret lifecycle](practices/rust-secret-lifecycle.md): validated secret types, redaction, zeroization, and capability ownership.
- [TypeScript secret lifecycle](practices/typescript-secret-lifecycle.md): browser interaction lifetime, cleanup, and opaque capabilities.

Verify cleanup at each terminal interaction and enclosing session boundary.
Keep implementation and review evidence with the affected operation.
