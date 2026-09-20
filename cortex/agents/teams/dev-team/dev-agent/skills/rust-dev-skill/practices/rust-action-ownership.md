# Rust Action Ownership and Typestate

## Decision

Represent each actionable stage of a workflow with a type. Give that type only
the operations allowed at that stage. A transition consumes the current state
and returns the next state, so callers cannot skip steps or reuse a consumed
capability.

For example, a reservation must be validated before it can be completed:
`Draft::validate` returns `Ready`, and only `Ready` has a `finish` method.

This is the highest-priority modeling rule for new or changed meaningful action flows.
Migrate one cohesive flow at a time; do not rewrite unrelated flows merely to
adopt the policy. Pure operations without a lifecycle need no artificial stages.

Domain newtypes explain what a value means. An owning type explains where an
operation belongs. Typestate additionally limits which operations are available
at each stage. These mechanisms complement one another.

## Required actions

### Function ownership

- Put every authored function on a meaningful struct, enum, or trait.
- Apply this rule to public, private, and nested functions.
- Choose the type that owns the operation's required knowledge or capability.
- Use associated functions for construction or cohesive stateless operations.
- Use methods when the operation depends on an instance.
- Use traits for real shared contracts or required external interfaces.
- Keep closures local when they express an immediately used operation.
- Keep test helpers owned by focused fixture types.

### State and transitions

- Use typestate for most meaningful action flows.
- Begin with distinct data-carrying structs for distinct actionable stages.
- Put only valid operations on each stage's implementation.
- Carry validated domain values forward through transition results.
- Consume `self` when a transition replaces the prior state's capabilities.
- Return an exhaustive outcome enum when a transition has multiple next states.
- Return typed errors for failed validation or failed effects.
- Keep independent state dimensions separate.
- Introduce a generic state wrapper only for a demonstrated shared need.
- Seal a generic phase contract when external implementations would forge states.

### Capability construction

- Keep advanced state fields private to the module that enforces transitions.
- Admit untrusted inputs through validation before returning a trusted state.
- Limit constructors to states callers are actually allowed to enter.
- Review `Default`, `Deserialize`, `From`, `Clone`, and `Copy` implementations.
  - Reject any implementation that forges or duplicates a restricted capability.
- Deserialize external data into boundary data before validating capabilities.
- Recheck authorization or freshness at effects when external state can change.
- Preserve cryptographic verification at its existing trust boundary.

### Evidence

- Test changed domain behavior in Rust.
- Add compile-fail tests for forbidden state construction and action ordering.
- Test each outcome branch and typed failure in the migrated flow.
- Test that invalid external input cannot construct an advanced state.
- Review secret ownership and destruction across consuming transitions.
- Verify these cases with the project's Rust validation tooling.

## Prohibited actions

### Ownership and modeling

- Do not hide unrelated functions in `Utils`, `Helpers`, or an empty catch-all type.
- Do not treat a module name alone as function ownership.
- Do not introduce a trait solely to move one free function.
- Do not require a generic `Session<P>` or `Phase` framework for ordinary flows.
- Do not add artificial states to a pure operation without a lifecycle.
- Do not reuse one field bag with optional stage-specific fields.

### Capability integrity

- Do not expose an unchecked constructor for a validated or authorized state.
- Do not derive deserialization directly into a restricted capability.
- Do not clone a one-use capability to preserve the pre-transition state.
- Do not treat typestate as proof of runtime authorization or cryptographic safety.
- Do not claim the ownership lint proves semantic cohesion or valid transitions.

## Examples

Each pair contrasts code that Rust accepts with code that satisfies this policy.
Prohibited examples demonstrate design violations, not compiler errors.
Preferred examples are self-contained library snippets.

### Put behavior on the value that determines it

A module or utility type can organize names without owning the knowledge needed
by an operation. Put the decision on the smallest meaningful receiver.
This pure classification needs no lifecycle or typestate framework.

**Prohibited:** the helper owns no state or knowledge. Adding a `Utils` type
would leave the same misplaced decision.

