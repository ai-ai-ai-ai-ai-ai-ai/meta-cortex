# Rust-TypeScript Code Separation

## Purpose

Keep application/domain data shapes in Rust, with TypeScript reserved for UI
presentation state and browser glue. Use this when a TypeScript type looks like
core product knowledge rather than a visual component concern.

This rule applies equally to browser extensions.

Names such as `domain-core`, `wasm-bridge`, `web-app`, `extension-core`, and
`extension-wasm` describe architectural roles; use the project's actual package
names without changing those ownership boundaries.

## Problem Pattern

`web-app` defines exported TypeScript unions, structs, or validators for app
concepts because the current flow is implemented from UI code. This duplicates
domain schema outside Rust. It risks drift across web, wasm, and future hosts.

The review question is: "Is this type about the app itself, or is it only a
visual element in the UI?"

If it describes vault behavior, storage/sync providers, enrollment payloads,
secret formats, validation, wire contracts, workflow command arguments, or
recovery summaries, it is app/core information.

## Preferred Pattern

Put app/domain types in Rust first:

- Prefer `domain-core` for simple domain structs, enums, payload schemas,
  serialization, and validation.
- Follow [rust-coding.md](rust-coding.md) for Rust model shape: closed sets are
  enums, cross-workflow optional fields are usually missing enum variants, and
  loose persisted JSON must be classified before domain logic.
- It is acceptable for simple core DTOs/enums to carry wasm/serialization
  annotations needed for boundary exposure, as long as `domain-core` does not
  gain browser APIs, I/O, session state, or wasm-specific behavior. Do not copy
  a core enum into a string field in `wasm-bridge` merely because the enum lives in
  `domain-core`; export the core enum with `#[wasm_bindgen]` and use it directly.
- Use `wasm-bridge` for bridge concerns: wasm exports, session manager methods,
  durable browser storage/provider I/O, and conversions between JS calls and core
  types. Prefer established Rust browser abstraction crates (`gloo-storage`,
  `gloo-file`, `rexie`, `reqwest`) over direct `web-sys`/`js-sys` calls. If a
  direct Web API call is unavoidable, keep it in a narrow adapter module and do
  not let that style spread into domain/session policy.
- Use `extension-core` for portable extension policy that must run in
  content scripts or other size-sensitive extension contexts.
- Expose that policy through `extension-wasm`.
- TypeScript may observe browser state.
- TypeScript must pass those observations to Rust when the resulting decision
  is portable.
- TypeScript then performs the browser action selected by the typed Rust
  result.
- Do not keep a TypeScript `some`, `find`, condition chain, validator, or switch
  when it decides a domain or workflow outcome from browser observations.
- Keep `web-app` focused on Svelte rendering, form state, component props,
  labels, DOM events, timers, Vite/browser environment flags, and calling typed
  wasm APIs. The closer behavior is to browser lifecycle glue (`document`
  listeners, `setTimeout`, viewport/URL state), the more strongly it belongs in
  TypeScript/Svelte rather than Rust/WASM.
- Never clone or unwrap reactive data with
  `JSON.parse(JSON.stringify(value))`.
- In `.svelte` and `.svelte.ts` modules, pass `$state.snapshot(value)` directly
  at the API boundary.
- Keep replace-only DTO state in `$state.raw` so ordinary `.ts` domain and
  adapter modules receive plain values.
- Do not rename a utility, domain, or action module to `.svelte.ts` merely to
  access `$state.snapshot`. Move the snapshot to the rune-owning caller instead.
- Do not introduce `plain*` or `toPlain` serialization helpers.
- Use the `.svelte.ts` suffix only when the module genuinely owns Svelte
  reactivity such as `$state`, `$derived`, or `$effect`. The suffix opts the
  module into Svelte compiler transformation. It is not a general marker for
  code called by Svelte components.
- Keep reactive state and workflow actions as separate APIs. Do not add a
  `VaultState` method whose complete implementation is
  `return someActions.operation(this, ...args)`.
- Components and peer action modules should import and call the action directly.
- Retain a state method only when it owns a real boundary such as
  `$state.snapshot`, enforces an invariant, adapts arguments/results, or
  composes multiple operations.
- Consume generated WASM types and functions directly. Preserve a friendly web
  module API with direct type-only import/export aliases when useful, but do not add local
  `type Foo = GeneratedFoo` declarations or exported functions whose only statement
  forwards the same parameters to a WASM import. Keep a wrapper only when it
  performs a real boundary task such as constructing/freeing WASM values,
  applying UI defaults, or translating browser state. Removing a Svelte proxy
  alone is not a wrapper responsibility; snapshot directly at the call site.
- **Generated ABI construction**
  - **Required actions**
    - When a generated ABI parameter is a `#[wasm_bindgen]` class, construct the
      real generated class.
    - When `Tsify` with `from_wasm_abi` defines a generated structural DTO
      parameter, construct its generated structural object directly.
    - Export a canonical fieldless core enum directly when `wasm_bindgen`
      supports it.
  - **Prohibited actions**
    - Do not pass a structurally similar plain object in place of a declared
      `#[wasm_bindgen]` class.
    - Do not wrap a generated structural DTO in an unnecessary WASM class.
    - Do not mirror a canonical core enum in the bridge or translate its
      variants manually.
