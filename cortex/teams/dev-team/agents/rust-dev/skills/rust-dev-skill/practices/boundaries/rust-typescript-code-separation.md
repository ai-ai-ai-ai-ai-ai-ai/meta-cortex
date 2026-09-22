# Rust–TypeScript Code Separation

In projects using Rust/WASM, Rust owns portable product data and decisions.
TypeScript owns presentation and browser lifecycle. These cross-language rules
do not require introducing Rust into a TypeScript-only project. A browser API
supplies observations; it does not own the product decision made from them.

## Application structure

Imagine three packages:

- `domain-core`: Rust types, schemas, validation, and product rules.
- `wasm-bridge`: generated exports, JS conversion, and browser storage/provider adapters.
- `web-app`: TypeScript components, DOM events, timers, and visual state.

A browser extension uses the same boundaries: `extension-core` owns portable
policy and `extension-wasm` exposes it to content scripts. Package names here
are illustrative; use the project's names.

**Prohibited:** the web app validates bookings independently of Rust, so the
same booking can be accepted in one host and rejected in another.

**Preferred:** Rust validates the booking, the bridge exposes its typed result,
and the web app renders that result. Test the decision in Rust and its transport
through the bridge separately.

## Define product contracts in Rust

Workflow stages, commands, outcomes, persistence schemas, and validation belong
in Rust. Components construct and render their generated types without copying
them. Remove abandoned write-only or constant state instead of exporting it.

Core types may carry binding/serialization annotations, but those annotations
must not bring browser I/O, session state, or WASM-specific behavior into core.

**Prohibited:** TypeScript invents a second definition of a product workflow.

```ts
export enum BookingStage {
  Draft,
  Confirmed,
}
```

**Preferred:** define the fieldless enum once in Rust and consume its export.

```rust
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub enum BookingStage {
    Draft,
    Confirmed,
}
```

```ts
import { BookingStage } from "@project/wasm";
```

## Separate observation from policy

TypeScript gathers browser observations and performs browser actions. Rust
classifies observations into portable decisions. Move domain `some`, `find`,
validators, and condition chains into the Rust owner, not merely another TS file.

These handler fragments assume generated `PageObservation`, `PageKind`, and
`PageAction` contracts and an existing WASM `policy` object.

**Prohibited:** the browser handler owns product policy.

```ts
const observation = browser.observe();
const action = observation.page_kind === PageKind.Checkout
  ? PageAction.OfferAssistance
  : PageAction.Ignore;
browser.apply(action);
```

**Preferred:** the handler delegates the decision to Rust.

```ts
const observation = browser.observe();
const action = policy.classify(observation);
browser.apply(action);
```

Keep durable storage/provider I/O in bridge adapters when Rust has a stable
abstraction for it. Use established browser crates; isolate unavoidable direct
Web API calls from portable policy.

## Keep visual state in TypeScript

Open panels, tabs, form-only drafts, labels, component props, URL/viewport state,
and DOM lifecycle belong to the UI. A purely visual state does not need Rust.

**Prohibited:** a component-only panel choice expands the Rust API.

```rust
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub enum OpenPanel {
    Summary,
    Help,
}
```

**Preferred:** the component's TypeScript module owns that choice.

```ts
enum OpenPanel {
  Summary,
  Help,
}
```

## Validation

- Review each authored TS domain declaration for a canonical Rust owner.
- Test portable decisions in Rust; browser E2E does not replace those tests.
- Regenerate bindings and type-check consumers after moving a contract.
- Verify that browser observation and visual state remain in the UI.
