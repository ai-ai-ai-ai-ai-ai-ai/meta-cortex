# TypeScript Concrete Values

Keep concrete values in authored code, including tooling. Generated contracts
are external; adapters must still decode their input before application use.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Do not erase application contracts

Prohibit object, Object, {}, any, broad index signatures, generic records,
recursive JsonValue/ExternalValue bags, and generic promise results. Neither
application state nor commands/services/UI may retain such values.

**Prohibited:**

```ts
interface EditorState {
  readonly document: object;
}
// Inside DocumentService:
load(): Promise<unknown>;
```

**Preferred:**

```ts
interface EditorState {
  readonly document: Document;
}
// Inside DocumentService:
load(): Effect.Effect<Document, DocumentFailure>;
```

## Decode unknown only at an unavoidable edge

Use unknown only when an external host has no concrete input type. Keep it
inside a dedicated contiguous decoder pipeline; return a concrete type or typed
failure. Do not store it or send it to application services. object has no
exception because it assumes a shape before validation.

**Prohibited:**

```ts
// Inside the transport adapter:
accept(value: unknown): void {
  this.session.load(value as Document);
}
```

**Preferred:**

```ts
// Inside a dedicated transport decoder; schema belongs to this TS-owned format.
decode(value: unknown) {
  return Schema.decodeUnknown(DocumentSchema.value)(value);
}
```

## Keep failures concrete

Use Effect’s typed failure channel for effectful commands and concrete
codec-local decoding outcomes. Catch bindings stay unannotated or concretely
typed; never annotate them unknown. Keep unavoidable casts at the host edge.

**Prohibited:**

```ts
try {
  host.read();
} catch (error: unknown) {
  state.failure = error;
}
```

**Preferred:**

```ts
interface HostReadAttempt {
  readonly try: () => HostRecord;
  readonly catch: (error: unknown) => ReadFailure;
}

// Inside the host adapter; failures.decode immediately classifies the error.
const attempt: HostReadAttempt = {
  try: () => host.read(),
  catch: (error) => failures.decode(error),
};
return Effect.try(attempt);
```

## Validation

- Enforce restricted types with ESLint; object has no exception.
- Review each unknown boundary for immediate decoding, no storage, and a concrete output.
- Reject generic-value substitutes and run the affected type and lint checks.
