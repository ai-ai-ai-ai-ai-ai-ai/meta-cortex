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

## Match domain values directly

Apply the shared [branching rule](../../../../../docs/programming/branching-and-exhaustive-matching.md).

- Use native `switch` for domain decisions.
- Prohibit ordinary boolean `if`, `else if`, and `if`/`else` statements.

These alternative method bodies receive `delivery: DeliveryKind` and return
`AddressRequirement`. `DeliveryKind` has `Shipment` and `Download` variants;
`AddressRequirement` has `Required` and `NotRequired` variants. Both compile;
the boolean branch violates the practice.

**Prohibited:** turn the delivery kind into a boolean.

```ts
if (delivery === DeliveryKind.Shipment) {
  return AddressRequirement.Required;
}
return AddressRequirement.NotRequired;
```

**Preferred:** use the native switch.

```ts
switch (delivery) {
  case DeliveryKind.Shipment:
    return AddressRequirement.Required;
  case DeliveryKind.Download:
    return AddressRequirement.NotRequired;
}
```

## Match decisions exhaustively

- Name every enum or discriminated-union variant in `switch` cases.
- Keep a transport union's discriminator attached to its payload so TypeScript
  can narrow the variant before payload access.
- Group named cases only when they intentionally share output.
- Do not use `default` to absorb future variants in a closed domain decision.
- Prohibit the ternary operator (`condition ? first : second`).
- Apply the mandatory [branching checks](typescript-code-checks.md#check-branching).
  TypeScript alone does not enforce every exhaustive switch.

These alternative method bodies receive `field: PromptField` and return
`Question`. `PromptField` is an enum-backed union with `Text`, `Integer`, and `Choice`
variants of `FieldType`. All variants carry `question`; only `Choice` carries
`options`. Assume the host owns the `Question` output shape: a required `title`
and, for choice prompts, `options`.
The first body returns its local `question` after the shown declaration.
Both compile; only the preferred form requires each field kind to be named.

**Prohibited:** a new field type silently receives the text-field prompt.

```ts
const question = field.type === FieldType.Choice
  ? { title: field.question, options: field.options }
  : { title: field.question };
```

**Preferred:** every field type is named, including cases that share output.

```ts
switch (field.type) {
  case FieldType.Text:
  case FieldType.Integer:
    return { title: field.question };
  case FieldType.Choice:
    return { title: field.question, options: field.options };
}
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

Allow void for complete unit returns, callbacks, `Promise<void>`, synchronous-or-
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
