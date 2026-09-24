# Rust Domain States

Name each state and put its data on its variant. These rules cover public and
private application code, tests, persisted models, and Rust/WASM contracts.
Examples are alternatives, not declarations to combine in one module. Referenced
payload types already exist; method fragments belong to their stated owners.

## Replace `Option` with meaningful states

Prohibit authored `Option` fields, parameters, returns, aliases, and stored locals,
including caches, filters, parsers, and adapters. `None` hides whether a value is
not loaded, disabled, not found, or invalid. Named variants carry that meaning.
Do not substitute a generic `Maybe<T>`, sentinel, or decorative wrapper.

**Prohibited:** the caller must guess why the order is absent.

```rust
pub struct OrderCache {
    pub order: Option<Order>,
}
```

**Preferred:** the cache names its actual alternatives.

```rust
pub enum OrderCache {
    NotLoaded,
    Loaded(Order),
}
```

### Translate dependency results immediately

A library may return `Option`; consume it at the call boundary. Do not retain or
forward it, or implement an authored `Option`-returning trait. Choose a different
interface when it requires that signature.

**Prohibited:** expose the map's optional result from the repository.

```rust
pub fn find(&self, id: &OrderId) -> Option<&Order> {
    self.orders.get(id)
}
```

**Preferred:** return the lookup's named outcome.

```rust
pub enum OrderLookup<'a> {
    Found(&'a Order),
    NotFound,
}

// Inside impl OrderRepository:
pub fn find(&self, id: &OrderId) -> OrderLookup<'_> {
    match self.orders.get(id) {
        Some(order) => OrderLookup::Found(order),
        None => OrderLookup::NotFound,
    }
}
```

### Review the Option prohibition

- Review authored fields, parameters, return types, aliases, and stored locals for `Option`.
- Check inferred values and dependency-result handling as well as explicit type annotations.
- Keep immediate matching of dependency-returned values at the boundary.
- Exclude dependency-generated implementations from this authored-code requirement.
- Do not configure Clippy's `disallowed_types` to ban `Option`.
- Do not introduce wrapper modules or lint allowances to accommodate generated `Option` uses.

**Prohibited:** restructure Serde or thiserror declarations solely to suppress this lint.

**Preferred:** retain ordinary derives and review authored code against the no-`Option` rule.

## Represent empty prose as a value

Free-form notes and similar text have a valid empty state. Model that state in a
domain enum and classify strings with infallible `From`, not `TryFrom` returning
an error solely for empty/blank content. Do not use `Result` as a disguised
optional value. Apply this to constructors, decoding, examples, and tests.

These alternative declarations assume Serde derive, `derive_more`'s `display`
feature, and a concrete `EmptyNote` error for the prohibited example. Both compile;
the first invents a failure for valid text.

**Prohibited:** every caller must propagate an empty-note error.

```rust
pub struct Note(String);
impl TryFrom<String> for Note {
    type Error = EmptyNote;
    fn try_from(text: String) -> Result<Self, Self::Error> {
        if text.trim().is_empty() {
            Err(EmptyNote)
        } else {
            Ok(Self(text))
        }
    }
}
let note = Note::try_from(input)?;
```

**Preferred:** distinguish empty text explicitly and protect the text variant's
construction. Preserve the established string wire contract through Serde's
conversion attributes; new wire contracts follow their own versioning policy.

```rust
#[derive(Clone, serde::Serialize, serde::Deserialize, derive_more::Display)]
#[serde(from = "String", into = "String")]
pub enum Note {
    #[display("")]
    Empty,
    #[display("{_0}")]
    Text(NoteText),
}

#[derive(Clone, derive_more::Display)]
pub struct NoteText(String);

impl From<String> for Note {
    fn from(text: String) -> Self {
        match text.as_str() {
            "" => Self::Empty,
            _ => Self::Text(NoteText(text)),
        }
    }
}
impl From<Note> for String {
    fn from(note: Note) -> Self {
        match note {
            Note::Empty => Self::new(),
            Note::Text(NoteText(text)) => text,
        }
    }
}
let note = Note::from(input);
```

Keep `NoteText` construction private to the classifier. Do not derive a public
`From<String>`, `Default`, or unchecked `Deserialize` for it: those would permit
`Note::Text` to contain empty text. Do not expose a generic `Maybe<String>` or a
raw string payload in its place. Whitespace remains text and round-trips exactly;
do not trim or discard user content merely to classify it as empty.

Empty text and a missing field are different. Required fields remain required;
a missing or non-string wire value can still be a decoding error. A plain text
wrapper whose behavior makes no empty/present distinction can use infallible
`From` directly. Do not mechanically wrap every string in another enum.

## Require values that cannot be absent

