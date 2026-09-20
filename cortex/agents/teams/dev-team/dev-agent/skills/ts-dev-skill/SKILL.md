---
name: ts-dev-skill
description: Apply TypeScript rules for named APIs, explicit state, concrete domain types, and Effect workflows.
---

# TypeScript Development Skill

Apply every applicable rule below with the prerequisites supplied by the
assignment’s skill composition. These rules cover authored TypeScript,
JavaScript, Svelte scripts, tests, configuration, and agent tooling. Generated
bindings and dependency code retain their externally owned contracts.

## Required practices

Load domain structure and explicit state together. For effectful workflows,
also load Effect workflows before implementation; their rules apply together.

- [Function ownership](practices/typescript-function-ownership.md): use meaningful instance owners, restrict statics to construction, and keep Svelte handlers within their component's interaction contract.

- [Single parameter](practices/typescript-single-parameter.md): authored functions, methods, constructors, and arrows take at most one parameter. Multiple inputs require one named semantic request. Only externally fixed signatures receive a narrow documented exception.
- [Named arguments](practices/typescript-named-args.md): every object-shaped parameter has a named semantic type; every object call argument is a named, explicitly typed value. Inline object arguments, casts, defaults, and spread expressions must not bypass the rule. Only the specified Svelte compiler runes receive an exception.
- [Domain structure](practices/typescript-domain-structure.md): every function has a meaningful owner; domain scalars are nominally typed, unions are named, and static methods are limited to narrow construction builders.
- [Explicit state](practices/typescript-explicit-state.md): use enum-backed discriminated unions. Authored `null`, `undefined`, `??`, `??=`, implicit-absence matchers, and generic optional-value wrappers are prohibited. Preserve the documented unit/effect uses of `void`.
- [Enums instead of booleans](practices/typescript-enums-over-booleans.md): semantic enums are required even for two-case domain, workflow, mode, policy, and configuration values. Booleans are limited to required external contracts and immediately consumed private predicates.
- [Concrete values](practices/typescript-no-unknown.md): `object` has no exception; `unknown` is limited to unavoidable transport boundaries that immediately decode concrete values. Do not substitute `any` or generic value bags.
- [Effect workflows](practices/typescript-effect.md): Effect v3 is required for new or materially changed asynchronous, fallible, resource-owning, concurrent, service-dependent, or boundary-decoding workflows. Do not introduce competing Result wrappers, `neverthrow`, or hand-rolled Promise error workflows. Pure calculations and rendering do not need ceremonial Effect wrappers.

## Task-specific practices

- For asynchronous serialization, apply [serial operation queues](practices/typescript-serial-operation-queues.md), together with the Effect workflow requirements.

Read the applicable practices in full, including their boundary exceptions
and validation requirements. Existing code is not permission to weaken a rule.

## Supporting practices

- When adding or reviewing dependencies, apply [dependency selection](practices/dependency-selection.md), including the ecosystem download thresholds.