```rust
pub enum DeliveryKind {
    Download,
    Shipment,
}

pub enum AddressRequirement {
    NotRequired,
    Required,
}

pub fn address_requirement(kind: DeliveryKind) -> AddressRequirement {
    match kind {
        DeliveryKind::Download => AddressRequirement::NotRequired,
        DeliveryKind::Shipment => AddressRequirement::Required,
    }
}
```

**Preferred:** the enum owns its classification. Callers ask for the domain
outcome instead of reconstructing the rule from variants.

```rust
pub enum DeliveryKind {
    Download,
    Shipment,
}

pub enum AddressRequirement {
    NotRequired,
    Required,
}

impl DeliveryKind {
    pub fn address_requirement(&self) -> AddressRequirement {
        match self {
            Self::Download => AddressRequirement::NotRequired,
            Self::Shipment => AddressRequirement::Required,
        }
    }
}
```

### Make validation a consuming transition

A ready state is a capability: possessing it allows an operation that an
unvalidated value must not expose. A boolean and optional fields leave that
contract to callers and permit contradictory combinations.

**Prohibited:** callers can fabricate readiness, change the quantity afterward,
or call `finish` without validation. Cloning also duplicates the claimed capability.

```rust
#[derive(Clone, Default)]
pub struct Reservation {
    pub quantity: Option<u16>,
    pub ready: bool,
}

impl Reservation {
    pub fn validate(&mut self) {
        self.ready = self.quantity.is_some_and(|value| value > 0);
    }

    pub fn finish(&self) -> Option<u16> {
        self.quantity
    }
}
```

**Preferred:** validation constructs a private capability and consumes the draft.
Only the validated state exposes `finish`, which consumes that capability.
The domain quantity remains typed through the transition.

```rust
pub mod reservation {
    use std::num::NonZeroU16;

    pub struct Quantity(NonZeroU16);

    pub enum QuantityError {
        Zero,
    }

    impl Quantity {
        pub fn parse(raw: u16) -> Result<Self, QuantityError> {
            NonZeroU16::new(raw).map(Self).ok_or(QuantityError::Zero)
        }

        pub fn units(&self) -> u16 {
            self.0.get()
        }
    }

    pub struct Draft {
        raw_quantity: u16,
    }

    pub struct Ready {
        quantity: Quantity,
    }

    pub struct Completed {
        quantity: Quantity,
    }

    impl Draft {
        pub fn new(raw_quantity: u16) -> Self {
            Self { raw_quantity }
        }

        pub fn validate(self) -> Result<Ready, QuantityError> {
            let quantity = Quantity::parse(self.raw_quantity)?;
            Ok(Ready { quantity })
        }
    }

    impl Ready {
        pub fn finish(self) -> Completed {
            Completed {
                quantity: self.quantity,
            }
        }
    }

    impl Completed {
        pub fn quantity(&self) -> &Quantity {
            &self.quantity
        }
    }
}
```

The caller follows the sequence through the available methods:

```rust
use reservation::{Completed, Draft, QuantityError};

pub struct ReservationRequest {
    pub quantity: u16,
}

impl ReservationRequest {
    pub fn complete(self) -> Result<Completed, QuantityError> {
        let draft = Draft::new(self.quantity);
        let ready = draft.validate()?;
        let completed = ready.finish();
        Ok(completed)
    }
}
```

This usage snippet shares the preceding `reservation` module. Validation
failure returns a typed error before completion. On success, moving `draft`
into `validate` prevents its reuse, and moving `ready` into `finish` prevents
completing that same capability twice.

From outside `reservation`, constructing `Ready` with a struct literal is a
compile error. Calling `finish` on `Draft`, cloning `Ready`, or reusing a moved
`Ready` is also a compile error. Keep these as separate compile-fail cases
when implementing this flow.

This example completes an in-memory transition. It does not reserve external
inventory. A real effect must still check current authorization and availability
at its owning boundary. Private fields protect against external callers;
code inside the defining module must also preserve the construction invariant.

### Consume replaced values and return explicit outcomes