- Preserve semantic Rust identifier names in generated WASM declarations.
  Use `StoreId`, `PasswordEntryId`, and other available generated declarations
  instead of spelling their primitive representation directly.
- Treat a generated identifier as nominally safe only when its declaration is
  actually branded, opaque, or class-backed. A generated alias of plain
  `string` preserves contract naming and searchability, but it does not prevent
  identifiers from being interchanged.
- Use a generated nominal identifier in Svelte state and function signatures.
  Keep absence separate in an explicitly initialized, enum-backed
  discriminated union containing the nominal identifier.
- Treat TypeScript string-literal unions that describe authentication, vault
  unlock, recovery, provider, or session workflows as missing Rust
  enums. Export the canonical `domain-core` enum through WASM and compare its
  generated variants in Svelte. Before adding an enum, inspect every read: if
  the state is write-only or a WASM getter always returns one constant, delete
  the abandoned state/getter instead. Use TypeScript enum-backed unions for visual state
  such as the open panel, tab, accordion, or form view.
- Do not copy a generated WASM DTO into an equivalent TypeScript "summary"
  merely to free the wrapper immediately. Let the owning Svelte state retain the
  generated objects, free the previous objects when replacing or resetting that
  state, and pass the generated types directly through component props. A plain
  view model is justified only when it is materially different and UI-only; do
  not add duplicate fields such as `payload` plus `sharePayload`.
- Workflow commands such as application workflow start arguments and safe recovery
  projections are Rust DTOs. Components may construct and render their generated
  TypeScript shapes, but `web-app` must not redeclare them.

```ts
// Preferred: ownership stays visible and no runtime wrapper is emitted.
export type { StorageProviderContract as StorageProvider } from "$app-wasm";
export {
  provider_replication_capability,
  provider_supports_replication,
} from "$app-wasm";
```

## Scope

Applies to authored Rust domain crates, typed WASM bridges, and TypeScript or
Svelte consumers, including browser extensions and size-sensitive contexts.

Component-local UI state, layout, form-only drafts, labels, and browser-only
URL/DOM helpers remain in TypeScript. Browser lifecycle glue stays in the web
layer; durable storage/provider adapters belong in the WASM bridge when Rust
has a stable abstraction for the API. Calling a browser API does not make the
portable decision based on its result browser-owned.

### Model sum types with state-owned payloads, wrap them for wasm

When a WASM export needs many parameters, model the state as a core enum
with state-owned payloads. Keep unit and scalar variants when they are the
truthful domain or persisted shape. Use a thin generated object only when the
core enum cannot cross the boundary directly.

Rules:

#### Required actions

- A variant with independently named fields carries its own struct
  (`Github(GithubSyncProvider)`). Each state holds only the fields it owns.
- Keep unit and scalar variants when they are the truthful domain and wire
  shape.
- Use a separate absence or draft variant, such as `Empty`, for incomplete
  configuration.
- Export a fieldless canonical core enum through `wasm_bindgen` directly.
- Wrap a data-carrying core enum in one generated WASM object when required.
- Return a canonical domain state or a typed variant payload when JavaScript
  must inspect an output.
- Keep independent dimensions as separate enums.
- Use a nested enum only when one category refines another category.
- Keep serialization/validation in `domain-core`; the wrapper only bridges to JS.
- When the declared ABI input is a `#[wasm_bindgen]` class, construct that
  generated class in JavaScript.
- When `Tsify` with `from_wasm_abi` declares a structural DTO input, construct
  the generated structural object with its exact fields.

#### Prohibited actions

- Do not change a persisted enum payload shape merely to make every variant
  structurally uniform.
- Do not use cross-variant field soup or `oauth_config_present`-style booleans
  to stand in for a variant.
- Do not put optional fields for required configuration on a configured
  variant.
- Do not mirror the enum in another bridge enum.
- Do not expose `is_*` predicates that only decode its variant.
- Do not replace a declared `#[wasm_bindgen]` class input with a plain object or
  raw discriminant.

### `Option<T>` is almost always a missing enum

Treat every `Option<String>` (and `Option<T>` more broadly) as a **strong signal
that the type is really a two-state enum whose states are not yet named**. An
`Option` says "present or absent" but says nothing about _what each state means_;
an enum makes the states, their names, and their payloads explicit — which is
more descriptive in almost every case.

The canonical smell:

```rust
// Anti-pattern: what does `None` mean? empty? not-yet-loaded? cleared?
struct PlainText {
    text: Option<String>,
}
```

Prefer a named enum whose variants describe the actual states:

```rust
// Named states: `Empty` and `Text(String)` are self-documenting.
enum PlainText {
    Empty,
    Text(String),
}
```

