# Rust Domain States

Represent named alternatives with enums and keep each state’s data on its owning variant. Use optional values only for truthful structural absence.

## Required actions

- Reserve `Option<T>` for truthful structural absence. Legitimate examples
  include iterator or lookup results, optional caller filters, uninitialized
  caches, and external API fields.
- When absence means unauthenticated, unauthorized, pending, unsupported,
  configured versus unconfigured, or another named state, use an enum. Put
  state-specific values on the owning variant.
- Return `Option<T>` when callers genuinely ask whether a lookup result exists.
- Keep domain and application values concrete. Use a generic type parameter or
  trait object only for a real shared contract or capability.
- Keep domain validation next to the Rust type that makes the state explicit.
- Before adding a new struct or enum, search for an equivalent core type.
- Keep `domain-core` organized by domain module groups such as `auth`, `crypto`,
  `secrets`, `sync`, and `vault`.
- Place new core domain files in their owning group. Re-export them through
  `lib.rs` when they belong to the stable public core API.
- Represent not-applicable, unconfigured, pending, manual, or another named
  domain state with a Rust enum. Derive the generated boundary type from it.
- Truthful structural omission in external or persisted wire formats may still
  use `Option<T>` internally.

### Enum modeling

- Model closed sets as Rust enums.
- Model runtime alternatives as enum variants with state-owned fields.
- Model legal action sequencing with typestate.
- Put each field on the variant or sub-struct that owns it.
- Give an enum variant a dedicated payload struct when it owns multiple
  independently named fields.
  - Keep each field on the payload for the state that owns it.
- Keep unit variants and scalar payload variants when those are the truthful
  domain and wire shapes.
- Use a nested enum when one semantic category refines another.
  - For example, model `CredentialRole::Password(Password::Current)`.
- Keep orthogonal concepts as separate enums.
- Put domain behavior on the type that owns the required knowledge.
  - Prefer methods that validate, transform, or return a domain state.
  - Match the enum directly so new variants remain compiler-visible.
- Narrow enum variants before reading their payloads.
  - Use an exhaustive `match` when variants represent evolving domain decisions
    or require distinct behavior.
  - Prefer an expression-oriented `match` that shows genuine domain alternatives
    symmetrically instead of a guard return followed by the success path.
  - Let each arm produce the operation's result when the alternatives are peers.
  - Prefer `if let` or positive `let ... else` for interrelated or admission
    branches when every unmatched variant intentionally receives the same handling.
  - Keep ordinary failure propagation with `?`.
  - Keep an early return when it clearly expresses admission or control flow.
  - Apply decision locality
    when nesting reveals decisions that belong to other owners.
- Use a membership collection for uniqueness checks.
  - Prefer `HashSet::insert` when rejecting duplicate identifiers.
- Group a focused vocabulary under its owning module.
  - Use concise names such as `field::Index` and `field::Observation`.
  - Keep focused model and serialization tests beside that module.

## Prohibited actions

- Do not use one shared field bag for unrelated enum variants.
- Do not represent different workflow states as optional fields in one reused
  struct.
- Do not flatten a refining category into unrelated top-level variants.
- Do not replace a unit or scalar enum payload with a dedicated struct merely
  for structural uniformity.
- Do not change a persisted enum's payload shape without the explicit wire
  contract or migration required by the task.
- Do not nest editability, visibility, or another independent dimension under a
  role merely because both describe one record.
- Do not add `is_*` methods that only decode one enum variant into `bool`.
- Do not use `let ... else` when doing so would silently collapse variants that
  need exhaustive domain handling.
- Do not force boolean predicates into `match` or invent enum wrappers for symmetry.
- Do not deepen nested matches merely to make branches look symmetrical.
- Avoid negated compound conditions and deeply nested destructuring patterns.
- Do not scan every prior element when a membership collection expresses the
  same uniqueness rule.
- Do not use `Option<T>`, empty strings, or a `Missing` enum variant for required
  persisted or signed values.
- Do not use `Option<T>` or a decorative `Missing` variant for failure.
- Do not create a one-variant wrapper enum merely to avoid `Option<T>`.
- Do not introduce a generic type parameter only to avoid naming the concrete
  domain contract.
- Do not add new domain files directly under the core crate's `src` root.
  Put them in their owning domain module group.

## Recognizing a missing state

An `Option<T>` can mean one Rust shape is being reused across different worlds.
The code says "maybe this field exists." The real product model may be "this
value is in one named state or another named state."

Required persisted values are another failure mode. `Option<T>` permits an
invalid record to enter the model. Rejection is postponed until unrelated domain
logic runs.

When you see `Option<T>`, ask:

1. Why is this optional?
2. Is the containing struct shared by multiple workflows or provider kinds?
3. Are we using absence to mean a named state like draft, missing config,
   unauthenticated, local-only, pending, or unsupported?
4. Would an enum with per-variant structs make illegal states unrepresentable?

## Enums instead of booleans

Do not use `bool` as an authored domain value by default. Use a named enum even
when the domain currently has exactly two cases.

This rule covers:

- domain and application state;
- struct and enum payload fields;
- public and cross-module function parameters;
- policy, mode, command, and configuration inputs;
- persisted schemas and owned wire contracts; and
- Rust/WASM boundary parameters and fields.

### Why booleans fail

A boolean carries no domain metadata in its value. `true` does not explain what
is true, which policy it selects, or what transition produced it.

That loss of meaning creates several defects.

- **Call sites become abstract.** `sync(true)` makes the reader recover meaning
  from a distant signature.
- **Mental complexity increases.** Every reader must remember what `true` and
  `false` mean for that specific value.
- **Argument order is unsafe.** Two boolean parameters have the same type, so
  swapping them still compiles.
