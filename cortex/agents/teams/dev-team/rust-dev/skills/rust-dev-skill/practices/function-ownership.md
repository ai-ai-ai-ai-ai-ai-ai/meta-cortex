# Rust Function Ownership

Put behavior on the type that owns the knowledge or capability needed to perform it.
A namespace alone cannot establish ownership. Pure decisions need no artificial lifecycle.

## Required actions

- Put every authored function on a meaningful struct, enum, or trait.
- Apply this rule to public, private, and nested functions.
- Choose the type that owns the operation's required knowledge or capability.
- Use associated functions for construction or cohesive stateless operations.
- Use methods when the operation depends on an instance.
- Use traits for real shared contracts or required external interfaces.
- Keep closures local when they express an immediately used operation.
- Keep test helpers owned by focused fixture types.
- Use Rust enum receiver methods for enum-owned behavior.

## Prohibited actions

- Do not claim the ownership lint proves semantic cohesion or valid transitions.
- Do not hide unrelated functions in `Utils`, `Helpers`, or an empty catch-all type.
- Do not treat a module name alone as function ownership.
- Do not introduce a trait solely to move one free function.
- Do not introduce unowned public, private, or nested helper functions.

## Examples

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
