# Rust Workflow Typestate

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

## Prohibited actions

- Do not require a generic `Session<P>` or `Phase` framework for ordinary flows.
- Do not add artificial states to a pure operation without a lifecycle.
- Do not reuse one field bag with optional stage-specific fields.
- Do not expose an unchecked constructor for a validated or authorized state.
- Do not derive deserialization directly into a restricted capability.
- Do not clone a one-use capability to preserve the pre-transition state.
- Do not treat typestate as proof of runtime authorization or cryptographic safety.

## Examples

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

## Validation

- Test changed domain behavior in Rust.
- Add compile-fail tests for forbidden state construction and action ordering.
- Test each outcome branch and typed failure in the migrated flow.
- Test that invalid external input cannot construct an advanced state.
- Review secret ownership and destruction across consuming transitions.
- Verify these cases with the project's Rust validation tooling.
