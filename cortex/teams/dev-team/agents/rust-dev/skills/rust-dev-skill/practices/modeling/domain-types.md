# Rust Domain Types

Give each domain value a distinct type. Preserve its meaning through construction, public APIs, and conversions.

## Required actions

- Reuse an equivalent core type before introducing another struct or enum.
- Keep values concrete; use generics or trait objects only for a real shared
  contract or capability, not to avoid naming the domain type.
- Keep domain types, validation, and focused tests in their owning domain module.
  Group related vocabulary there; do not add domain files directly to the core
  crate's `src` root. Re-export stable public types through `lib.rs`.

- Required identities and signed values use required validated newtypes.
  Free-form prose follows the [empty-text state rule](domain-states.md#represent-empty-prose-as-a-value);
  persistence alone does not justify rejecting empty text.
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

Give independent version families distinct types. Model released schema versions
and their payloads using [explicit supported revisions](#model-supported-schema-revisions-explicitly);
validate external version numbers at the parsing boundary.

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

These wrappers are infallible examples. Use [typed parsing results](#parse-according-to-domain-structure)
when the domain restricts the value. Named enums represent states; do not use
primitive sentinels to encode them.

## Construction patterns

The following fragments illustrate construction and wire shapes. Serde examples
assume its derive imports; aggregate examples assume existing domain types.

### Classify metadata by meaning

Classify the contents before choosing a wrapper: use enums for closed choices,
named records for composite values, and distinct newtypes for atomic text.
Static help text, CLI discovery, diagnostics, examples, and private serialization
records are application values too. Output placement does not exempt them.

**Prohibited:** unrelated pieces of free-form prose are interchangeable.

```rust
pub struct CommandHelp {
    pub summary: String,
    pub rationale: String,
}
```

**Preferred:** distinct newtypes preserve the roles of atomic prose. These
alternative declarations assume Serde derive and `derive_more`'s `from` feature.

```rust
#[derive(serde::Serialize, derive_more::From)]
#[serde(transparent)]
pub struct CommandSummary(String);

#[derive(serde::Serialize, derive_more::From)]
#[serde(transparent)]
pub struct CommandRationale(String);

#[derive(serde::Serialize)]
pub struct CommandHelp {
    pub summary: CommandSummary,
    pub rationale: CommandRationale,
}
```

Apply the next rule when text contains independently meaningful parts. A single
wrapper around a command line or transport paragraph is not sufficient merely
because it is called help text. Structured JSON/YAML examples follow
[typed document construction](../boundaries/serialization-boundaries.md#construct-known-documents-from-typed-values).

### Model a known vocabulary as a closed enum

Inspect the owning catalog before choosing a string wrapper. If the application
knows every identity in advance, represent those identities as enum variants.
Use the variants directly in authored code; let Serde decode their external names.
If the catalog has owners or teams, preserve that hierarchy in nested enums;
a flat list of known roles still loses membership constraints.
A string newtype plus `TryFrom` does not expose the domain's finite alternatives.

These alternatives illustrate a small coordinator/development catalog. Both
compile; only the nested enums restrict construction to roles in their actual
team. Assume Serde derive and a concrete `InvalidAgent` error in the prohibited
example. The hierarchy rule below adds another team to show invalid membership.

**Prohibited:** any nonempty name becomes an agent, including invented roles.

```rust
pub struct AgentId(String);
impl TryFrom<String> for AgentId {
    type Error = InvalidAgent;
    fn try_from(name: String) -> Result<Self, Self::Error> {
        if name.is_empty() { Err(InvalidAgent) } else { Ok(Self(name)) }
    }
}
let coordinator = AgentId::try_from("gizmo".to_owned())?;
```

**Preferred:** internal construction is infallible and names the exact role.

```rust
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(tag = "team", content = "role", deny_unknown_fields)]
pub enum AgentId {
    Gizmo(GizmoAgent),
    Development(DevelopmentAgent),
}
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum GizmoAgent { GizmoPrime, Gizmo }
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum DevelopmentAgent { RustDev }

let coordinator = AgentId::Gizmo(GizmoAgent::Gizmo);
let worker = AgentId::Development(DevelopmentAgent::RustDev);
```

Keep the real enum complete against its owning catalog. Adding/removing a role
must update both; verify their correspondence when the catalog is shipped as
separate files. Do not add `Other(String)`, `Custom(String)`, or an unknown-role
fallback unless the product explicitly supports an open registry. Unknown input
is a decoding failure, not another valid role. A host session identifier is a
separate dynamic value and must not be smuggled into the role enum.

A per-assignment task identifier belongs to an open domain, unlike a fixed role
catalog. Classify each value by its meaning instead of banning conversion traits
by name. Runtime input may require validation; closed choices use variants, open
text uses domain values, and stable scalar quantities use named typed constants.

These call-site alternatives assume the owning `LeaseSeconds` type validates
external durations through `TryFrom<i64>` and declares
`pub const TEN_MINUTES: Self = Self(600)` inside its implementation. The preferred
call avoids revalidating a known, reusable domain quantity.

- **Prohibited:** reconstruct a known quantity through runtime validation.

```rust
let ttl = LeaseSeconds::try_from(600)?;
```

**Preferred:** use the typed value declared by its owner.

```rust
let ttl = LeaseSeconds::TEN_MINUTES;
```

### Preserve ownership hierarchies in enum payloads

A closed enum must preserve the catalog's containment, not merely its set of
leaf names. Each team variant carries that team's role enum. Coordinators retain
their own enclosing group. Keep the relationship typed through arguments,
assignments, history, serialization, and generated schemas.

**Prohibited:** separate unrestricted fields allow an SRE/developer combination.
This complete example compiles but cannot enforce membership.

```rust
pub enum Team { Development, Sre }
pub enum Agent { RustDev, DockerSpecialist }
pub struct Assignment { pub team: Team, pub agent: Agent }

let assignment = Assignment { team: Team::Sre, agent: Agent::RustDev };
```

**Preferred:** an enclosing variant restricts which leaf enum can be supplied.
This is an expanded alternative to the earlier `AgentId` example, using Serde derive.

```rust
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(tag = "team", content = "role", deny_unknown_fields)]
pub enum AgentId {
    Gizmo(GizmoAgent),
    Development(DevelopmentAgent),
    Sre(SreAgent),
}
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum GizmoAgent { GizmoPrime, Gizmo }
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum DevelopmentAgent { RustDev }
#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum SreAgent { DockerSpecialist }

let coordinator = AgentId::Gizmo(GizmoAgent::Gizmo);
let developer = AgentId::Development(DevelopmentAgent::RustDev);
let operator = AgentId::Sre(SreAgent::DockerSpecialist);
```

`AgentId::Sre(DevelopmentAgent::RustDev)` is a compiler type mismatch;
`SreAgent::RustDev` names a nonexistent variant. Both must fail to compile.
Team-specific APIs accept their leaf type (for example `SreAgent`), while
cross-team ledgers may accept the enclosing `AgentId`. Do not use a flat enum,
independent `team`/`agent` fields, string prefixes, or runtime membership checks
as a substitute for that relationship. This constrains membership; it is not
host authorization or a claim that the CLI launches agents.

Generate the discriminated wire union from these types. Do not flatten it to
an agent string or give every team the union of every role. Compare the generated
alternatives with each team's catalog, including coordinators; checking only
the combined set of all agent names misses misplaced roles. Keep filesystem-name
mapping at the instructions-path boundary. Follow the contract's revision policy
when changing an established stored or published representation.

### Normalize structured strings into domain components

When an authored string has internal structure, extract its independently
meaningful parts into named domain fields as far as the domain permits. Use
nested records for composites, enums for closed choices, and existing domain
value types for dynamic parts. Keep those components typed until rendering.
This applies to command examples, resource locators, identifiers with multiple
parts, diagnostics, and prose that encodes settings or protocol behavior.

These alternative declarations describe a request invocation. They assume
Serde derive, `derive_more`'s `from` feature, and standard-library `PathBuf`.
Both compile; only the second exposes the command's structure.

**Prohibited:** a newtype still hides executable, operation, and request source.

```rust
#[derive(serde::Serialize, derive_more::From)]
#[serde(transparent)]
pub struct InvocationGuide(String);

let invocation = InvocationGuide::from(
    "meta-cortex run --request request.yaml (or --request - for stdin)".to_owned(),
);
```

**Preferred:** model the invocation and its alternatives before rendering.
`RunInvocation` itself names the operation; there is no need to store the fixed
`run` keyword in another string field.

```rust
use std::path::PathBuf;

#[derive(serde::Serialize, derive_more::From)]
#[serde(transparent)]
pub struct ExecutableName(String);

#[derive(serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RequestSource {
    File { path: PathBuf },
    Stdin,
}

#[derive(serde::Serialize)]
pub struct RunInvocation {
    pub executable: ExecutableName,
    pub request: RequestSource,
}

let invocation = RunInvocation {
    executable: ExecutableName::from("meta-cortex".to_owned()),
    request: RequestSource::File { path: PathBuf::from("request.yaml") },
};
```

Reuse the canonical values used by behavior: for example, a transport guide's
exit statuses should come from the command result types, not duplicate numbers
inside prose. Do not retain both a composite source string and independently
mutable components. Parse external structured text once at its owning adapter;
validate dynamic parts through their domain constructors.

**Prohibited:** an interpolated message stores raw dynamic values or becomes
application state that callers must split apart again.

```rust
pub struct RetryNotice {
    pub text: String, // "Retry 2 of 5 for task review"
}
```

**Preferred:** render a typed message at the presentation boundary. This fragment
assumes existing validated `Attempt`, `RetryLimit`, and `TaskId` types implementing
`Display`, plus `derive_more`'s `display` feature.

```rust
#[derive(derive_more::Display)]
#[display("Retry {attempt} of {limit} for task {task}")]
pub struct RetryNotice {
    pub attempt: Attempt,
    pub limit: RetryLimit,
    pub task: TaskId,
}
```

Keep fixed grammar and presentation wording in the renderer; do not create a
type for every word or punctuation mark. Preserve genuinely free-form user prose
as a named text value. Use an established parser/value type when it already owns
the structure, rather than inventing a grammar. At execution boundaries, pass
separate arguments to the process API; rendered help is not a shell command to
execute. At JSON/YAML boundaries, serialize the typed record rather than
interpolating a document.

If an established wire contract requires a string, keep the normalized model
internally and render only in that adapter using derives or supported conversion
attributes. Changing its wire shape requires the protocol's version/migration
policy. Static text and backward compatibility do not exempt the internal model.

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
- Use an [validating conversion returning `Result`](#parse-according-to-domain-structure) for constrained wrapper input. Empty free-form prose
  uses [infallible state classification](domain-states.md#represent-empty-prose-as-a-value),
  not a validation error.
- Add associated constants only for common values with stable meaning.
- Keep dynamic values on the normal conversion path.
- Preserve the wrapper through domain and WASM calls.
- Expose the primitive only at an explicit external edge.
- Use `#[serde(transparent)]` only when the owned wire format must remain the
  primitive.
- Keep a named `value` field when the serialized contract must retain the
  wrapper shape.

### Parse according to domain structure

Before parsing text, inspect what it represents. Normalize independently meaningful
components into typed fields; use enums for actual alternatives in that domain.
An address can contain a street and city, with different shapes for street and
post-office-box addresses. An atomic task ID has no such internal components.
Punctuation alone does not establish domain structure; do not invent fields for
opaque IDs or arbitrary prose.

Direct parsing and validation return `Result<Value, ConcreteError>` through
`TryFrom`, `FromStr`, or an owning parse method. This includes constrained string
wrappers, numeric ranges, and supported-version lookup. Do not add a
`Parsed(Value) / Invalid(Error)` enum that merely renames `Result`. A structured
value's parser also returns `Result`; its successful value carries the components
and meaningful alternatives. Keep validated fields private and propagate with `?`.

**Prohibited:** a result-shaped enum adds no domain information.
This fragment assumes the validated `TaskId` and `IdentifierParseError` below.

```rust
pub enum TaskIdParse {
    Parsed(TaskId),
    Invalid(IdentifierParseError),
}
```

**Preferred:** direct validation returns the domain value or a concrete error.
This complete type definition uses `thiserror`.

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct TaskId(String);

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum IdentifierParseError {
    #[error("identifier must not be empty")]
    Empty,
    #[error("identifier exceeds 128 bytes")]
    TooLong,
    #[error("identifier contains invalid characters")]
    InvalidCharacters,
}

impl TryFrom<String> for TaskId {
    type Error = IdentifierParseError;

    fn try_from(text: String) -> Result<Self, Self::Error> {
        match text.len() {
            0 => Err(IdentifierParseError::Empty),
            129.. => Err(IdentifierParseError::TooLong),
            1..=128 => match text.bytes().all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c)) {
                true => Ok(Self(text)),
                false => Err(IdentifierParseError::InvalidCharacters),
            },
        }
    }
}
```

Callers use `let task = TaskId::try_from(input)?;` in a function whose error can
carry `IdentifierParseError`. Serde reuses the same validating conversion through
[its conversion attribute](../boundaries/serialization-boundaries.md#reuse-validating-conversions-in-serde).
Do not create separate validation paths for application code and deserialization.

**Prohibited:** an address wrapper hides components needed by delivery behavior.

```rust
pub struct Address(String);
```

**Preferred:** retain components and meaningful address alternatives.
These illustrative types assume `derive_more` with its `from` feature. They show
ownership, not a universal address grammar; a parser for the supported input format
returns `Result<Address, AddressParseError>` and validates its components.

```rust
#[derive(derive_more::From)]
pub struct Street(String);
#[derive(derive_more::From)]
pub struct City(String);
#[derive(derive_more::From)]
pub struct PostOfficeBoxNumber(String);

pub struct StreetAddress {
    pub street: Street,
    pub city: City,
}

pub enum Address {
    Street(StreetAddress),
    PostOfficeBox { number: PostOfficeBoxNumber, city: City },
}
```

A single supported address shape needs only a struct. Do not invent alternatives
just to introduce an enum. Known catalogs still use closed variants, and valid
empty prose may retain a meaningful `Note::Empty` / `Note::Text` state. Neither is
a parse-result wrapper. Never treat rejected input as a usable ID or a default.

### Access wrappers through patterns or domain methods

Prohibit positional field access such as `value.0`, `self.0`, and `value.1` in
all authored Rust, including owning implementations, conversions, tests, and
adapters. Destructure legitimate wrappers with meaningful bindings, or call a
named domain method. Accessor implementations follow the same rule.

These alternative fragments assume an existing `TaskId` domain type and
`pub struct TaskReference(TaskId)`, with a `value: TaskReference`. The patterns
belong inside the wrapper's owning module, where its private representation is
accessible. All alternatives compile; positional access violates this practice.

**Prohibited:** the field's position hides its domain meaning.

```rust
let id = value.0;
```

**Preferred:** name the inner domain value through a pattern.

```rust
let TaskReference(id) = value;
```

**Preferred:** callers use a domain method that preserves the inner type.

```rust
impl TaskReference {
    pub fn id(&self) -> &TaskId {
        let Self(id) = self;
        id
    }
}

let id = value.id();
```

Use borrowed patterns when ownership must remain with the wrapper, such as
`let TaskReference(id) = &value`. Keep primitive destructuring inside the owning
implementation or a required external adapter; this rule does not authorize
leaking raw representations or making private fields public. A domain method
should expose meaning or behavior, not a generic escape hatch for internals.

Single-field newtypes remain valid. Destructure dependency-required tuples at
their adapter boundary; do not introduce application tuples to use this syntax.
The [named-record rule](#replace-positional-tuples-with-named-records) still
owns multi-value aggregates. Approved derives may generate representation access;
review authored code without replacing derives merely to change their expansion.

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

Wire JSON stays unchanged; the Rust API is typed. If the string is constrained,
validate it through `TryFrom` and use the
[Serde conversion attribute](../boundaries/serialization-boundaries.md#reuse-validating-conversions-in-serde)
to reject invalid input. A transparent derive alone would bypass validation.

### Model supported schema revisions explicitly

Give every supported released schema revision a named enum variant or typed
associated constant. Construct known versions by name, never by parsing a numeric
literal such as `SchemaVersion::try_from(3)?`. Prefer closed enums when decoding,
projection, or migration must handle every supported version exhaustively.
Keep numeric conversion at external boundaries; reject unsupported input there.

These alternative fragments assume Serde derive and existing domain payload
types, plus an `UnsupportedEventVersion` error implementing `Display`. Both
compile; the first hides a finite version choice inside a number.

**Prohibited:** author a known schema revision through runtime validation.

```rust
pub struct EventSchemaVersion(u32);
impl TryFrom<u32> for EventSchemaVersion {
    type Error = UnsupportedEventVersion;
    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            1..=2 => Ok(Self(value)),
            _ => Err(UnsupportedEventVersion),
        }
    }
}
let version = EventSchemaVersion::try_from(2)?;
```

**Preferred:** enumerate the supported identities and isolate the wire mapping.

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(try_from = "u32", into = "u32")]
pub enum EventSchemaVersion { V1, V2 }

impl EventSchemaVersion {
    pub const CURRENT: Self = Self::V2;
}
impl TryFrom<u32> for EventSchemaVersion {
    type Error = UnsupportedEventVersion;
    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::V1),
            2 => Ok(Self::V2),
            _ => Err(UnsupportedEventVersion),
        }
    }
}
impl From<EventSchemaVersion> for u32 {
    fn from(version: EventSchemaVersion) -> Self {
        match version {
            EventSchemaVersion::V1 => 1,
            EventSchemaVersion::V2 => 2,
        }
    }
}
let version = EventSchemaVersion::V2;
```

Apply the same version contract to independent consumers, tests, and fixtures.
A typed producer does not justify primitive version fields in its reader. These
alternative consumer records use the `EventSchemaVersion` above; both compile,
but only the preferred decoder rejects unsupported numeric versions at entry.

**Prohibited:** a consumer accepts any number as a known schema revision.

```rust
#[derive(serde::Deserialize)]
pub struct EventHeader {
    pub schema_version: u32,
}
```

**Preferred:** the consumer retains the closed version type after decoding.

```rust
#[derive(serde::Deserialize)]
pub struct EventHeader {
    pub schema_version: EventSchemaVersion,
}
```

Assert `header.schema_version == EventSchemaVersion::V2` in consumer tests,
not equality with a raw numeric literal. Raw numeric input belongs only in the
wire classifier or deliberately malformed/unsupported decoder fixtures.
Application release fields follow the same rule through their
[declared release enum](#enumerate-supported-application-releases). When the domain
instead accepts arbitrary external semantic versions, use a maintained semantic
version library at that boundary; a whitespace-checked string is not a parser.

A constant or unit variant names a value; it does not make its payload a different
Rust type. Give differing released shapes independent concrete records. Bind
version selection to its payload with enum variants or existing typestate; do not
allow a free version field to label the wrong body. The following alternatives
assume validated `MessageBody` and `AgentId` domain types.

**Prohibited:** the tag and payload can disagree.

```rust
pub struct EventBody { pub message: MessageBody }
pub struct VersionedEvent {
    pub version: EventSchemaVersion,
    pub body: EventBody,
}
```

**Preferred:** each version owns its shape; consumers match exhaustively.
These are internal types. Preserve an established numeric wire format in its
adapter rather than changing it to Serde's default enum representation.

```rust
pub struct EventBodyV1 { pub message: MessageBody }
pub struct EventBodyV2 { pub message: MessageBody, pub actor: AgentId }
pub enum VersionedEvent {
    V1(EventBodyV1),
    V2(EventBodyV2),
}
impl VersionedEvent {
    pub fn message(&self) -> &MessageBody {
        match self {
            Self::V1(body) => &body.message,
            Self::V2(body) => &body.message,
        }
    }
}
// VersionedEvent::V1(body_v2) is a type error, even if its fields overlap.
```

Retain a documented bounded set of supported revisions when the product requires
it (for example, the latest 100). Keep each retained decoder and migration typed;
reject retired/future revisions explicitly. Never reinterpret an old payload as
`CURRENT`, reuse its identity, or advance `CURRENT` without handling the retained
versions. Do not create 100 speculative schemas. With only one shipped shape,
a single supported variant suffices until another shape exists.

### Enumerate supported application releases

Successful parsing of an application/framework release must return a declared
release enum, not a validated string or a general semantic-version record.
Syntax validity does not establish membership in the supported release set.
Declare each supported identity in code and reject unknown/retired releases
with a concrete error in `Result`. Keep wire text only at the metadata boundary.

These complete alternatives assume a Cargo package at version `2.4.0`. Both
compile; the first accepts invented versions as application releases.

**Prohibited:** trimming and validation leave the successful value open-ended.

```rust
pub struct AppRelease(String);
#[derive(Debug)]
pub struct InvalidRelease;
impl TryFrom<String> for AppRelease {
    type Error = InvalidRelease;
    fn try_from(text: String) -> Result<Self, Self::Error> {
        let text = text.trim();
        if text.is_empty() || text.contains(char::is_whitespace) {
            return Err(InvalidRelease);
        }
        Ok(Self(text.to_owned()))
    }
}
```

**Preferred:** parsing selects a unit variant; no input string survives as the
successful release identity. The const initializer rejects a package-version
bump until its identity is declared. The wire renderer matches exhaustively.

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AppRelease { V2_4_0 }
#[derive(Debug, PartialEq, Eq)]
pub struct UnsupportedRelease;

impl AppRelease {
    pub const fn parse(text: &str) -> Result<Self, UnsupportedRelease> {
        match text.as_bytes() {
            b"2.4.0" => Ok(Self::V2_4_0),
            _ => Err(UnsupportedRelease),
        }
    }
}
impl TryFrom<String> for AppRelease {
    type Error = UnsupportedRelease;
    fn try_from(text: String) -> Result<Self, Self::Error> {
        Self::parse(text.trim())
    }
}
impl AppRelease {
    pub const CURRENT: Self = match Self::parse(env!("CARGO_PKG_VERSION")) {
        Ok(release) => release,
        Err(_) => panic!("declare the package release in AppRelease"),
    };
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::V2_4_0 => "2.4.0",
        }
    }
}
const _: AppRelease = AppRelease::CURRENT;
```

Adding a supported release requires its variant, input mapping, and exhaustive
output mapping. Match the enum in behavior that differs by release. Do not
silently map unknown versions to `CURRENT`, generate an unconstrained string
wrapper from Cargo metadata, or add speculative variants. Preserve established
semantic-version wire text using the serialization boundary's derived adapters;
independent consumers must decode it into their supported release enum too.
An external dependency's arbitrary version range is a different domain and does
not prove support for one of the application's own releases.

Validate both directions of every supported mapping, arbitrary text and unknown
well-formed releases, and the build failure for a package release missing from
the enum. Verify that a known version passes the same build check. A runtime test
alone does not enforce the required package/enum correspondence at compile time.

### Distinguish schema revisions from update counters

A task's optimistic-lock revision is an open runtime counter, not a released
schema identity. Keep it as a validated domain newtype; do not enumerate every
update or cap it to a schema-retention window. Use named initial values and domain
transitions in examples, and observed revisions in actual updates. These fragments
assume the existing Workbench `Revision` type and a decoded `task` record.

**Prohibited:** guess the revision needed by a later update.

```rust
let expected_revision = Revision::try_from(3)?;
```

**Preferred:** retain the observed token; derive illustrative transitions by name.

```rust
let expected_revision = task.revision;
// For a standalone catalog example without a running task:
let claimed_revision = Revision::INITIAL.advance()?;
let heartbeat_revision = claimed_revision.advance()?;
```

A conversion from an external database/wire counter still validates at runtime.
Invalid-input and overflow tests may supply raw boundary values deliberately;
valid fixtures use domain transitions. Compile-time version identities do not
prove runtime concurrency freshness: retain revision comparisons in transactions.

## External raw values

Uncontrolled external APIs may return primitives or raw records. Accept those
values in destination-owned conversions: `From<Raw>` when infallible,
`TryFrom<Raw>` with a concrete error when validation or parsing can fail.
Convert immediately at the adapter, then pass only the typed
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

For constrained wrapper input, propagate a typed error or match it where recovery
depends on the rejection reason. Do not panic, replace invalid input with a default, or make invalid
states usable as validated identifiers.

## Standard conversions

Use standard conversion traits when converting one value into another has an
obvious meaning. A one-input signature alone does not make an operation a
conversion.

### Required actions

- Use `From<T>` for a direct, infallible, value-preserving conversion from one
  input value.
- Use `TryFrom<T>` or `FromStr` for fallible parsing and validation, including
  constrained wrappers, text to a number, and integer narrowing. Return a concrete
  error; normalize structured successful values according to the domain.
- Implement `From` or `TryFrom` on the destination type. Use their provided
  `Into` or `TryInto` implementations at suitable call sites.
- Preserve private validated construction inside the owning classifier or conversion.
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
2. Inspect the owning vocabulary: known identities become a closed enum, with
   no invented string fallback. Preserve ownership hierarchies in typed variant
   payloads and verify membership per parent, not just a flat catalog. Inspect strings for internal structure and normalize composite values into
   typed components, including their dynamic parts. Classify each value as a
   closed choice, open domain content, private newtype
   storage, or an exact external contract. Use an enum or distinct newtype for
   application values; identify the external owner for a retained raw edge.
3. Reject result-shaped parse enums that duplicate `Result`. Verify structured
   successful values, concrete errors, and Serde reuse of the validating conversion. Inspect construction and call sites to ensure the named type survives until
   the actual encoding boundary. Check that serialization preserves the intended
   wire contract. Reject numeric field access, including inside wrapper methods;
   use patterns or domain methods instead. Replace positional aggregates with
   named records and apply
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
reviewed, structured help is normalized into typed components, atomic prose uses
distinct newtypes, and rendering preserves the required wire contract. Report
consumer test results separately.

- For changed version contracts, review named supported identities (including
  application releases), package-version compile-time correspondence, exhaustive
  version dispatch, distinct payload types for differing shapes, and the retained
  migration paths. Test unknown/retired rejection and wire compatibility separately
  from compile-time payload checks; a passing compiler cannot prove freshness.
