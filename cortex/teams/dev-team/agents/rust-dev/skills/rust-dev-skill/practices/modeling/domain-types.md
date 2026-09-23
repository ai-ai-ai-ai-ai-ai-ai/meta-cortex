# Rust Domain Types

Give each domain value a distinct type. Preserve its meaning through construction, public APIs, and conversions.

## Required actions

- Reuse an equivalent core type before introducing another struct or enum.
- Keep values concrete; use generics or trait objects only for a real shared
  contract or capability, not to avoid naming the domain type.
- Keep domain types, validation, and focused tests in their owning domain module.
  Group related vocabulary there; do not add domain files directly to the core
  crate's `src` root. Re-export stable public types through `lib.rs`.

- Required persisted or signed values use required validated newtypes.
- Represent typed domain values with existing core newtypes such as
  `OrderId`, `CustomerId`, `Quantity`, `OrderTotal`, and `MessageBody`.
  Add a newtype when the domain has no existing one.
- Use named domain newtypes in all parameters, returns, fields, constants,
  and local domain values, including private code and tests.
- Apply the rule recursively through results, collections, aggregates, generics, aliases, and bounds.
- Keep primitive representations inside their owning newtype or at an external
  edge that requires them. Convert boundary input immediately.
- Wrap user content and locale keys too; their names express different meanings.
- Convert dependency-owned raw records into owned domain records at the adapter;
  do not retain them as application payloads behind a wrapper.
- Use a narrow item-scoped `expect` only for a legitimate serialization, database, or FFI boundary, with its reason documented.

## Prohibited actions

- Do not use raw strings, numbers, bytes, or other primitives as domain values,
  even in private helpers. A variable name or `type Quantity = u32` is insufficient.
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

### Primitive storage is not a domain contract

Primitives implement a value type; they must not replace it in application code.
Arithmetic belongs inside the owning type. Unwrap only where a required external
API consumes the representation, and wrap incoming values immediately.

**Prohibited:** unrelated values remain interchangeable, despite field names.

```rust
pub struct OrderLine {
    pub quantity: u32,
    pub description: String,
}
```

**Preferred:** both the number and text retain their domain meaning.

```rust
#[derive(derive_more::From)]
pub struct Quantity(u32);

#[derive(derive_more::From)]
pub struct ProductDescription(String);

pub struct OrderLine {
    pub quantity: Quantity,
    pub description: ProductDescription,
}
```

These wrappers are infallible examples. Use validated `TryFrom` construction
when the domain restricts the value. Named enums represent states; do not use
primitive sentinels to encode them.

## Construction patterns

The following fragments illustrate construction and wire shapes. Serde examples
assume its derive imports; aggregate examples assume existing domain types.

### Classify metadata by meaning

Use enums for closed choices and distinct newtypes for text. Static help text,
CLI discovery, diagnostics, examples, and private serialization records are
application values too. `&'static str`, `Serialize`, or placement at an output
boundary does not exempt an authored field from this rule.

**Prohibited:** these help fields compile, but their values are interchangeable.

```rust
pub struct CommandHelp {
    pub invocation: &'static str,
    pub transport: &'static str,
}
```

**Preferred:** keep help text distinct from a machine-readable choice. These
alternative declarations assume Serde derive and `derive_more`'s `from` feature.

```rust
#[derive(serde::Serialize, derive_more::From)]
#[serde(transparent)]
pub struct InvocationGuide(&'static str);

#[derive(serde::Serialize, derive_more::From)]
#[serde(transparent)]
pub struct TransportGuide(&'static str);

#[derive(serde::Serialize)]
pub struct CommandHelp {
    pub invocation: InvocationGuide,
    pub transport: TransportGuide,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RequestSource {
    File,
    Stdin,
}
```

The help wrappers preserve existing string wire fields. `RequestSource` models
a closed choice; do not turn whole help paragraphs into enum variants just
because only one paragraph currently exists. A scalar alias or one generic
`Text` wrapper for unrelated meanings still permits the original mix-up.
Structured JSON/YAML examples are records, not help prose: follow
[typed document construction](../boundaries/serialization-boundaries.md#construct-known-documents-from-typed-values)
instead of wrapping their encoded source text.

### Single-field primitive wrapper

Use one wrapper for each domain meaning.

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, derive_more::From)]
pub struct FieldIndex {
    value: u32,
}

