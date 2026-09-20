# TypeScript Named Call Arguments

## Purpose

In authored TypeScript, object parameter contracts and object call
arguments must both be named and typed.

## Scope

Applies to all authored production TypeScript and Svelte.

There is no production-source migration allowlist. Every function-valued prop,
local helper, callback, method, and exported function must use a named semantic
parameter contract when its parameter is object-shaped.

Generated bindings are excluded.

## Required pattern

Rules:

- Every object-shaped function or method parameter uses a named semantic
  `type`, `interface`, or Rust-generated boundary type.
  - Object-shaped includes object literals, mapped types such as `Pick<T, K>`
    and `Omit<T, K>`, arrays, tuples, maps, sets, and records.
- Inline object parameter annotations are prohibited, including destructured
  parameters, local helpers, `T[]`, tuples, `Array<T>`, and
  `ReadonlyArray<T>`.
- Generic or operation-only names such as `Args`, `CallbackArgs`, `PutArgs`,
  and line-number-derived names are prohibited.
  - The name must identify the domain value or request.
- Every call argument that is an object must be a named variable or constant.
  - The name should carry an explicit type such as `ExpectFieldArgs<...>`,
    `ObjectJsonSchemaArgs`, or `FieldErrorArgs`.
- Object literals remain allowed:
  - when constructing that named value; and
  - when returning a value from a function or `build` callback.
- Do not bypass the rule with `fn({ ... } as SomeType)`.
  - Name the value first, then cast if a host boundary truly requires it.
- Direct object arguments to Svelte's `$state`, `$state.raw`, `$derived`, and
  `$bindable` compiler runes are the narrow exception.
  - Moving those values can violate rune placement or freeze reactive capture.
  - This exception does not apply to `$state.snapshot` or ordinary calls.
- A function-valued parameter may return an inline object type.
  - That return value is not the parameter contract.
  - Object-shaped parameters declared inside the callback still require named
    semantic contracts.

## Enforcement

Static checks and semantic review must enforce this contract. They must:

- reject inline object parameter types;
- require an explicit type on named object-literal arguments;
- reject generic or operation-only parameter names such as `Args`,
  `WriteArgs`, `PickArgs`, and `PutArgs`;
- recursively inspect wrapped and qualified type references;
- reject inline array and tuple annotations in shorthand and generic form;
- require named semantic contracts for maps, sets, and records;
- reject imported generic names as bypasses;
- reject object-valued parameter defaults, including literals, arrays,
  constructed class values, named bindings, and object-returning factory calls;
- inspect enclosing TypeScript syntax and call-site assignment, conditional,
  logical, or sequence expressions; and
- inspect statically resolvable object values from spread arrays.

Apply defaults at the call site or inside the function body after reading the
named contract.

## Application Checklist

- [ ] Search the changed package for inline object call arguments.
- [ ] Search function and method declarations for inline object parameter types.
- [ ] Prefer exported arg types from the callee module.
- [ ] Prefer Rust-generated types for domain-owned boundary contracts.
- [ ] Keep the Web lint task green.
