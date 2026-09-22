# Svelte State Modeling

Make component visual and browser-lifecycle states explicit. Generated external
declarations remain external; the authored UI normalizes their results.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Initialize every modeled rune

Do not use zero-argument $state or implicit absence for a DOM reference that
authored code uses. A concrete initial value may be used directly; otherwise
name the lifecycle alternatives. These enums/unions live in the adjacent state
module and are imported into the component.

**Prohibited:**

```ts
let selection = $state<SelectedFile>();
```

**Preferred:**

```ts
// In file-selection.ts:
export enum FileSelectionKind { Empty = "empty", Selected = "selected" }
export type FileSelection =
  | { readonly kind: FileSelectionKind.Empty }
  | { readonly kind: FileSelectionKind.Selected; readonly file: File };
// In the component script, after importing those types:
let selection = $state<FileSelection>({ kind: FileSelectionKind.Empty });
```

## Move related values together

Group fields that transition together in one union and keep payloads on their
owner. Do not replace one external absence sentinel with another.

**Prohibited:**

```ts
let finished = $state(false);
let result = $state<ImportResult>();
```

**Preferred:**

```ts
// ImportKind and ImportState are declared in the adjacent state module.
let state = $state<ImportState>({ kind: ImportKind.Idle });
// Inside the completion handler:
state = { kind: ImportKind.Complete, result };
```

## Preserve generated product types

Component panels/tabs/form views may be TypeScript states. Portable product
workflows belong to Rust when the project uses Rust/WASM, or to the TypeScript
domain owner otherwise. Keep canonical semantic identifiers in their
variants; optionality does not justify widening them to string.

**Prohibited:**

```ts
type OrderSelection = { readonly order_id: string };
```

**Preferred:**

```ts
// OrderId is imported from the generated contract.
type OrderSelection =
  | { readonly kind: OrderSelectionKind.Empty }
  | { readonly kind: OrderSelectionKind.Selected; readonly order_id: OrderId };
```

## Validation

- Check rune declarations, clearing assignments, DOM-reference lifecycles, and coupled flags.
- Normalize browser/lookup/parser/cache absence in the boundary decoder.
- Run application-state checks, formatting, diff checks, and affected browser tests.
