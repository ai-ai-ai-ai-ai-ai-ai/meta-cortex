# Rust WASM and Command Name Coherence

For contracts the project controls, keep Rust names unchanged in generated
bindings and TypeScript: `order_id` stays `order_id`. Do not rename for JavaScript
casing conventions. Each alias forces humans and AI agents to translate names
instead of following one contract. Project-owned command identities follow the
same rule through Rust, discovery schemas, YAML/JSON, and consumers.

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

## Preserve command identities

Choose a descriptive Rust variant, then serialize that exact name. Do not invent
dotted aliases, shorten the wire name, or apply a casing transformation merely
for appearance. This applies to command catalogs, request examples, and consumers.
An existing internal alias is not evidence of an external protocol requirement.

These alternative leaf enums assume Serde derive and an existing serializable
`FrameworkInit` argument type. Both compile; the first violates name coherence.
The enclosing `Operation::Framework` owns the command's domain.

**Prohibited:** unrelated code and wire spellings require a translation table.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(tag = "name", content = "arguments")]
pub enum FrameworkOperation {
    #[serde(rename = "framework.init")]
    Initialize(FrameworkInit),
}
```

**Preferred:** the enclosing group and leaf each own their serialized name.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(tag = "name", content = "arguments")]
pub enum FrameworkOperation {
    Initialize(FrameworkInit),
}
```

The preferred command uses `name: Initialize` inside `group: Framework`.
Generate discovery and examples from the enum rather than maintaining a second
command-name registry. Update callers and documentation together. A fixed
external contract may require an adapter; identify that contract explicitly.
Do not introduce legacy aliases for an unpublished command design the user has
asked to replace.

## Group operations by their owning domain

Repeated command prefixes or suffixes identify a domain that belongs in the type
structure. Put its operations in a dedicated enum carried by the enclosing group
variant. Keep that hierarchy in requests, generated schemas, discovery, and
consumers. Apply [ownership hierarchies](../modeling/domain-types.md#preserve-ownership-hierarchies-in-enum-payloads).
Do not pair an independent group enum with an unrestricted operation enum, split
strings to dispatch, or repeat the group in each leaf's name.

These alternative declarations assume Serde derive and existing serializable
`TaskQuery` and `FeatureQuery` argument types. Both compile; only the nested
declaration constrains each group to its own operations.

**Prohibited:** a flat list encodes hierarchy in spelling alone.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(tag = "name", content = "arguments")]
pub enum Operation {
    GetTask(TaskQuery),
    GetTaskHistory(TaskQuery),
    GetFeatureStatus(FeatureQuery),
}
```

**Preferred:** each group carries only its domain's enum.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(tag = "group", content = "command", deny_unknown_fields)]
pub enum Operation {
    Task(TaskOperation),
    Feature(FeatureOperation),
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum TaskOperation {
    Get(TaskQuery),
    History(TaskQuery),
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(tag = "name", content = "arguments", deny_unknown_fields)]
pub enum FeatureOperation {
    Status(FeatureQuery),
}
```

With a typed `query: TaskQuery`, construct
`Operation::Task(TaskOperation::Get(query))` and serialize it at the boundary.
`Operation::Feature(TaskOperation::Get(query))` fails with a type mismatch;
`FeatureOperation` has no `Get` variant. A request with `group: Feature` and
`command: {name: Get, ...}` must fail decoding before execution. Dispatch through
the owning enum, with exhaustive matches and no impossible-domain error arms.
Group discovery entries using those typed variants; do not infer groups from
command strings or maintain a second routing table.

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
- Check repeated command prefixes/suffixes for missing domain groups. Test valid
  operations in every group and reject a known leaf under the wrong group.
- Regenerate bindings and check exported names against the Rust declarations.
- Type-check consumers and test any preserved wire names or approved migrations.
