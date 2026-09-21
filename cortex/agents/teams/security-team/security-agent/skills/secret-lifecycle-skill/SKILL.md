---
name: secret-lifecycle-skill
description: Independently verify secret lifetimes across Rust, WASM, TypeScript, and Svelte.
---

# Secret Lifecycle Skill

Apply [common security](../../../common/security-skill/SKILL.md), reusing
it if already loaded for this assignment.
For each affected boundary, read the applicable practice:

- [Rust secret lifecycle](practices/rust-secret-lifecycle.md): validated secret types, redaction, zeroization, and capability ownership.
- [TypeScript secret lifecycle](practices/typescript-secret-lifecycle.md): browser interaction lifetime, cleanup, and opaque capabilities.

Verify cleanup at each terminal interaction and enclosing session boundary.
Return verification evidence for the affected operation; report implementation
defects to Team Gizmo.
