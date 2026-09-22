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

## Require values that cannot be absent

A required persisted or signed value stays required. Failure belongs in a typed
`Result`, not a `Missing` variant or empty string. Deserialize through validated
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

Do not author boolean fields, application parameters, returns, aliases, or stored
locals, including transport DTOs, tests, and private helpers. Allow `From<bool>`
on a destination enum to decode an external flag, or `TryFrom` when the
conversion can fail. Allow `From<DomainEnum> for bool` only to encode an existing
external boolean contract through Serde
[conversion attributes](../boundaries/serialization-boundaries.md#derive-serialization-instead-of-writing-boilerplate).
These conversions do not permit boolean application APIs. Dependency implementations and generated
external bindings keep their own types.

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
        if force { Self::Forced } else { Self::Scheduled }
    }
}

impl From<bool> for UploadMode {
    fn from(upload: bool) -> Self {
        if upload { Self::Enabled } else { Self::Disabled }
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

Library predicates and operators necessarily produce boolean expressions. Consume
those directly in control flow, as with membership insertion below; do not store
them as values or expose an authored boolean predicate. This is not permission
for boolean domain models or duplicate serialized flags derived from enums.

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

When variants require distinct behavior, name every arm. A wildcard or early
return must not silently assign future variants an existing policy. Use `if let`
or positive `let ... else` only when all unmatched variants intentionally share
one behavior. Avoid negated compound conditions and deeply nested matches.

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
    if !self.seen.insert(id) {
        return Err(RegistrationError::Duplicate);
    }
    Ok(self)
}
```

## Validation

- Reject authored `Option` and boolean contracts or stored values; inspect whole-record boundary conversions.
- Test each state and reject incomplete or invalid persisted values at decoding.
- Check payload ownership, independent dimensions, and exhaustive decisions.
- Run the affected Rust tests and Clippy for all targets with warnings denied.
