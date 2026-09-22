---
name: secret-lifecycle-skill
description: Apply and independently verify secret lifetimes across Rust, WASM, TypeScript, and browser interfaces.
---

# Secret Lifecycle Skill

Read [secret lifecycle](../../../../docs/secret-lifecycle.md) for ownership, storage,
redaction, lifetime, and cleanup requirements.
For each affected boundary, read the applicable practice:

- [Rust secret lifecycle](practices/rust-secret-lifecycle.md): validated secret types, redaction, zeroization, and capability ownership.
- [TypeScript secret lifecycle](practices/typescript-secret-lifecycle.md): browser interaction lifetime, cleanup, and opaque capabilities.

Verify cleanup at each terminal interaction and enclosing session boundary.
Implementation owners use these requirements while implementing and testing
their assigned changes. Security reviewers verify them independently; loading
this skill does not change either role's assignment. In multi-agent mode,
return evidence and out-of-scope defects to the assigning Team Gizmo. In
single-agent mode, apply the requirements and report the evidence locally.
