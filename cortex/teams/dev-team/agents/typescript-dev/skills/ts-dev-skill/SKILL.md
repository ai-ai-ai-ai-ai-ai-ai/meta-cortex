---
name: ts-dev-skill
description: Apply TypeScript rules for mandatory code checks, warning-free builds, named APIs, explicit state, concrete domain types, Effect workflows, and browser implementation.
---

# TypeScript Development Skill

These rules cover authored TypeScript,
JavaScript, Svelte scripts, tests, configuration, and agent tooling. Generated
bindings and dependency code retain their externally owned contracts.

Use the consuming project's languages, UI stack, and execution commands.
TypeScript may own domain and security behavior in TypeScript projects. When
the project uses Rust/WASM for portable product or security logic, preserve that
ownership and consume its generated contracts. Load Svelte-specific practices
only for Svelte code; they do not authorize replacing another UI framework.

Apply [programming requirements](../../../../docs/index.md) before the
selected language practices. Reuse it if already loaded for this assignment.

## Required actions

For every TypeScript or JavaScript implementation or tooling assignment, load
and apply [TypeScript code checks](practices/typescript-code-checks.md). This
prerequisite is mandatory, independent of the selected implementation practices.

**Prohibited:** select only browser practices and omit type checking and linting.

**Preferred:** establish and run the required checks alongside browser validation.

## Practice selection

Read the [rule index](index.md) to select practices and identify
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
