# WASM Contracts

Expose canonical Rust types through generated bindings. The generated ABI decides
whether a caller supplies a structural DTO or an actual WASM object.

Examples use a hypothetical `@project/wasm` package. `Order` and `OrderId` are
nominal generated classes; `OrderRequest` is a generated structural DTO containing
an `order_id`. The fragments belong inside their owning methods or UI handlers.

## Construct what the ABI declares

Use a generated instance for a `#[wasm_bindgen]` class parameter. Use an object
with the generated fields for a Tsify `Ts<T>` structural parameter.
Do not convert either representation into the other to make the call compile.

These APIs borrow `order`; `order` and `order_id` are existing generated values.

**Prohibited:** fake a class or cast a DTO into a class.

```ts
api.inspect_order({ order_id } as Order);
const request = { order_id } as Order;
```

**Preferred:** pass the actual class and construct the structural request.

```ts
api.inspect_order(order);
const request: OrderRequest = { order_id };
api.submit(request);
```

When a new instance is needed, obtain it through the generated construction API;
an assertion cannot create a WASM allocation.

## Export canonical enums without mirrors

Export a supported fieldless core enum directly. For data-carrying enums, use
the generated structural ABI or a thin WASM object when required. Keep the core
payload shape and validation; the bridge only exposes it.

**Prohibited:** a second bridge enum needs a manual mapping for every core change.

```rust
// domain-core
pub enum DeliveryMode {
    Download,
    Shipment,
}

// wasm-bridge: duplicate vocabulary
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub enum WebDeliveryMode {
    Download,
    Shipment,
}
```

**Preferred:** export the core declaration itself.

```rust
// domain-core
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub enum DeliveryMode {
    Download,
    Shipment,
}

// wasm-bridge
pub use domain_core::DeliveryMode;
```

## Verify generated identifier types

A generated `type OrderId = string` names a contract but does not prevent mixing
identifiers. Fix the Rust/binding representation when nominal safety is required;
do not add a parallel TypeScript model or fabricate a brand with an assertion.

**Prohibited:** claim that these generated aliases prevent identifier swaps.

```ts
type OrderId = string;
type CustomerId = string;

// Inside a consumer with customer_id: CustomerId:
const order_id: OrderId = customer_id; // Still compiles.
```

**Preferred:** consume generated nominal types. Here they are WASM classes
with distinct private identity, so assigning CustomerId to OrderId fails.

```ts
import type { OrderId, CustomerId } from "@project/wasm";

// Inside a consumer with an existing id: OrderId:
const order_id: OrderId = id;
```

## Give retained objects one owner

Keep generated objects in UI state instead of copying equivalent TS summaries
just to release them early. Pass the same types through component props. A
separate view model must represent a genuinely different, UI-only concern.

For a borrowed-call ABI, the owner frees an object exactly once after its final
use, including replacement or reset. Do not free a borrowed object. A consuming
Rust call transfers ownership: the JS caller must not use or free it afterward.

These alternatives belong in a `SelectedOrder` owner. Its `order` field is an
owned `Order`; `next` transfers ownership to this owner, is distinct from the
current object, and no borrower retains the previous object.

- **Prohibited:** overwrite the only owner without releasing the prior allocation.

```ts
replace(next: Order): void {
  this.order = next;
}
```

- **Preferred:** release the previous object before adopting the replacement.

```ts
replace(next: Order): void {
  this.order.free();
  this.order = next;
}
```

Apply the same ownership contract at teardown. Do not add a second cleanup path
that frees an already released or transferred object.

## Validation

- Inspect generated declarations to verify structural versus class parameters.
- Test calls using actual generated classes and generated DTO shapes.
- Verify identifier incompatibility with a compile-failure case.
- Test replacement, reset, and ownership transfer for leaks and double frees.
- Build WASM and type-check all affected consumers together.
