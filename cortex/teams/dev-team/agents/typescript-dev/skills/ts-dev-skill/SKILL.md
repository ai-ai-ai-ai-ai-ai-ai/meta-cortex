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
and apply [branching and exhaustive matching](../../../../docs/programming/branching-and-exhaustive-matching.md)
and [TypeScript code checks](practices/typescript-code-checks.md). This
prerequisite is mandatory, independent of the selected implementation practices.

For any YAML-producing code, load and apply
[typed YAML construction](practices/typescript-domain-structure.md#serialize-yaml-from-typed-values)
before implementation or review. This includes static discovery/recovery examples
and valid fixtures; string construction is prohibited.

**Prohibited:** select only browser practices and omit type checking and linting.

**Preferred:** establish and run the required checks alongside browser validation.

## Practice selection

Read the [rule index](index.md) to select practices and identify
rule ownership and individual requirements. Follow its loading requirements and
read the selected practices in full. Before changing a rule, inspect its owner and affected related practices;
update the same namespaced rules, summaries, exceptions, and section links whenever the
requirements or their placement change.

## Effect: use upstream skills

Use Effect v4 for new or materially changed asynchronous, fallible, resource-owning,
concurrent, service-dependent, and untrusted-decoding workflows, including scripts
and tests. Pure calculations keep their existing domain owners.

Apply the official [effect-ts skill](https://github.com/Effect-TS/skills/blob/main/skills/effect-ts/SKILL.md).
Before writing Effect code, read the installed `effect/AGENTS.md` completely,
then follow its relevant documentation links and consult `effect/src` for API
details. Resolve the package from the workspace that owns the code, including
hoisted `node_modules`; do not use a different project's installed version.
For Cortex's own scripts, the package is at the library root's
`node_modules/effect/`. Install missing dependencies with the project's existing
package manager and lockfile before reading it.

Upstream owns Effect idioms, composition, services, errors, schemas, resources,
and runtime guidance. Do not maintain a parallel Cortex Effect tutorial, operator
allowlist, or copied upstream skill. Shared domain, language, and project rules
still apply; keep compositions flat and readable without adding helper layers.

Pin the same explicit v4 release in workspace packages and verify the lockfile's
resolved version. Identify prereleases in delivery evidence. For a v3 migration,
apply the official [effect-v3-to-v4 skill](https://github.com/Effect-TS/skills/blob/main/skills/effect-v3-to-v4/SKILL.md)
under the session's selected development mode. Run the project's required checks
and tests after migration.

## TypeScript security practices

- For secret handling, apply the local [secret ownership rules](practices/typescript-domain-structure.md#keep-failures-and-secrets-with-their-owners).
- For browser secret interactions, apply [secret surfaces and disclosure](practices/browser-implementation.md#keep-secrets-out-of-incidental-surfaces).

## Interface prerequisites

- For browser UI implementation, apply [web design](../../../web-designer/skills/web-design-skill/SKILL.md).
- For Rust/WASM consumers, apply the [WASM boundary prerequisites](../../../rust-dev/skills/rust-dev-skill/SKILL.md#wasm-boundary-prerequisites).
