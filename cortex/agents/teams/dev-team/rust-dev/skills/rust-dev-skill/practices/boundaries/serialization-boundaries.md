# Rust Serialization Boundaries

Decode at the external edge. Pass typed values through the application; encode
again only when an external API requires it.

## Decode known schemas into their types

Do not use JSON trees, `dyn Any`, erased objects, or generic value maps as domain
records. Raw JSON/YAML text belongs at I/O, not in application fields or returns.

The following fragments belong inside a decoding method returning
`serde_json::Result<DeliverySettings>`.

**Prohibited:** a known schema becomes an untyped tree and string lookup.

```rust
let value: serde_json::Value = serde_json::from_str(input)?;
let mode = value["delivery_mode"].as_str().unwrap();
```

**Preferred:** Serde checks the record and its named alternatives directly.

```rust
#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum DeliveryMode {
    Download,
    Shipment,
}

#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct DeliverySettings {
    pub delivery_mode: DeliveryMode,
}

// Inside the decoding method:
let settings: DeliverySettings = serde_json::from_str(input)?;
Ok(settings)
```

Deserialization must also preserve domain validation. Deriving `Deserialize`
for a constrained newtype must not bypass its validating construction.

## Keep encoding out of application state

Return and store the decoded value. Do not carry JSON or YAML through the
application only to parse it again in the next layer.

These alternatives use the `DeliverySettings` above.

**Prohibited:** every consumer must recover the record's meaning.

```rust
pub struct DeliverySession {
    pub settings_json: String,
}
```

**Preferred:** the session owns the typed value; encoding happens at storage.

```rust
pub struct DeliverySession {
    pub settings: DeliverySettings,
}

// Inside a storage adapter returning serde_json::Result<String>:
let encoded = serde_json::to_string(&session.settings)?;
Ok(encoded)
```

## Generate typed JavaScript contracts

Prohibit `JsValue` and `js_sys::Object` in authored fields, signatures, aliases,
and stored state, including tests. They erase meaning and force readers to infer
contracts from casts and runtime inspection. A wrapper or handwritten TypeScript
annotation does not restore that contract.

**Prohibited:** a domain-looking field accepts any JavaScript value.

```rust
pub struct DeliverySettings {
    pub delivery_mode: wasm_bindgen::JsValue,
}
```

**Preferred:** generate the ABI from the canonical typed record. These are the
WASM-enabled forms of the earlier declarations, not additional domain copies.
This example uses Tsify 0.5.8 with its `js` feature.

```rust
#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
pub enum DeliveryMode {
    Download,
    Shipment,
}

#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
pub struct DeliverySettings {
    pub delivery_mode: DeliveryMode,
}
```

Use `tsify::Ts<DeliverySettings>` for the generated structural ABI, then decode
inside the operation with `to_rust()?`. Do not use the deprecated ABI attributes;
[Tsify documents their failure-path leaks](https://docs.rs/tsify/0.5.8/tsify/#why-are-the-wasm_abi-attributes-deprecated).

```rust
// Inside the owning adapter impl:
pub fn decode(
    &self,
    input: tsify::Ts<DeliverySettings>,
) -> Result<DeliverySettings, SettingsDecodeError> {
    Ok(input.to_rust()?)
}

#[derive(Debug, thiserror::Error)]
pub enum SettingsDecodeError {
    #[error("invalid delivery settings")]
    Invalid(#[from] tsify::Error),
}
```

Do not override generated fields with `undefined`, `null`, or `void` unions.
Normal TypeScript `void` effect returns remain valid; they do not represent data.

## Convert dependency-owned values immediately

A library may require JavaScript values internally. Decode its result immediately;
do not forward it as an application contract. Serialize only where an external
API requires it, and preserve conversion failures as typed errors.

These adapter fragments assume an external `storage.read()` that returns
`Result<JsValue, StorageError>`. The enclosing method's concrete error enum has
`#[from]` conversions for storage and serialization errors.

**Prohibited:** retain an erased value for application code to interpret later.

```rust
let settings = storage.read()?;
Ok(settings) // Exposes Result<JsValue, ...> to application callers.
```

**Preferred:** return the expected record from the adapter.

```rust
let settings: DeliverySettings =
    serde_wasm_bindgen::from_value(storage.read()?)?;
Ok(settings)
```

## Test the typed contract

For known schemas, round-trip the concrete type and assert its fields or variants.
Use raw JSON only when testing malformed/unknown input or exact property presence;
that inspection does not replace a typed round trip.

These tests use the first `DeliverySettings` definition.

**Prohibited:** inspect raw JSON to verify a known domain value.

```rust
#[test]
fn preserves_delivery_mode() -> serde_json::Result<()> {
    let settings = DeliverySettings { delivery_mode: DeliveryMode::Shipment };
    let value = serde_json::to_value(&settings)?;
    assert_eq!(value["delivery_mode"], "Shipment");
    Ok(())
}
```

**Preferred:** assert the decoded domain value and reject invalid input.

```rust
#[test]
fn preserves_delivery_mode() -> serde_json::Result<()> {
    let settings = DeliverySettings { delivery_mode: DeliveryMode::Shipment };
    let encoded = serde_json::to_string(&settings)?;
    let decoded: DeliverySettings = serde_json::from_str(&encoded)?;
    assert_eq!(decoded, settings);
    Ok(())
}

#[test]
fn rejects_unknown_delivery_mode() {
    let result = serde_json::from_str::<DeliverySettings>(
        r#"{"delivery_mode":"Teleport"}"#,
    );
    assert!(result.is_err());
}
```

## Validation

- Check that application APIs expose typed values, not encoded text or erased bags.
- Inspect ABI overrides and dependency conversions for hidden untyped contracts.
- Run typed round-trip and invalid-input tests; regenerate and type-check bindings
  when the exported contract changes.
