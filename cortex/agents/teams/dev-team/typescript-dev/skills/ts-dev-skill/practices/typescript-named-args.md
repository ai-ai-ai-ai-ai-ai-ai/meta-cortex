# TypeScript Named Arguments

Name both the parameter contract and the object passed to it. Apply this to all
authored production TypeScript/Svelte, including callbacks and local helpers;
generated declarations are excluded.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Name the parameter contract

Use a semantic type, interface, or generated boundary type. Do not inline an
object, array, tuple, mapped type, map, set, or record in a parameter. Avoid
Args, CallbackArgs, PutArgs, and names derived from line numbers.

**Prohibited:**

```ts
// Inside Exporter:
run(request: { readonly destination: ExportPath }): ExportOutcome;
```

**Preferred:**

```ts
interface ExportRequest {
  readonly destination: ExportPath;
}
// Inside Exporter:
run(request: ExportRequest): ExportOutcome;
```

## Name and type object arguments

Create a named, explicitly typed binding before passing an object. Returning
an object from a method or build callback remains valid. Do not bypass this
rule with casts, conditional/assignment expressions, or spread arrays.

**Prohibited:**

```ts
exporter.run({ destination } as ExportRequest);
```

**Preferred:**

```ts
const request: ExportRequest = { destination };
exporter.run(request);
```

## Keep object defaults out of parameters

Object-valued defaults are prohibited whether they are literals, arrays,
constructed instances, named bindings, or factory results. Apply the default
at the caller or inside the receiving owner.

**Prohibited:**

```ts
// Inside Exporter:
run(request: ExportRequest = defaults.build()): ExportOutcome;
```

**Preferred:**

```ts
// At the caller:
const request: ExportRequest = defaults.build();
exporter.run(request);
```

## Limit rune exceptions to the compiler forms

Direct object arguments are allowed only for $state, $state.raw, $derived, and
$bindable, where moving the value can change compiler placement or capture.
The exception does not cover $state.snapshot or ordinary calls.

**Prohibited:**

```ts
// Inside a rune-owning component:
api.submit({ order_id });
```

**Preferred:**

```ts
// Inside a rune-owning component:
let request = $state.raw<OrderRequest>({ order_id });
api.submit(request);
```

## Validation

- Check inline object/array/tuple types, including nested callbacks and qualified/wrapped references.
- Reject imported generic names and object-valued defaults used as bypasses.
- Inspect conditional/logical/sequence/assignment arguments and resolvable spreads.
- Prefer the callee’s exported request type or generated domain type; run applicable lint checks.
