# Rust Function Ownership

Put each function on the struct, enum, or trait that owns its behavior.
Free functions are prohibited, including private, nested, and test helpers,
except for the required boundaries described below.

## Choose the owner

- Use a receiver method when behavior depends on an instance.
- Use an associated function for construction or a stateless operation belonging to the type.
- Use a trait for a shared contract or required external interface, not to house a helper.
- Put test helpers on focused fixture types. Keep immediately used closures local.

A module, `Utils`, or an empty catch-all type is not a meaningful owner.
A simple decision does not need an artificial lifecycle.

Apply the shared [nesting and abstraction limit](../../../../../../docs/programming/function-ownership.md#limit-nesting-and-abstraction).

- Count `match` branches, closures, loops, and permitted conditional patterns
  such as `if let` together.
- Count a `match` and its arms as one level.
- Exclude module and `impl` bodies, data literals, and parentheses.
- Flatten before extracting; do not add types or forwarding methods merely to
  move nested code elsewhere.
- Use Clippy's structural nesting count as a backstop; review mixed execution
  scopes against the shared limit.

## Own constants and state

Put constants in the owning type's `impl` as associated constants. Keep mutable
state in struct fields. Module-level `const`, `static`, and `static mut`
declarations are prohibited unless an external contract requires that exact shape.
Local bindings and constants stay inside their owning method.

**Prohibited:** a module holds a constant, state, and an unowned accessor.

```rust
const MAX_ATTEMPTS: u32 = 3;
static mut REMAINING: u32 = MAX_ATTEMPTS;

fn remaining(budget: &RetryBudget) -> &AttemptCount {
    &budget.remaining
}
```

**Preferred:** the value type owns the constant; the budget owns the state and accessor.

```rust
#[derive(derive_more::From)]
pub struct AttemptCount(u32);

impl AttemptCount {
    pub const MAX: Self = Self(3);
}

pub struct RetryBudget {
    remaining: AttemptCount,
}

impl RetryBudget {
    pub fn remaining(&self) -> &AttemptCount {
        &self.remaining
    }
}
```

## Respect domain dependencies

Choose ownership from the rule and dependency direction, not just the input type.
Keep behavior on the source when it owns the rule. When another domain interprets
the source, put that interpretation in the consuming domain. Do not make the
source depend on its consumers merely to attach a method to it.

Here, the address domain derives its requirement from a delivery kind. Delivery
must not depend on address policy. This direct conversion belongs on the destination
as `From<DeliveryKind> for AddressRequirement`.

**Prohibited:** the source imports its consumer and owns the consumer's rule.
Moving this method into a free helper would not resolve ownership.

```rust
pub mod delivery {
    use crate::address::AddressRequirement;

    pub enum DeliveryKind {
        Download,
        Shipment,
    }

    impl DeliveryKind {
        pub fn address_requirement(self) -> AddressRequirement {
            match self {
                Self::Download => AddressRequirement::NotRequired,
                Self::Shipment => AddressRequirement::Required,
            }
        }
    }
}

pub mod address {
    pub enum AddressRequirement {
        NotRequired,
        Required,
    }
}
```

**Preferred:** the destination owns the conversion. The source stays independent.

```rust
pub mod delivery {
    pub enum DeliveryKind {
        Download,
        Shipment,
    }
}

pub mod address {
    use crate::delivery::DeliveryKind;

    pub enum AddressRequirement {
        NotRequired,
        Required,
    }

    impl From<DeliveryKind> for AddressRequirement {
        fn from(kind: DeliveryKind) -> Self {
            match kind {
                DeliveryKind::Download => Self::NotRequired,
                DeliveryKind::Shipment => Self::Required,
            }
        }
    }
}

use address::AddressRequirement;
use delivery::DeliveryKind;

let requirement = AddressRequirement::from(DeliveryKind::Shipment);
```

Use `From` for direct infallible conversions and `TryFrom` for fallible parsing
and validation. Inspect structured strings under the
[parsing rule](../modeling/domain-types.md#parse-according-to-domain-structure). Use a named method for policy that needs additional context or performs an
action. Keep validation and workflow transitions intact.

## Keep required free functions at the boundary

Language entrypoints, test-harness entries, and callbacks required by an external
framework may remain free functions. Delegate application behavior to an owning
type. Test-harness entries may contain their scenario's setup, actions, and
assertions; reusable test helpers still belong to fixture owners. Ordinary
helpers do not inherit the entrypoint exception.

**Prohibited:** `main` delegates to another unowned helper.

```rust
fn main() {
    run_application();
}

fn run_application() {
    // Application behavior lives here.
}
```

**Preferred:** the required entrypoint delegates to the application type.

```rust
fn main() {
    let application = Application { message: MessageBody::from(String::from("Ready")) };
    application.run();
}

#[derive(derive_more::From)]
pub struct MessageBody(String);

impl MessageBody {
    pub fn print(&self) {
        let Self(message) = self;
        println!("{message}");
    }
}

pub struct Application {
    message: MessageBody,
}

impl Application {
    pub fn run(self) {
        self.message.print();
    }
}
```

Identify the actual compiler, harness, FFI, or framework requirement; a name
such as `test_helper` does not establish an exception. Foreign declarations
and externally generated items contain no authored implementation to move.
Do not use local macros to evade ownership.

## Check ownership

Review ownership of functions, associated constants, and state fields.
Reject module-level values as well as free functions.
Review whether the chosen type owns the behavior. A lint can check placement,
not cohesion or legal state transitions.

Where available, use `unowned_function` and
`invalid_unowned_function_suppression`. When a required callback cannot be
recognized automatically, use a per-function checked expectation with an
`FFI boundary:` or `framework boundary:` reason naming the required edge.
Never suppress ownership across a crate, module, or type.

- **Prohibited:** add a blanket `allow` or exempt helpers because a framework
  calls one function in the module.

- **Preferred:** exempt only the required callback, document its external contract,
  and keep the delegated behavior on its owning type. Check that lint fixtures
  reject lookalike helpers, missing reasons, and blanket suppressions; retain
  separate behavior tests.

Migrate one cohesive flow at a time. Inventory its free functions and construction
paths, preserve public ABI and wire contracts unless their change is assigned,
and enable ownership checks after that scope is migrated. Existing free-function
APIs are migration work, not permanent exceptions.
