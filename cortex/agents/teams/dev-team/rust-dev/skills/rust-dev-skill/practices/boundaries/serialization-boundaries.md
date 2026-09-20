# Rust Serialization and ABI Boundaries

Decode external representations into concrete domain values at the boundary. Keep internal APIs typed and preserve externally owned wire contracts.

## Required actions

- Convert ABI values before calling domain or application methods.

- Keep raw YAML or JSON strings at I/O boundaries. Parse them into typed Rust
  records immediately after deserialization, and serialize typed records back to
  wire strings when crossing storage, provider, or JS boundaries.
- Deserialize known JSON schemas directly into concrete serde structs or enums.
- Return the decoded record from internal APIs instead of its JSON string.
- Keep `JsValue` conversion at an externally required WASM or browser ABI.
- Tests of a known JSON contract serialize and deserialize through the concrete
  Rust wire or domain type, then assert typed fields and enum variants.
- Raw `serde_json::Value` is reserved for tests whose actual subject is unknown,
  malformed, or deliberately partial JSON. A narrow `Value::Object`/`.get()`
  assertion may verify that a serializer omitted or renamed a property. Domain
  values still require a typed round trip.
- Use typed fields such as `event: VaultEvent` internally and across merge or
  sync APIs. Add explicit parse or serialize helpers for a narrow browser file
  or provider boundary that reads or writes YAML text.
- Secret material that stays in Rust uses validated secret newtypes. A session
  cache that must hold a string for WASM compatibility converts from the typed
  value at the narrowest boundary and zeroizes it on reset or drop.
- Convert loose persisted/browser JSON into typed Rust states at the boundary.
- Reuse canonical types across `domain-core` and `wasm-bridge`.
- Make WASM wrappers delegate to core types when possible.
- Keep stateful WASM manager objects composed from cohesive private state
  structs.
- Model stateful WASM concepts as real `#[wasm_bindgen]` structs with
  constructors and methods. JavaScript/Svelte should create the struct instance
  directly, keep that instance in app state or storage, and call methods on it.
- Expose a WASM object when Rust owns the state.
- Store or pass the WASM object explicitly from Svelte state when TypeScript
  owns the browser lifecycle.
- Normalize domain absence into a named state before a `Tsify`-derived field or
  `wasm_bindgen` parameter crosses the exported boundary.
- Use TypeScript `void`, equivalent to Rust `()`, for unit or effect returns.

## Prohibited actions

- Do not use `void` as a serialized field-state escape hatch.

- Do not add a handwritten absence override to a truthful structural `Option<T>`
  in an external or persisted wire format.

- Do not pair `Option<T>` with a `#[tsify(type = "... | undefined")]` override.

- Do not flatten provider credentials, vault sessions, device identity,
  event-log state, status channels, and outbox state into sibling fields on one
  exported manager.

- Do not keep raw YAML or JSON strings past an I/O boundary.
- Do not index `serde_json::Value` or use `Value::is_null()` for known-contract
  field-value assertions.
- Do not use `dyn Any`, `Box<dyn Any>`, raw JSON trees, generic string-keyed
  maps, or equivalent erased value bags as domain or application values.
- Do not expose a WASM DTO field named `yaml` when an event or vault payload has
  a typed domain representation.
- Do not store secret material that remains in Rust as raw `String`.
- Do not duplicate equivalent DTOs across `domain-core` and `wasm-bridge`.
- Do not create mutable global configuration with `OnceCell`, `thread_local`, or
  static setters for per-app runtime state.
- Do not add a TypeScript wrapper whose only purpose is to simulate state around
  a WASM object.
- Do not author `undefined`, `null`, or `void` field states in Rust-owned
  `Tsify` or WASM domain contracts.
- Do not expose `Option<T>` through a `Tsify`-derived field or `wasm_bindgen`
  parameter or return.

## Examples

These snippets use Serde and assume the surrounding operation returns
`serde_json::Result<_>`. The wire quantity is raw only at this decoding edge.
The caller must validate it into a domain quantity before applying domain policy.

**Prohibited:** a known schema is decoded into an untyped tree, then field
selection and unchecked extraction replace a concrete contract.

```rust
let value: serde_json::Value = serde_json::from_str(input)?;
let quantity = value["quantity"].as_u64().unwrap();
```

**Preferred:** a concrete wire record rejects absent or wrongly typed required
fields during decoding. It remains a boundary record, not a trusted capability.

```rust
use serde::Deserialize;

#[derive(Deserialize)]
struct QuantityWire {
    quantity: u16,
}

let wire: QuantityWire = serde_json::from_str(input)?;
```

## Validation

- Search Rust-owned `Tsify` DTOs for authored `type =` overrides. The
  repository preflight must report zero `undefined`, `null`, or `void`
  sentinels in those overrides.
- Search known-contract tests for `serde_json::Value`, `json["..."]`, and
  `.is_null()`. Replace field-value checks with typed round trips and enum/value
  assertions. Keep raw values only where malformed/unknown JSON or exact
  property presence is the behavior under test.
- Inventory `dyn Any`, raw JSON trees, and generic string-keyed value maps in
  changed domain and application code. Keep only narrow decoding boundaries.
- When exposed to web, regenerate wasm bindings and run the web type check.