An owned update should return the resulting value. When an operation can lead
to different next actions, use an enum that carries the corresponding state.
A boolean leaves the caller to infer what happened and what it can do next.

**Prohibited:** mutation retains the same API surface for every outcome, and
`true` does not name the resulting state.

```rust
pub struct Review {
    approved: bool,
}

impl Review {
    pub fn approve(&mut self, approved: bool) -> bool {
        self.approved = approved;
        approved
    }
}
```

**Preferred:** the decision has a domain name, and each outcome carries the
state that owns the next action. The update consumes its previous value.

```rust
pub struct SubmissionId(u64);

pub struct Review {
    submission: SubmissionId,
}

pub enum Decision {
    Approve,
    RequestChanges,
}

pub enum ReviewOutcome {
    Approved(Approved),
    ChangesRequested(Review),
}

pub struct Approved {
    submission: SubmissionId,
}

impl SubmissionId {
    pub fn new(value: u64) -> Self {
        Self(value)
    }

    pub fn value(&self) -> u64 {
        self.0
    }
}

impl Review {
    pub fn new(submission: SubmissionId) -> Self {
        Self { submission }
    }

    pub fn replace_submission(mut self, submission: SubmissionId) -> Self {
        self.submission = submission;
        self
    }

    pub fn decide(self, decision: Decision) -> ReviewOutcome {
        match decision {
            Decision::Approve => ReviewOutcome::Approved(Approved {
                submission: self.submission,
            }),
            Decision::RequestChanges => ReviewOutcome::ChangesRequested(self),
        }
    }
}

impl Approved {
    pub fn submission(&self) -> &SubmissionId {
        &self.submission
    }
}
```

Callers match `ReviewOutcome` exhaustively. They receive the selected state
without a second lookup or an optional field. In a real workflow, the owner
admitting `Decision` must establish who may make it; the enum alone proves
neither authorization nor freshness.

## Enforcement

- Enforce ownership through review for every new or changed authored function.
- Where available, use `unowned_function` and
  `invalid_unowned_function_suppression` to check structure and boundary exceptions.
- Migrate one cohesive action flow at a time; inventory its free functions and
  construction paths before changing them.
- Activate static ownership checks after the selected scope satisfies them.
- Preserve public ABI and persisted wire contracts unless their change is scoped.
- Do not classify existing free-function APIs as permanent exceptions.
- Do not equate compiler lint fixtures with domain behavior tests.
- Do not activate an unmigrated crate just to expose unrelated failures.
- Do not suppress the ownership lint across a crate, module, or type.
- Do not use blanket `allow` attributes for ownership exceptions.

## Boundary classification

Required language entrypoints and actual test-harness entry functions have an
external owner. Identify the compiler or harness requirement precisely.
A function name alone does not establish an exception.

Foreign declarations do not contain authored Rust behavior.
Externally generated framework items may remain outside the authored-item check.
Local macros must not bypass the ownership policy.
These boundaries do not exempt ordinary helper functions.

Framework callbacks that must remain free functions require a per-function
`expect(unowned_function, reason = "...")`. Use an `FFI boundary:` or
`framework boundary:` reason naming the exact required edge.
Use a checked expectation when automatic boundary identification is unavailable.
Move portable behavior into an owning type and delegate from that edge.

### Boundary evidence

Compiler fixtures must distinguish required boundaries from lookalike helpers.
Suppression fixtures must reject missing reasons and blanket exceptions.
The lint checks structure. Review owns the meaning of the selected type and
the security of each transition.

## Language-specific ownership

- Use Rust enum receiver methods for enum-owned behavior.
- Use Rust associated methods for construction and cohesive stateless behavior.

### Owned Rust updates

- Consume owned Rust state when an update replaces its value.
- Use `mut self` internally and return `Self`, a next state, or a typed result.
- Retain `&mut self` only for required traits or externally owned mutation contracts.
- Keep those exceptions at their exact boundary.
- Introduce channels only for a real high-level actor or concurrent owner.
- Do not add actor infrastructure merely to avoid an owned update.
