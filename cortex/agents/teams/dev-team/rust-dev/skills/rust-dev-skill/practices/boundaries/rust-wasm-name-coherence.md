# Rust WASM Name Coherence

For contracts the project controls, keep Rust names unchanged in generated
bindings and TypeScript: `order_id` stays `order_id`. Do not rename for JavaScript
casing conventions. Each alias forces humans and AI agents to translate names
instead of following one contract.

Fixed external protocols are the narrow exception: preserve Rust conventions
inside the application and map the required wire names only in the external
adapter. This exception does not apply to the project's own Rust/WASM/TS API.

The examples below are alternative fragments. They assume generated types and
existing domain values; method fragments belong inside their owning `impl`.

## Preserve imported and exported names

Do not introduce import aliases, re-export aliases, or local type aliases.

**Prohibited:**

```ts
import type { OrderSummary as OrderView } from "@project/wasm";
export type { OrderSummary as OrderView } from "@project/wasm";
```

```ts
import type { OrderSummary } from "@project/wasm";
type OrderView = OrderSummary;
```

**Preferred:**

```ts
import type { OrderSummary } from "@project/wasm";
export type { OrderSummary } from "@project/wasm";
```

## Preserve method and property names

Do not use `js_name` to change a Rust name for JavaScript consumers. Getters and
setters preserve the same field name too. Here `OrderId` is a WASM-exported type.

**Prohibited:**

```rust
#[wasm_bindgen(getter, js_name = orderId)]
pub fn order_id(&self) -> OrderId {
    self.order_id.clone()
}
```

```ts
const order_id = order.orderId;
```

**Preferred:**

```rust
#[wasm_bindgen(getter)]
pub fn order_id(&self) -> OrderId {
    self.order_id.clone()
}
```

```ts
const order_id = order.order_id;
```

## Preserve fields and enum variants

Do not use serialization renames or casing transformations in project-owned contracts. These Serde
fragments describe a new contract; `OrderId` is an existing serializable newtype.

**Prohibited:**

```rust
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderSummary {
    pub order_id: OrderId,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryState {
    AwaitingDispatch,
    Delivered,
}
```

**Preferred:**

```rust
#[derive(serde::Serialize, serde::Deserialize)]
pub struct OrderSummary {
    pub order_id: OrderId,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub enum DeliveryState {
    AwaitingDispatch,
    Delivered,
}
```

Keep those names in consumers. These expressions belong inside a UI method.

**Prohibited:**

```ts
const { order_id: orderId } = order;
const view = { orderId: order.order_id };
```

**Preferred:**

```ts
const { order_id } = order;
// Pass the original typed object onward.
view.render(order);
```

## Map fixed external names only at the adapter

If a third-party protocol requires `orderId`, keeping both that wire key and
Rust's `snake_case` requires a mapping. Use `order_id` in Rust and
`#[serde(rename = "orderId")]` on the external adapter field. Do not disable
Rust's naming lint or spread `orderId` into the domain and generated application API.

These examples assume a fixed third-party wire contract. They do not authorize
renaming fields in a new contract the project controls.

**Prohibited:** change Rust naming to match the external protocol.

```rust
#[allow(non_snake_case)]
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ExternalOrder {
    pub orderId: OrderId,
}
```

**Preferred:** isolate the unavoidable mapping in the external adapter.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ExternalOrder {
    #[serde(rename = "orderId")]
    pub order_id: OrderId,
}
```

Removing this rename would change the wire key and break the protocol. Existing
persisted or published contracts also require their migration policy before wire
names change; compatibility mappings stay at that boundary, not in new domain APIs.

## Validation

- Inspect import/export aliases, local type aliases, `js_name`, `rename`, and
  `rename_all`. Reject project-owned naming transformations. For each boundary
  mapping, identify the fixed protocol or established schema that requires it.
- Regenerate bindings and check exported names against the Rust declarations.
- Type-check consumers and test any preserved wire names or approved migrations.