- **Evolution is blocked.** A boolean has only two cases. A third state forces a
  breaking signature, schema, and caller rewrite.
- **Related flags create invalid states.** Multiple booleans form combinations
  the domain may never permit.
- **Review loses intent.** A changed literal shows no domain meaning in a diff.

### Why enums win

An enum carries the domain meaning in the type and in every variant.

- `ProviderSyncFreshness::Forced` explains itself at the call site.
- Distinct enum types prevent parameters from being swapped accidentally.
- A new case becomes another variant of the same coherent vocabulary.
- Exhaustive matching forces every decision point to handle that new case.
- State-owned enum payloads keep variant-specific data on the variant that owns
  it.
- Mutually exclusive states become the only representable states.
- Persisted and generated contracts retain semantic names instead of anonymous
  bits.

Do not create decorative `True` and `False` variants. Name the actual domain
states, such as `Scheduled` and `Forced`, `Locked` and `Unlocked`, or `Absent`
and `Present`.

### Narrow exceptions

An authored `bool` requires a concrete reason. Convenience, fewer lines, or
having only two cases today are not reasons.

The allowed cases are intentionally narrow.

- A standard-library or required trait signature mandates `bool`.
- A fixed external protocol owns a boolean field that the application cannot change.
  Convert it into a named enum at the boundary before domain policy reads it.
- A private predicate answers a literal yes-or-no query such as `is_empty()` or
  `contains()`. Consume that result immediately. Do not store it as domain
  state or pass it onward as a policy or mode argument.
- A standard-library membership operation such as `HashSet::insert` may return
  `bool`. Consume it immediately as control flow.

Additional boundary rules:

- Raw observations are not a general exception. An observation that enters
  domain policy uses a named enum such as `MarkerPresence::Absent` or
  `MarkerPresence::Present`.
- Every retained public parameter, stored field, or lint allowance involving
  `bool` documents which narrow exception applies. Test fixtures and internal
  DTOs do not receive a blanket exemption.
- Do not serialize a boolean that can be derived from an enum.
- Do not expose a semantic predicate merely to avoid returning or matching the
  domain enum.

## Options or enums

Once an `Option<T>` represents a named domain state, prefer an enum almost
always. The enum makes the meaning part of the type.

Named enums improve optional domain models in several ways.

- **Names carry intent.** `NotLoaded` explains more than `None`.
- **Matches are exhaustive.** A new variant forces every decision point to
  account for the new state.
- **Illegal combinations disappear.** One enum replaces optional fields that
  could otherwise contradict each other.
- **Payload ownership is explicit.** Each variant carries only the values that
  exist in that state.

Do not use `Option<T>` merely because the state has two cases today. Ask what
`None` means in the domain. Use a named enum when it means empty, not loaded,
cleared, unauthenticated, unsupported, pending, or another real state.

Keep `Option<T>` when the caller is asking whether a value exists. Map lookups,
iterator searches, caches, optional caller filters, and truthful external wire
omissions remain idiomatic uses.

Do not preserve optional persisted fields as a compatibility fallback. Current
schemas deserialize directly into required validated values or explicit state
enums and reject incomplete data.

## Scope and boundaries

Applies to authored Rust domain and bridge code, including provider targets,
enrollment payloads, application state, sync state, storage modes, credential
states, and WASM DTOs.

Raw external API or user-controlled partial-input DTOs may remain permissive.
Convert them immediately into domain enums, required validated newtypes, or
typed errors. Persisted project schemas do not receive a legacy fallback unless a
task explicitly requires a migration.

It also does not replace idiomatic `Option<T>` return values from maps,
iterators, parsers, searches, or caches when the caller is genuinely asking
whether a value exists.

## Examples

These declarations assume existing `Endpoint` and `AccessToken` domain types.
They describe runtime configuration, not a persisted-schema migration.

**Prohibited:** a flag and independent optional fields permit enabled service
without credentials, or disabled service with unexplained leftover data.

```rust
pub struct ServiceConfiguration {
    pub enabled: bool,
    pub endpoint: Option<Endpoint>,
    pub token: Option<AccessToken>,
}
```

**Preferred:** the enabled state owns its complete payload. Callers must match
the semantic alternative before accessing the credentials.

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

This aggregate assumes already validated domain values. A restricted authorization
capability additionally requires private construction at its validating boundary.

## Validation

- Add or update tests for each new enum state.
- Add deserialization tests proving required persisted values reject missing and
  empty input.
- Check that helper APIs accept typed variants/enums instead of strings or
  optional field bags.
- Check variants with independently named multi-field payloads for dedicated
  payload structs.
- Preserve truthful unit, scalar, and persisted enum wire shapes.
- Check related categories for a truthful nested-enum boundary.
- Keep independent dimensions as separate types.
- Search changed enums for `is_*` methods that only reveal a variant.
- Replace quadratic duplicate scans with a membership collection.
- Prefer flat `let ... else` variant narrowing in multi-step filters only when
  every other variant is intentionally equivalent.
- Require an exhaustive `match` for evolving domain decisions.
- Verify every generic type parameter and trait object represents a real shared
  contract or capability.
- Inventory authored Rust `bool` fields, parameters, returns, and lint
  allowances in the changed scope.
- Replace every domain, state, policy, mode, command, configuration, persisted,
  and owned-boundary boolean with a meaningfully named enum.
- Keep a boolean only for a required trait, fixed external protocol, or private
  immediately consumed predicate. Document the exact exception.
- Review every `clippy::fn_params_excessive_bools` and
  `clippy::struct_excessive_bools` allowance in the changed scope. An allowance
  is not justification and should normally disappear with the refactor.
- Run targeted portable Rust tests and Clippy for the affected crates,
  including all targets with warnings denied.
