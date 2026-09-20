# Rust Domain Types

Give each domain value a distinct type. Preserve its meaning through construction, public APIs, and conversions.

## Required actions

- Required persisted or signed values use required validated newtypes.
- Represent typed domain values with existing core newtypes such as
  `IsoTimestamp`, `StoredVaultYaml`, `StoreId`, `EventId`, and `SymmetricKey`.
  Add a newtype when the domain has no existing one.
- Use named domain newtypes in reachable public parameters, returns, and fields.
- Apply the rule recursively through options, results, collections, tuples, generics, aliases, and bounds.
- Keep raw numeric representations private to implementation details or newtype storage.
- Retain raw strings only for locale/i18n plumbing or other explicitly owned boundaries.
- Use a narrow item-scoped `expect` only for a legitimate serialization, database, or FFI boundary, with its reason documented.

## Prohibited actions

- Do not expose raw numeric primitives or domain-bearing strings through public APIs.
- Do not use blanket lint allowances to bypass domain types.

- Do not use raw `String` for typed domain values such as timestamps, YAML
  payloads, provider types, vault or store ids, event ids, or secret keys.

## Construction and representation

A bare primitive does not tell the compiler what the value means. This applies
to identifiers, counts, versions, and wire strings.

`DevicePublicKey`, `DeviceSigningPublicKey`, and `SymmetricKey` are strings on
the wire. They must never be swapped. Newtypes make intent explicit and turn
mix-ups into compile errors.

When a project carries multiple schema versions, give each version its own type.
For example, event and envelope versions have different meanings. Check each
supported range at parsing rather than scattering raw integer comparisons.

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

## Construction patterns

The following fragments illustrate construction and wire shapes. Serde examples
assume its derive imports; aggregate examples assume existing domain types.

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
  functions and methods.
- Distinguish ordinary data aggregates from validated state capabilities.
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

## Standard conversions

Use standard conversion traits when converting one value into another has an
obvious meaning. A one-input signature alone does not make an operation a
conversion.

### Required actions

- Prefer `From<T>` for an infallible, value-preserving conversion from one
  input value.
- Prefer `TryFrom<T>` for the corresponding fallible conversion. Return a
  concrete error that describes the failure.
- Implement `From` or `TryFrom` on the destination type. Use their provided
  `Into` or `TryInto` implementations at suitable call sites.
- Preserve private validated construction inside conversion implementations.
- Keep named methods for context-dependent policy or ambiguous interpretations.
- Keep named operations for external effects or authorization-sensitive
  capability transitions. Preserve their runtime freshness checks.

### Prohibited actions

- Do not convert every unary function into a conversion trait.
- Do not panic or substitute a default to make a fallible conversion fit
  `From<T>`.
- Do not discard meaningful information to claim a value-preserving conversion.
- Do not use a conversion trait to bypass validation or forge an advanced state.

## Domain API enforcement

Use `raw_numeric_public_api` and suppression validation where available.
Review public parameters, returns, fields, generic defaults, bounds, aliases,
external reexports, and inherited methods recursively. Activate migrated scopes
after they satisfy the rule; retain semantic review for all changed APIs.

Boundary exceptions use an item-scoped `expect` with a reason naming the exact
serialization, database, or FFI edge. Crate, module, type, and other blanket
`allow` or expectation attributes are forbidden.

### Type-safety checks

- Raw identifier and count primitives are absent from domain and WASM
      signatures unless an external protocol owns the representation.
- An explicit edge getter may unwrap a primitive for JavaScript.
- Infallible single-field wrappers implement `From<Primitive>`.
- Aggregate construction keeps independent field names visible.
- Associated constants cover only common values with stable meaning.

## Prohibited and preferred domain identifiers

Both snippets are valid Rust. They differ in what mistakes the compiler can detect.

**Prohibited:** both identifiers have the same representation, so an account
identifier can silently occupy an invoice field.

```rust
pub struct Invoice {
    pub id: u64,
    pub account: u64,
}
```

**Preferred:** separate wrappers preserve meaning even though both use `u64`.
Passing an `AccountId` as `Invoice.id` is a type error.

```rust
pub struct InvoiceId(u64);
pub struct AccountId(u64);

impl From<u64> for InvoiceId {
    fn from(value: u64) -> Self { Self(value) }
}

impl From<u64> for AccountId {
    fn from(value: u64) -> Self { Self(value) }
}

pub struct Invoice {
    pub id: InvoiceId,
    pub account: AccountId,
}
```

These identifiers impose no range constraint. If zero or another value is invalid,
use validated construction instead of these infallible conversions.

## Validation

- Inventory reachable public numeric APIs recursively. Enforce them with
  `raw_numeric_public_api`.