An identifier or signed value whose contract requires a valid identity stays
required. Failure belongs in a typed `Result`, not a `Missing` variant or empty
string. This is not permission to reject empty free-form prose; apply the
[empty-text rule](#represent-empty-prose-as-a-value) to that domain instead. Deserialize through validated
types; preserve established wire shapes through adapters and explicit migrations.

**Prohibited:** an incomplete record enters the domain.

```rust
pub enum InvoiceIdentity {
    Missing,
    Assigned(InvoiceId),
}

pub struct Invoice {
    pub id: InvoiceIdentity,
}
```

**Preferred:** an invoice cannot exist without its validated identity.

```rust
pub struct Invoice {
    pub id: InvoiceId,
}
```

The decoder rejects missing or invalid identifiers before constructing `Invoice`.
A legitimate draft belongs to a separately named state, not an incomplete invoice.

## Replace domain booleans with named alternatives

Use enums for state, policy, mode, commands, configuration, and observations that
enter domain decisions. `true` hides the selected behavior; `Forced` names it.
Do not add `True`/`False` variants or an `is_*` method that merely decodes a variant.

These calls belong inside an operation; `sync` is the existing operation owner.

**Prohibited:** the call requires knowledge of a distant boolean parameter.

```rust
sync.run(true);
```

**Preferred:** the parameter names the policy.

```rust
pub enum SyncMode {
    Scheduled,
    Forced,
}

// At the call site:
sync.run(SyncMode::Forced);
```

### Convert external records into owned types

- Use enums instead of booleans in authored fields, application parameters, returns, aliases, and stored state.
- Apply this rule to transport DTOs, tests, and private helpers.
- Preserve enums in new interfaces and serialized contracts the project controls.
- Prohibit `#[serde(into = "bool")]`, `From<DomainEnum> for bool`, and equivalent boolean-returning helpers by default.
- Allow boolean conversion only when a required external interface mandates it or backward compatibility requires an existing boolean contract.
- Identify the external interface or established compatibility contract beside the conversion.
- Do not invent a compatibility requirement for a newly designed interface.
- Keep the conversion at the boundary; application code must still receive and return enums.
- Decode required boolean input through `From<bool>` on the destination enum, or `TryFrom` when conversion can fail.
- Encode required boolean output through Serde [conversion attributes](../boundaries/serialization-boundaries.md#derive-serialization-instead-of-writing-boilerplate).
- Preserve dependency-owned and generated external binding signatures.

If a dependency returns a record with several booleans, convert the whole record
at the adapter. Own the conversion on the destination through `From`, or `TryFrom`
when combinations can be invalid. Do not retain the raw record inside a wrapper
and expose its flags through getters.

The external crate in these fragments owns `external::SyncObservation`, with
boolean `force` and `upload` fields. We do not redeclare that raw struct.

- **Prohibited:** a wrapper carries the untyped policy into application code.

```rust
pub struct SyncRequest {
    pub raw: external::SyncObservation,
}
```

- **Preferred:** the owned record names both independent policies.

```rust
pub enum UploadMode {
    Enabled,
    Disabled,
}

pub struct SyncRequest {
    pub mode: SyncMode,
    pub upload: UploadMode,
}

impl From<bool> for SyncMode {
    fn from(force: bool) -> Self {
        match force {
            true => Self::Forced,
            false => Self::Scheduled,
        }
    }
}

impl From<bool> for UploadMode {
    fn from(upload: bool) -> Self {
        match upload {
            true => Self::Enabled,
            false => Self::Disabled,
        }
    }
}

impl From<external::SyncObservation> for SyncRequest {
    fn from(raw: external::SyncObservation) -> Self {
        let mode = SyncMode::from(raw.force);
        let upload = UploadMode::from(raw.upload);
        Self { mode, upload }
    }
}

// At the adapter, before application code receives the request:
// sync.run(SyncRequest::from(external_observation));
```

This small conversion cost buys compiler-checked distinctions throughout the
application: an `UploadMode` cannot be supplied where a `SyncMode` belongs.
If flags describe one state rather than independent policies, use one enum of
legal combinations and reject invalid input instead of copying the flag matrix.
For raw JSON, decode into those owned enums; do not invent an intermediate
application-authored struct of booleans.

### Name predicate outcomes before choosing behavior

When a library predicate or comparison returns `bool`, convert that result
into a named domain outcome where the expression is evaluated.

- Match the expression directly; do not store its boolean result.
- Return the decision's enum from the conversion.
- Choose workflow actions by matching that enum.
- Apply this rule to private helpers and mechanical decisions too.
- Do not expose the enum through a boolean getter or serialize a duplicate flag.

These alternatives belong to `JobQueue`, which owns `jobs: Vec<Job>`.
The call sites assume a worker with `wait()` and `process()` operations.
Both alternatives compile; the first violates the boolean API rule.

**Prohibited:** the helper exposes a boolean and the caller chooses actions
from `true` and `false`.

```rust
// Inside impl JobQueue:
fn is_empty(&self) -> bool {
    self.jobs.is_empty()
}

// At the call site:
match queue.is_empty() {
    true => worker.wait(),
    false => worker.process(),
}
```

**Preferred:** the helper names the state before the caller chooses an action.

```rust
pub enum QueueState {
    Empty,
    Ready,
}

// Inside impl JobQueue:
fn state(&self) -> QueueState {
    match self.jobs.is_empty() {
        true => QueueState::Empty,
        false => QueueState::Ready,
    }
}

// At the call site:
match queue.state() {
    QueueState::Empty => worker.wait(),
    QueueState::Ready => worker.process(),
}
```

The library boolean stays inside `state()`. The caller receives the queue's
meaningful alternatives. Keep this conversion on the existing owner; the shared
[branching rule](../../../../../../docs/programming/branching-and-exhaustive-matching.md#use-patterns-instead-of-boolean-if-conditions)
prohibits decorative `True`/`False` enums and generic branching helpers.

## Put payloads on their owning variants

One state must not carry another state's fields. Use a dedicated payload struct
for multiple named fields; keep unit and single-value variants when they fit.
Do not reshape a persisted enum just to make its variants look uniform.

**Prohibited:** disabled services can carry credentials, while enabled ones can
lack them.

```rust
pub struct ServiceConfiguration {
    pub enabled: bool,
    pub endpoint: Option<Endpoint>,
    pub token: Option<AccessToken>,
}
```

**Preferred:** only the enabled variant carries its complete configuration.

```rust
pub enum ServiceConfiguration {
    Disabled,
    Enabled(EnabledService),
}

pub struct EnabledService {
    pub endpoint: Endpoint,
    pub token: AccessToken,
}
```

The payload assumes validated values. Authorization capabilities additionally
need private construction; legal action sequencing belongs in typestate.

## Separate independent dimensions; nest refinements

Visibility does not refine an account role: keep them separate. A shipping speed
refines shipment: nest it under that delivery kind.

**Prohibited:** independent choices multiply variants; a refinement loses its parent.

```rust
pub enum AccountState {
    VisibleReader,
    HiddenReader,
    VisibleEditor,
    HiddenEditor,
}

pub enum DeliveryMode {
    Pickup,
    StandardShipment,
    ExpressShipment,
}
```

**Preferred:** independent choices compose, while related choices stay nested.

```rust
pub enum AccountRole { Reader, Editor }
pub enum Visibility { Visible, Hidden }

pub struct AccountState {
    pub role: AccountRole,
    pub visibility: Visibility,
}

pub enum DeliveryMode {
    Pickup,
    Shipment(ShippingSpeed),
}

pub enum ShippingSpeed { Standard, Express }
```

## Match decisions exhaustively

Apply the shared [branching rule](../../../../../../docs/programming/branching-and-exhaustive-matching.md).
When variants require distinct behavior, name every arm so a new variant requires
a new decision. For focused payload extraction, use the rule's encouraged Rust
conditional patterns with intentional unmatched handling. Keep decisions with
their owners and avoid deeply nested matches.

These alternatives convert the existing domain `DeliveryKind` into the
consumer-owned `AddressRequirement`.

**Prohibited:** new delivery kinds silently become address-free.

```rust
impl From<DeliveryKind> for AddressRequirement {
    fn from(kind: DeliveryKind) -> Self {
        match kind {
            DeliveryKind::Shipment => Self::Required,
            _ => Self::NotRequired,
        }
    }
}
```

**Preferred:** adding a delivery kind requires a new decision.

```rust
impl From<DeliveryKind> for AddressRequirement {
    fn from(kind: DeliveryKind) -> Self {
        match kind {
            DeliveryKind::Shipment => Self::Required,
            DeliveryKind::Download => Self::NotRequired,
        }
    }
}
```

## Consume membership results as control flow

Use a membership collection to reject duplicate identifiers instead of scanning
all previous values. The insertion boolean is a mechanical result, not stored
policy. These alternatives belong to an `OrderRegistry` owning `seen`.

**Prohibited:** a growing list is scanned for every registration.

```rust
pub fn register(mut self, id: OrderId) -> Result<Self, RegistrationError> {
    if self.seen.iter().any(|existing| existing == &id) {
        return Err(RegistrationError::Duplicate);
    }
    self.seen.push(id);
    Ok(self)
}
```

**Preferred:** `seen` is a `HashSet<OrderId>` and insertion detects duplicates.

```rust
pub fn register(mut self, id: OrderId) -> Result<Self, RegistrationError> {
    match self.seen.insert(id) {
        true => Ok(self),
        false => Err(RegistrationError::Duplicate),
    }
}
```

## Validation

- Reject authored `Option` and boolean contracts or stored values; inspect whole-record boundary conversions.
- Test empty/text classification, whitespace preservation, and wire round trips;
  do not turn empty prose into a failure. Keep genuine format validation at its boundary.
- Test each state and reject incomplete or invalid persisted values at decoding.
- Check payload ownership, independent dimensions, and exhaustive decisions.
- Run the affected Rust tests and Clippy for all targets with warnings denied.
