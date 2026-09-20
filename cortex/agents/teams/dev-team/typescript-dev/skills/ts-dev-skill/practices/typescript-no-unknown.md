# TypeScript Concrete Values

## Purpose

- Do not author the `object` type in linted TypeScript or Svelte code.
- Do not author the `unknown` type except at an unavoidable untyped transport
  boundary that narrows it immediately.
- Do not replace it with another generic value in domain or application code.
- Model concrete domain values.

## Scope

Applies to all authored TypeScript and Svelte, including tooling.

Generated bindings are excluded.

Generic-value APIs are not compliant examples or normal boundary exceptions.
Do not add them, widen them, or copy them into new code.

## Problem Pattern

```ts
export function decodeDependencyPopularityRequest(value: unknown);
export type UnknownRecord = Record<string, unknown>;
```

- `unknown` is an unnamed top type.
- `object` is an unnamed non-primitive type.
- Either claims structure without naming or proving that structure.
- `ExternalValue` is also generic.
- Any of these types can erase domain meaning after escaping a parser or
  transport adapter.

## Preferred Pattern

```ts
export type DependencyPopularityRequest = {
  readonly packageName: PackageName;
  readonly ecosystem: DependencyEcosystem;
};

declare class DependencyPopularityEvaluator {
  evaluate(request: DependencyPopularityRequest): DependencyPopularityResult;
}
```

Rules:

- Do not write the `unknown` or `object` type token in enforced sources.
- Do not substitute `Object`, `{}`, `Record<string, ...>`, broad index
  signatures, `any`, or recursive generic values.
- Do not use `ExternalValue`, `ExternalObject`, `JsonValue`, or equivalent
  recursive value bags as domain models.
- Do not store generic values in application state.
- Do not expose generic values through commands, services, or UI APIs.
- Define concrete structs, enums, unions, and identifiers for domain data.
- Keep catch bindings unannotated or use concrete error types such as
  `RuntimeFailure` or `Error`.
  - Never write `catch (error: unknown)`.
- Use Effect's typed error channel for effectful commands and concrete
  codec-local outcomes for boundary decoding.
  - Do not use `Promise<unknown>` or `Promise<ExternalValue>`.

## Narrow Boundary Exception

- The `object` type has no boundary exception.
  - It asserts that the input is non-primitive before validation.
- Use `unknown` only when a host API unavoidably provides untyped JSON, YAML,
  WASM, or browser IPC data.
- Keep the exception inside a dedicated parser, codec, message guard, or
  contiguous boundary-decoding pipeline.

The adapter must:

- validate the input immediately;
- return a concrete domain type or a typed decode failure from the completed
  boundary pipeline;
- pass a generic value only between adjacent steps in that boundary pipeline;
- avoid storing the generic value;
- avoid passing the generic value into domain or application services;
- keep casts at the host boundary.

- Do not treat this exception as the preferred application type.
- If a concrete platform input type exists, use it instead.
- The transport type may appear only at that boundary.

Name the source or format when it improves clarity:

```ts
declare class DependencyPopularityRequestDecoder {
  decode(value: UntrustedYamlNode): DecodeOutcome<DependencyPopularityRequest>;
}
```

## Enforcement

Use ESLint `@typescript-eslint/no-restricted-types` to ban `unknown` and
`object`. Only dedicated boundary adapters may use `unknown`; `object` has
no exception. Review must verify immediate narrowing to concrete values.

## Application Checklist

- [ ] Replace `unknown` parameters and fields outside immediate transport
      decoders with concrete domain types.
- [ ] Replace `object` annotations, constraints, assertions, and returns.
- [ ] Reject `Object`, `{}`, `any`, and generic records used as substitutes.
- [ ] Remove generic recursive values from state, results, and service APIs.
- [ ] Keep any unavoidable external-value use inside a dedicated adapter.
- [ ] Prove that each adapter returns a concrete domain type or typed failure.
- [ ] Keep the applicable lint checks passing.