impl FieldIndex {
    pub const ZERO: Self = Self { value: 0 };
    pub const ONE: Self = Self { value: 1 };
}
```

- Use `From<Primitive>` for an infallible single-field wrapper.
- Use `TryFrom` when conversion validates the value.
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
- Do not expose state-capability fields merely to permit aggregate literals.

### Replace positional tuples with named records

Use domain structs with named fields for multi-value data, including locals,
returns, match results, collections, constants, and test fixtures. Typed tuple
elements still leave their roles positional. Multi-field tuple structs and
aliases do not fix this. Match an existing record directly instead of assembling
its fields into a temporary tuple.

These alternative fragments assume existing `EventKind` and `EventNote` types
and corresponding `kind` and `note` values. Both compile; only the named record
satisfies this practice.

**Prohibited:** application data depends on tuple positions.

```rust
let details: (EventKind, EventNote) = (kind, note);
let (kind, note) = details;
```

**Preferred:** give the aggregate and its fields domain meaning.

```rust
struct EventDetails {
    kind: EventKind,
    note: EventNote,
}

let details = EventDetails { kind, note };
let EventDetails { kind, note } = details;
```

Unit `()` and single-field nominal newtypes such as `EventNote(String)` do not
represent positional multi-value data. Where a dependency requires a tuple,
consume or produce it at that exact adapter boundary; keep named records inside
the application. This is not an exception for application-authored tuple APIs.

### Serde-transparent string newtype

```rust
#[derive(Serialize, Deserialize)]
#[serde(transparent)]
pub struct StoreId(String);
```

Wire JSON stays unchanged; the Rust API is typed. Validate through `TryFrom`
when invariants matter. Deserialization must preserve the same validation.

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

## External raw values

Uncontrolled external APIs may return primitives or raw records. Accept those
values in destination-owned `From<Raw>` conversions; use `TryFrom<Raw>` when
validation can fail. Convert immediately at the adapter, then pass only the typed
result into application code. Raw conversion parameters are allowed; raw
application contracts are not.

This applies to strings, numbers, booleans, bytes, and dependency-owned records.
Do not duplicate the dependency's raw struct or retain it behind a wrapper. For
multi-field input, convert the record and let each destination field type own
its conversion.

These call fragments assume an external `read_message()` returning `String` and
an application-owned `inbox`. This example accepts arbitrary message text.

- **Prohibited:** make the application interpret external primitives.

```rust
inbox.receive(external.read_message()); // receive accepts String.
```

- **Preferred:** convert once, at entry; the application accepts `MessageBody`.

```rust
#[derive(derive_more::From)]
pub struct MessageBody(String);

// Inside the adapter:
let body = MessageBody::from(external.read_message());
inbox.receive(body);
```

For constrained input, use `TryFrom` and propagate its typed error. Do not panic,
replace invalid input with a default, or weaken validation to force `From`.

## Standard conversions

Use standard conversion traits when converting one value into another has an
obvious meaning. A one-input signature alone does not make an operation a
conversion.

### Required actions

- Use `From<T>` for a direct, infallible, value-preserving conversion from one
  input value.
- Use `TryFrom<T>` for the corresponding fallible conversion. Return a
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
#[derive(derive_more::From)]
pub struct InvoiceId(u64);

#[derive(derive_more::From)]
pub struct AccountId(u64);

pub struct Invoice {
    pub id: InvoiceId,
    pub account: AccountId,
}
```

These identifiers impose no range constraint. If zero or another value is invalid,
use validated construction instead of these infallible conversions.

## Validation

Before handoff, review the changed code and each touched aggregate, including
unchanged sibling fields. For a refactor, review the moved code rather than only
its import edits.

1. Inventory fields, parameters, returns, locals, constants, examples, and tests,
   including private code and primitives nested inside collections or aliases.
2. Classify each value as a closed choice, open domain content, private newtype
   storage, or an exact external contract. Use an enum or distinct newtype for
   application values; identify the external owner for a retained raw edge.
3. Inspect construction and call sites to ensure the named type survives until
   the actual encoding boundary. Check that serialization preserves the intended
   wire contract. Replace positional aggregates with named records and apply
   [typed document construction](../boundaries/serialization-boundaries.md#construct-known-documents-from-typed-values)
   to JSON/YAML examples and fixtures; a wrapper around encoded text does not
   model its schema.
4. Report the reviewed scope, corrections, and any remaining exceptions separately
   from compiler, Clippy, and test results. An unreviewed scope is not verified.

Use `raw_numeric_public_api` where available for the public numeric subset;
passing it does not verify strings, metadata, private fields, or the broader rule.
Text searches can locate candidates but cannot establish semantic compliance.

**Prohibited:** report a discovery catalog as type-safe because Clippy passes,
while reviewing identifiers but skipping its help fields and example tuples.

**Preferred:** report that the catalog's fields and example construction were
reviewed, help text uses distinct newtypes, raw representation stays inside those
types or encoding, and existing YAML consumers still pass their checks.
