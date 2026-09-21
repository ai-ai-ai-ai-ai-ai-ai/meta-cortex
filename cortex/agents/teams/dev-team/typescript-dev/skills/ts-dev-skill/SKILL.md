---
name: ts-dev-skill
description: Apply TypeScript rules for named APIs, explicit state, concrete domain types, Effect workflows, and browser implementation.
---

# TypeScript Development Skill

These rules cover authored TypeScript,
JavaScript, Svelte scripts, tests, configuration, and agent tooling. Generated
bindings and dependency code retain their externally owned contracts.

Apply [common coding](../../../common/coding-skill/SKILL.md) before the
selected language practices. Reuse it if already loaded for this assignment.

## Practice selection

Read the [knowledge graph](knowledge-graph.md) to select practices and identify
rule ownership and individual requirements. Follow its loading requirements and
read the selected practices in full. Before changing a rule, inspect its owner and affected related practices;
update the same namespaced rules, summaries, exceptions, and section links whenever the
requirements or their placement change.

## TypeScript security practices

- For secret handling, apply the local [secret ownership rules](practices/typescript-domain-structure.md#keep-failures-and-secrets-with-their-owners).
- For browser secret interactions, apply [secret surfaces and disclosure](practices/browser-implementation.md#keep-secrets-out-of-incidental-surfaces).

## Interface prerequisites

- For browser UI implementation, apply [web design](../../../web-designer/skills/web-design-skill/SKILL.md).
- For Rust/WASM consumers, apply the [WASM boundary prerequisites](../../../rust-dev/skills/rust-dev-skill/SKILL.md#wasm-boundary-prerequisites).
