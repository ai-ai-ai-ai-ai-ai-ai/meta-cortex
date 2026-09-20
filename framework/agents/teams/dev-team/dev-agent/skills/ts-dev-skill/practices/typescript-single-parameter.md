# TypeScript Single Parameter

## Purpose

Authored TypeScript functions and methods may take at most one parameter.
Multi-argument APIs must use a named object type.

This is TypeScript's application of the one-parameter request rule in
[domain API integrity](../../../../../../../skills/dev/coding-skill/practices/domain-api-integrity.md).

## Scope

- Apply to all authored TypeScript and Svelte, including application code and tooling.
- Exclude generated bindings.
- Host callback signatures may require multiple positional values.
  - Keep that boundary narrow.
  - Use a focused ESLint suppression with a reason when the host owns the
    callback shape.
  - Do not suppress a project-authored API.

## Problem Pattern

```ts
export function writeDocumentFile(
  document: Document,
  destinationPath: string,
): Promise<DocumentFileWriteResult>;
```

Multiple positional parameters hide argument meaning at call sites and make
reordering unsafe.

## Preferred Pattern

```ts
export type DocumentFileWriteRequest = {
  readonly document: Document;
  readonly destinationPath: string;
};

declare class DocumentFileWriter {
  // Method signature; the writer owns the destination capability.
  write(request: DocumentFileWriteRequest): Promise<DocumentFileWriteResult>;
}
```

Call sites pass a single object:

```ts
const request: DocumentFileWriteRequest = { document, destinationPath };
writer.write(request);
```

Rules:

- Maximum one parameter per authored function, method, constructor, or arrow
  function.
- Every object-shaped parameter uses a named semantic `type`, `interface`, or
  Rust-generated boundary type.
  - Object-shaped includes object literals, mapped types such as `Pick<T, K>`
    and `Omit<T, K>`, arrays, tuples, maps, sets, and records.
- Inline object parameter annotations are prohibited, including for local
  helpers, destructured parameters, `T[]`, tuples, `Array<T>`, and
  `ReadonlyArray<T>`.
- Generic or operation-only contract names such as `Args`, `CallbackArgs`,
  `PutArgs`, or names derived from line numbers are prohibited.
  - Name the contract after its domain value or request.
- Do not use optional `undefined` parameters to fake multi-argument APIs.
  - Model omitted fields with domain unions or required object fields.
- Default values belong at the call site or inside the function body after
  reading the object, not as a second positional parameter.
- A function-valued parameter may return an inline object type.
  - That return value is not the parameter contract.
  - Object-shaped callback parameters still require named semantic contracts.

## Enforcement

Use ESLint `max-params: [error, 1]` and semantic review to enforce the rule.

## Review checklist

- [ ] New authored functions take zero or one parameter.
- [ ] Multi-value inputs use a typed object argument.
- [ ] Every object-shaped parameter refers to a named semantic contract.
- [ ] Any host-callback exception is local and explains the host contract.
- [ ] The applicable lint checks pass.
