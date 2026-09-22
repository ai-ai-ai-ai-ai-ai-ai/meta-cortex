# TypeScript Explicit State

Name absence and lifecycle states instead of making callers infer them. Apply
to authored JS/TS/Svelte, tests, fixtures, demos, configuration, and tooling.
Generated/dependency/build declarations retain their external contracts.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Name the state and its payload

Use a separately named enum-backed union. Keep values that transition together
on the same variant and expose named transitions rather than mutable handles.
Enums belong to their coherent vocabulary, not a repository-wide StateKind.

**Prohibited:**

```ts
interface DownloadState {
  readonly started: boolean;
  readonly result: Download | undefined;
}
```

**Preferred:**

```ts
enum DownloadKind { Idle = "idle", Running = "running", Complete = "complete" }
type DownloadState =
  | { readonly kind: DownloadKind.Idle }
  | { readonly kind: DownloadKind.Running }
  | { readonly kind: DownloadKind.Complete; readonly result: Download };
```

## Use enum members throughout the contract

Use members in constructors, comparisons, switches, and fixtures, including
closed protocol fields such as type/status/phase/mode/action. Preserve required
wire string values in the enum. In Rust/WASM projects, product/security vocabulary
comes from Rust; do not mirror or rename it in TypeScript. TypeScript-owned
domains define their vocabulary in TypeScript.

**Prohibited:**

```ts
type PanelState = { readonly kind: "open" } | { readonly kind: "closed" };
```

**Preferred:**

```ts
enum PanelKind { Open = "open", Closed = "closed" }
type PanelState =
  | { readonly kind: PanelKind.Open }
  | { readonly kind: PanelKind.Closed };
```

## Normalize absence at entry

Do not author null/undefined tokens or generic Option/Maybe/Present-Absent
wrappers. Normalize external browser/DOM/cache/lookup/parser absence with structural
or capability checks in the boundary decoder. Reject fake defaults, quoted
sentinel comparisons, non-null assertions, casts, and decorative wrappers.

**Prohibited:**

```ts
const selected = value ?? fallback;
if (typeof value === "undefined") { clear(); }
```

**Preferred:**

```ts
// Inside a UI owner with an already normalized selection:
switch (selection.kind) {
  case SelectionKind.Empty: return this.showEmpty();
  case SelectionKind.Selected: return this.show(selection.item);
}
```

## Keep defaults inside the selected branch

Prohibit ?? and ??=. Do not replace them with || or truthiness. Preserve valid
false/zero/empty values. Always-present fields are required and initialized.
A destructuring default is allowed only when the external contract defines
omission as that exact value; evaluate alternatives only in their selected branch.

**Prohibited:**

```ts
const delay = rawDelay || defaultDelay; // Replaces a valid zero.
```

**Preferred:**

```ts
// Inside the owner, after decoding the external setting:
switch (setting.kind) {
  case DelayKind.Specified: return setting.delay;
  case DelayKind.Default: return defaults.delay;
}
```

## Distinguish effects from absent values

Allow void for complete unit returns, callbacks, Promise<void>, synchronous-or-
asynchronous effects, and unary discard. Reject T | void and nested value-or-void
contracts. Model value absence explicitly instead.

**Prohibited:**

```ts
// Inside a reader:
read(): Promise<Document | void>;
```

**Preferred:**

```ts
// Inside a reader:
read(): Effect.Effect<DocumentRead, ReadFailure>;
// Inside a pure view owner:
close(): void;
```

## Keep failure state typed

Use closed failure kinds/outcomes and localize text at the presentation edge.
Do not keep parallel error-message slots or collapse variants back to booleans.
Effect owns expected failures; accumulated codec issues remain concrete and local.

**Prohibited:**

```ts
interface ImportView { readonly failed: boolean; readonly error: string; }
```

**Preferred:**

```ts
enum ImportKind { Idle = "idle", Failed = "failed" }
type ImportView =
  | { readonly kind: ImportKind.Idle }
  | { readonly kind: ImportKind.Failed; readonly failure: ImportFailure };
```

## Keep component enums in an importable module

Put runtime enums used by Svelte component instances in an adjacent cohesive .ts
module. Do not define them in either same-file script block. Use the project's
configured Svelte preprocessing and test actual rendering; a type check alone is not runtime
evidence. Initialize runes and bindable state explicitly.

**Prohibited:**

```ts
// Defined inside the component's script instead of its state module:
enum PanelKind { Open = "open", Closed = "closed" }
```

**Preferred:**

```ts
// In the component script; the enum is defined in panel-state.ts:
import { PanelKind } from "./panel-state";
```

## Assert states, not absence sentinels

Prohibit toBeUndefined/toBeNull/toBeDefined and equivalent implicit-absence
matchers. Test the semantic variant, required value, or exact structural property.
Match transitions exhaustively and keep positive/negative preflight fixtures.

**Prohibited:**

```ts
expect(selection).toBeUndefined();
```

**Preferred:**

```ts
expect(selection.kind).toBe(SelectionKind.Empty);
```

## Validation

- Inventory authored tokens, optional fields, zero-argument runes, and parameterless $bindable.
- Reject null/undefined, quoted sentinels, generic optional wrappers, raw closed discriminants, and nested value-or-void contracts.
- Reject Rust/WASM Option exports and null/undefined/void type overrides; preserve valid unit effects.
- Run transition tests, AST preflight where supplied, formatting, and applicable browser checks.
