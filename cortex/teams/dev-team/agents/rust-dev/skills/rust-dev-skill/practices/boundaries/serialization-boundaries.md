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

## Construct known documents from typed values

**Prohibit building YAML from strings.** This includes complete string literals,
raw/multiline literals, YAML fragments, `format!`, concatenation, indentation
helpers, replacement, and wrappers such as `ExampleOperationYaml::from("...")`.
Static content and discovery examples are not exceptions.

Build authored JSON/YAML requests, configuration, catalog examples, and valid
test fixtures from their concrete structs and enums. Serialize once at the I/O
edge. Do not assemble documents through interpolation, concatenation, templates,
indentation helpers, or string replacement. Parsing the assembled string back
into a typed value is too late; wrapping it in a newtype is not schema safety.

These alternative fragments use `DeliverySettings` above and assume
`serde_saphyr` with its `serialize` and `deserialize` features. They belong in a
fallible output adapter. Both compile; only the second models the document before
encoding it.

**Prohibited:** maintain the schema and enum spelling in a literal or template.

```rust
let literal = "delivery_mode: Shipment\n";
let _settings: DeliverySettings = serde_saphyr::from_str(literal)?;
let mode = "Shipment";
let yaml = format!("delivery_mode: {mode}\n");
let settings: DeliverySettings = serde_saphyr::from_str(&yaml)?;
let output = serde_saphyr::to_string(&settings)?;
```

**Preferred:** the compiler checks fields and alternatives; Serde owns escaping.

```rust
let settings = DeliverySettings {
    delivery_mode: DeliveryMode::Shipment,
};
let output = serde_saphyr::to_string(&settings)?;
```

External input and deliberately malformed/unknown test documents remain raw
at the decoding boundary. Open extension payloads may use dynamic values only
where the contract explicitly permits arbitrary content; they do not make the
surrounding known schema dynamic. Keep valid fixtures typed, including variants
created for conflict, stale revision, or invalid transition tests. Hand-authored
`.yaml` documents and YAML shown in documentation are not programmatic builders.
Raw-input exceptions do not permit constructing valid requests from strings.

## Derive serialization instead of writing boilerplate

- Derive `Serialize` and `Deserialize` for authored data types.
- Use Serde attributes for supported wire representations.
- Use `transparent` for scalar newtypes.
- Use `from`, `try_from`, and `into` for wire conversions.
- Classify primitive wrapper input through [explicit parse states](../modeling/domain-types.md#classify-primitive-wrapper-input-with-explicit-states).
- For a constrained scalar wire format, derive `Deserialize` for the parse enum
  with `#[serde(from = "String")]`; derive it for the validated value with
  `#[serde(try_from = "TaskIdParse")]`. The enum-to-value `TryFrom` adapter only
  maps existing variants to Serde's required `Result`; it does not parse raw input.
- Never call that adapter from application code or add a general `into_result`
  method. Test both classification variants and actual deserialization rejection.
- Keep semantic variant mappings in concrete conversion implementations.
- Do not handwrite `Serialize`, `Deserialize`, visitors, or serialization callbacks when derives and attributes express the contract.
- Do not move the same boilerplate into `serialize_with`, `deserialize_with`, or a helper module.
- Do not justify a handwritten serializer merely because the wire type differs from the domain type.
- For an unsupported contract, document the specific derive limitation and evaluate an established adapter before adding custom machinery.
- Review these requirements explicitly; the standard Clippy baseline does not enforce them.

**Prohibited:** implement a generic serializer only to forward a mapped primitive.

```rust
impl serde::Serialize for ApplicationMode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_bool(matches!(self, Self::Always))
    }
}
```

**Preferred:** preserve enum alternatives in contracts the project controls.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
pub enum ApplicationMode {
    Always,
    Conditional,
}
```

- Return enums from application APIs and preserve them in new serialized contracts.
- Prohibit `#[serde(into = "bool")]` and enum-to-boolean conversions by default.
- Apply only the external-interface and backward-compatibility exceptions defined in [domain states](../modeling/domain-states.md#convert-external-records-into-owned-types).
- A supported Serde attribute does not justify changing an enum into a boolean.
- Verify the exact wire representation and all mapping branches for an allowed conversion.
- Follow [Serde's conversion attribute requirements](https://serde.rs/container-attrs.html) when an exception applies.

### Adapt classified states to Serde's required result

These alternative additions use the `TaskId`, `TaskIdParse`, and
`IdentifierParseError` definitions from the explicit-state rule. Add
`#[derive(serde::Deserialize)]` and `#[serde(from = "String")]` to `TaskIdParse`.

**Prohibited:** bypass classification or restore primitive validation in Serde.

```rust
#[derive(serde::Deserialize)]
#[serde(try_from = "String")]
pub struct TaskId(String); // Would require the prohibited TryFrom<String>.
```

**Preferred:** Serde owns failure transport; the domain enum owns classification.
This replaces the earlier `TaskId` declaration and adds its boundary adapter.

```rust
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(try_from = "TaskIdParse")]
pub struct TaskId(String);

impl TryFrom<TaskIdParse> for TaskId {
    type Error = IdentifierParseError;
    fn try_from(parsed: TaskIdParse) -> Result<Self, Self::Error> {
        match parsed {
            TaskIdParse::Parsed(task) => Ok(task),
            TaskIdParse::Invalid(error) => Err(error),
        }
    }
}
```

The serialized scalar stays a string; internal parse states are not additional
wire values. If generating schemas, describe the actual scalar with the schema
library's wire-type attribute and test it. Do not publish internal parse variants
as the request schema or silently change the wire shape.

## Keep encoding out of application state

For structured strings beyond JSON/YAML, apply
[domain string normalization](../modeling/domain-types.md#normalize-structured-strings-into-domain-components).
An established string wire field can render a normalized model at the adapter;
its internal representation must still retain the typed components.

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
Use raw JSON/YAML only when testing malformed/unknown input or exact property presence;
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
- Inspect authored document construction, including catalogs and fixtures, for
  string assembly hidden behind wrappers or subsequent deserialization.
- Inspect ABI overrides and dependency conversions for hidden untyped contracts.
- Run typed round-trip and invalid-input tests; regenerate and type-check bindings
  when the exported contract changes.
