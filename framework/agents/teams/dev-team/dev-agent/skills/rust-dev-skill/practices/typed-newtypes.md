# Typed Newtypes (Domain IDs & Wire Strings)

## Why

A bare primitive does not tell the compiler what the value means. This applies
to identifiers, counts, versions, and wire strings.

`DevicePublicKey`, `DeviceSigningPublicKey`, and `SymmetricKey` are strings on
the wire. They must never be swapped. Newtypes make intent explicit and turn
mix-ups into compile errors.

The vault will carry **multiple schema versions** concurrently (events, envelopes, projection). Version fields should be newtypes (`VaultEventSchemaVersion`, `PasswordEnvelopeVersion`, …) so each struct's supported range is checked at parse time, not ad-hoc `u32` comparisons scattered through the code.

### WASM / JS boundary

Keep identifiers and counts wrapped across the Rust/WASM boundary. Unwrap a
primitive only through an explicit edge getter when JavaScript must consume it.

`wasm-bridge` getters may still return a wire `String` when the external API owns
that representation. Parse it into a newtype inside Rust before calling core.
Do not duplicate validation in TypeScript.

### Legitimately raw representations

- Plaintext user content when the content itself is the value.
- Locale lookup keys used only for locale plumbing.
- Raw JSON used only as an encoding primitive at the boundary.

## Patterns

### Single-field primitive wrapper

Use one wrapper for each domain meaning.

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FieldIndex {
    pub value: u32,
}

impl From<u32> for FieldIndex {
    fn from(value: u32) -> Self {
        Self { value }
    }
}

impl FieldIndex {
    pub const ZERO: Self = Self { value: 0 };
    pub const ONE: Self = Self { value: 1 };
}
```

- Use `From<Primitive>` for an infallible single-field wrapper.
- Use a parser or `TryFrom` when construction validates the value.
- Add associated constants only for common values with stable meaning.
- Keep dynamic values on the normal conversion path.
- Preserve the wrapper through domain and WASM calls.
- Expose the primitive only at an explicit external edge.
- Use `#[serde(transparent)]` only when the owned wire format must remain the
  primitive.
- Keep a named `value` field when the serialized contract must retain the
  wrapper shape.

### Aggregate construction

Construct aggregates with named fields.

```rust
let credential = Credential {
    field_index,
    role,
    editability,
};
```

#### Required actions

- Construct independent aggregate fields with named struct literals.
- Pass a multi-value aggregate as the one non-receiver parameter to authored
  functions and methods. Follow the single-parameter API rule in
  [Rust coding](rust-coding.md).
- Distinguish ordinary data aggregates from validated state capabilities.
- Follow [action ownership and typestate](rust-action-ownership.md) for state
  construction and transitions.
- Reserve `From<T>` for one clear semantic conversion.
- Keep aggregate validation in a named fallible constructor when it enforces an
  invariant.

#### Prohibited actions

- Do not implement `From<(A, B, C)>` for independent aggregate fields.
- Do not add a trivial `new(a, b, c)` that only hides those field names.
- Do not expose state-capability fields merely to permit aggregate literals.

### Serde-transparent string newtype

```rust
#[derive(Serialize, Deserialize)]
#[serde(transparent)]
pub struct StoreId(String);
```

Wire JSON unchanged; Rust API is typed. Validate in `parse()` and in `Deserialize` when invariants matter (`SymmetricKey`, `EventId`, …).

### Version newtype

```rust
pub struct VaultEventSchemaVersion(u32);

impl VaultEventSchemaVersion {
    pub const V1: Self = Self(1);
    pub const CURRENT: Self = Self::V1;
}
```

When a breaking wire shape ships, add `V2`, keep `V1` deserializable, and branch in projection/import — never bump `CURRENT` without a migration path. Future shape:

```rust
enum VersionedVaultEventBody {
    V1(VaultEventBodyV1),
    V2(VaultEventBodyV2),
}
```

### Trusted construction

`from_trusted` / `from_vault_record` for values already validated or emitted by this process. Do not use for external input.

## Domain API enforcement

Use `raw_numeric_public_api` and suppression validation where available.
Review public parameters, returns, fields, generic defaults, bounds, aliases,
external reexports, and inherited methods recursively. Activate migrated scopes
after they satisfy the rule; retain semantic review for all changed APIs.

Boundary exceptions use an item-scoped `expect` with a reason naming the exact
serialization, database, or FFI edge. Crate, module, type, and other blanket
`allow` or expectation attributes are forbidden.

## Remaining type-safety checklist

- [ ] Raw identifier and count primitives are absent from domain and WASM
      signatures unless an external protocol owns the representation.
- [ ] An explicit edge getter may unwrap a primitive for JavaScript.
- [ ] Infallible single-field wrappers implement `From<Primitive>`.
- [ ] Aggregate construction keeps independent field names visible.
- [ ] Associated constants cover only common values with stable meaning.