Why the enum wins almost always:

- **Named states beat `Some`/`None`.** `Empty` vs `Text(...)` documents intent;
  `None` forces every reader to reconstruct what absence means here.
- **No ambiguous absence.** `Option<String>` collapses distinct real states
  (never set, explicitly cleared, empty string, not-yet-fetched) into one `None`.
  An enum can distinguish them (`NotLoaded`, `Cleared`, `Text(String)`, …).
- **Exhaustive matching.** Adding a state forces every `match` to be revisited;
  an `Option` silently keeps compiling and quietly loses meaning.
- **No invalid states.** Multiple sibling `Option` fields encode a combinatorial
  soup of impossible combinations. An enum with state-owned payloads makes only
  the legal combinations representable.

Apply this at the design layer that owns the data, usually `domain-core`.
Let `wasm-bridge` expose the canonical enum or a generated object that owns it.

When `Option<T>` is still acceptable (do not force an enum):

- Standard-library / trait signatures that must return `Option` (`get`, `find`,
  `FromStr`-adjacent helpers), internal parsers, and caches. A `Tsify` field or
  `wasm_bindgen` parameter/return must not contain `Option<T>` because generated
  TypeScript represents it as unnamed absence; convert it to a named Rust enum
  first.
- If absence is an error, use a typed `thiserror` variant and `Result<T, E>`;
  do not create an enum variant that merely renames failure.
- When two or more `Option` fields co-vary (present/absent together), that is the
  clearest case that they should collapse into one enum variant carrying a struct
  — see the `GithubSyncProvider` state-owned payload pattern above.

## Application Checklist

- [ ] Search the requested scope for exported TypeScript types/enums and ask
      whether each is app/domain data or only UI presentation state.
- [ ] Search extension TypeScript for portable decisions expressed through
      `some`, `find`, `filter`, condition chains, validators, and switches.
- [ ] Separate browser observation from portable classification.
- [ ] Keep the browser observation in TypeScript and move the classification to
      companion Rust.
- [ ] Move app/domain schemas and validation into `domain-core` where they are
      portable and testable.
- [ ] Route JS access through typed `wasm-bridge` exports instead of plain TS
      schema mirrors.
- [ ] Use an actual Rust/WASM ABI type for domain DTOs. Do not return or accept
      raw `JsValue` and paint a TypeScript type over it with
      `unchecked_return_type` / `unchecked_param_type`; derive the declaration
      and conversion from the Rust type (for example with `Tsify`).
- [ ] Re-export generated WASM bindings directly. Remove callable casing aliases
      and same-argument forwarding functions that add no lifecycle or
      translation behavior. Preserve sanctioned type-only facade re-exports.
- [ ] Search Svelte state and function parameters for domain identifiers typed
      as `string`. Use the exact generated contract declaration. Claim nominal
      safety only when that declaration is branded, opaque, or class-backed.
- [ ] Search `$state<"...">` and exported TypeScript unions for domain
      workflows; delete write-only or constant state, otherwise move the closed
      set to a Rust/WASM enum.
- [ ] When Svelte retains generated WASM objects, identify one owner and free
      every replaced or reset object exactly once; do not create equivalent
      TypeScript summaries solely to simplify ownership.
- [ ] Treat long wasm functions with many optional parameters (or a flattened
      stringly-typed struct) as a design smell. Model the state as a `domain-core`
      enum with state-owned payloads and expose a generated object that owns the
      core value.
- [ ] Export canonical fieldless core enums directly instead of mirroring them
      in the WASM bridge.
- [ ] Remove `is_*` methods that only decode enum variants.
- [ ] Return domain states or typed payload objects from semantic APIs.
- [ ] Preserve generated Rust names instead of rebuilding case-renamed plain
      objects in TypeScript.
- [ ] Treat every `Option<String>` / `Option<T>` in an owned domain type as a
      missing enum. Ask what each state means and replace it with a named enum
      (e.g. `Empty` / `Text(String)`) unless it is a genuine two-state boundary
      DTO or trait/stdlib signature where `Some`/`None` already says everything.
- [ ] Leave UI-only state in TypeScript/Svelte and avoid unrelated cleanup.
- [ ] Add or update Rust tests for moved schema, serialization, and validation.
- [ ] Add Rust tests for every moved extension observation-to-decision rule.

## Validation

Author and run focused Rust domain tests and typed bridge tests when the WASM
contract changes. Browser E2E does not replace domain proof.

Check for TypeScript domain mirrors, local aliases of generated types,
same-argument WASM forwarding functions, unchecked WASM type hints, and raw
provider/auth `JsValue` DTO signatures. Reject portable decision patterns in
TypeScript after their Rust replacement lands. Verify generated bindings and
all changed consumers together.

## Contract ownership

- Reuse generated Rust contracts rather than copying their fields into TypeScript.
- Rust owns portable product, security, persistence, and wire vocabulary.
- TypeScript owns browser, host, lifecycle, and presentation vocabulary.
