---
name: rust-dev-skill
description: Apply Rust practices for ownership, workflow states, domain types, errors, and external boundaries.
---

# Rust Development Skill

Apply these practices to authored Rust product code, tooling, tests, examples,
and build scripts.

Apply [common coding](../../../common/coding-skill/SKILL.md) before the
selected language practices. Reuse it if already loaded for this assignment.

## Practice selection

Read the [knowledge graph](knowledge-graph.md) to select practices and identify
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

## Security prerequisites

- For security work, apply [common security](../../../../security-team/common/security-skill/SKILL.md).
- For secret handling, also apply [secret lifecycle](../../../../security-team/security-agent/skills/secret-lifecycle-skill/SKILL.md).
