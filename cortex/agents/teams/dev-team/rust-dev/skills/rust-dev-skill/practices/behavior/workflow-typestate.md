# Rust Workflow Typestate

Represent each actionable stage of a workflow with a type. Give that type only
the operations allowed at that stage. A transition consumes the current state
and returns the next state, so callers cannot skip steps or reuse a consumed
capability.

For example, validate a reservation record before writing it:
`Ready::try_from` accepts a draft, and only `Ready` has a `persist` method.

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
Only the validated state exposes `persist`, which consumes that capability.
The domain quantity remains typed through the transition.

```rust
pub mod reservation {
    use std::{fs, io, num::NonZeroU16, path::PathBuf};

    pub struct Quantity(NonZeroU16);

    #[derive(Debug, thiserror::Error)]
    pub enum QuantityError {
        #[error("quantity must be greater than zero")]
        Zero,
    }

    #[derive(Debug, thiserror::Error)]
    pub enum ReservationError {
        #[error("invalid reservation quantity")]
        Quantity(#[from] QuantityError),
        #[error("could not persist reservation")]
        Persist(#[from] io::Error),
    }

    impl TryFrom<u16> for Quantity {
        type Error = QuantityError;

        fn try_from(raw: u16) -> Result<Self, Self::Error> {
            NonZeroU16::new(raw).map(Self).ok_or(QuantityError::Zero)
        }
    }

    impl Quantity {
        pub fn units(&self) -> u16 {
            self.0.get()
        }
    }

    pub struct Draft {
        pub raw_quantity: u16,
        pub destination: PathBuf,
    }

    pub struct Ready {
        quantity: Quantity,
        destination: PathBuf,
    }

    pub struct Completed {
        quantity: Quantity,
    }

    impl TryFrom<Draft> for Ready {
        type Error = QuantityError;

        fn try_from(draft: Draft) -> Result<Self, Self::Error> {
            let quantity = Quantity::try_from(draft.raw_quantity)?;
            Ok(Self { quantity, destination: draft.destination })
        }
    }

    impl Ready {
        pub fn persist(self) -> Result<Completed, ReservationError> {
            fs::write(&self.destination, self.quantity.units().to_string())?;
            Ok(Completed { quantity: self.quantity })
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
use reservation::{Draft, Ready, ReservationError};

fn main() -> Result<(), ReservationError> {
    let draft = Draft { raw_quantity: 3, destination: "reservation.txt".into() };
    let ready = Ready::try_from(draft)?;
    let _completed = ready.persist()?;
    Ok(())
}
```

This usage snippet shares the preceding `reservation` module. Validation
failure returns a typed error before completion. On success, moving `draft`
into `Ready::try_from` prevents its reuse, and moving `ready` into `persist`
prevents writing through that same capability twice.

From outside `reservation`, constructing `Ready` with a struct literal is a
compile error. Calling `persist` on `Draft`, cloning `Ready`, or reusing a moved
`Ready` is also a compile error. Keep these as separate compile-fail cases
when implementing this flow.

This example writes a validated reservation record; it does not reserve inventory.
`TryFrom` validates data, while `persist` performs I/O and remains a named action.
Inventory availability and authorization belong to their own effect boundary.
Private fields protect against external callers;
code inside the defining module must also preserve the construction invariant.

## Validation

- Test changed domain behavior in Rust.
- Add compile-fail tests for forbidden state construction and action ordering.
- Test each outcome branch and typed failure in the migrated flow.
- Test that invalid external input cannot construct an advanced state.
- Review secret ownership and destruction across consuming transitions.
- Verify these cases with the project's Rust validation tooling.
