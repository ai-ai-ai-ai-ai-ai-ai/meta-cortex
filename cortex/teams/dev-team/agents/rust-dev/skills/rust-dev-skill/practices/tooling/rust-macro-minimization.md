# Rust Macro Minimization

## Keep routine code explicit

Do not define repository macros for routine types, implementations, errors, or
control flow. Keep the actual Rust visible where readers and tools inspect it.
This applies to product code, tooling, tests, examples, and build scripts,
including exported declarative macros and procedural-macro entrypoints.

Examples below are alternatives, not definitions to combine in one module.
Prohibited examples may compile; their hidden structure is the policy violation.

## Declare domain types directly

Do not introduce a local macro just to stamp out similar wrappers. A concrete
declaration keeps each domain type searchable and independently changeable.
Use the approved `derive_more::From` derive for infallible single-field wrappers.

**Prohibited:** the domain declaration hides behind a repository template.

```rust
macro_rules! identifier {
    ($name:ident) => {
        #[derive(derive_more::From)]
        pub struct $name(u64);
    };
}

identifier!(OrderId);
identifier!(CustomerId);
```

**Preferred:** both types are explicit; only the mechanical trait is derived.

```rust
#[derive(derive_more::From)]
pub struct OrderId(u64);

#[derive(derive_more::From)]
pub struct CustomerId(u64);
```

These identifiers have no range constraints. Validation still requires the
owning type's fallible construction; a macro or derive must not bypass it.

## Keep domain mappings in their destination impl

A short repeated match is clearer than a local mapping language. Do not hide
source/destination dependencies or exhaustive matching behind token substitution.
These fragments assume existing `DeliveryKind` and `AddressRequirement` enums.

**Prohibited:** a macro owns the conversion's structure.

```rust
macro_rules! address_mapping {
    () => {
        impl From<DeliveryKind> for AddressRequirement {
            fn from(kind: DeliveryKind) -> Self {
                match kind {
                    DeliveryKind::Download => Self::NotRequired,
                    DeliveryKind::Shipment => Self::Required,
                }
            }
        }
    };
}

address_mapping!();
```

**Preferred:** the destination owns a directly visible conversion.

```rust
impl From<DeliveryKind> for AddressRequirement {
    fn from(kind: DeliveryKind) -> Self {
        match kind {
            DeliveryKind::Download => Self::NotRequired,
            DeliveryKind::Shipment => Self::Required,
        }
    }
}
```

## Show validation and early exits where they happen

Do not hide a caller's `return`, `?`, mutation, or branching inside a macro.
Keep validation on its type and return the concrete error directly.
Both fragments assume the following shared error declaration:

```rust
#[derive(Debug, PartialEq, thiserror::Error)]
pub enum RetryLimitError {
    #[error("retry limit must be positive")]
    Zero,
}
```

**Prohibited:** the macro returns from a method its definition does not show.

```rust
macro_rules! reject_zero {
    ($value:expr) => {
        if $value == 0 {
            return Self::Invalid(RetryLimitError::Zero);
        }
    };
}

pub struct RetryLimit(u16);
pub enum RetryLimitParse {
    Parsed(RetryLimit),
    Invalid(RetryLimitError),
}

impl From<u16> for RetryLimitParse {
    fn from(raw: u16) -> Self {
        reject_zero!(raw);
        Self::Parsed(RetryLimit(raw))
    }
}
```

**Preferred:** the branch and exit are visible inside the validating owner.

```rust
pub struct RetryLimit(u16);
pub enum RetryLimitParse {
    Parsed(RetryLimit),
    Invalid(RetryLimitError),
}

impl From<u16> for RetryLimitParse {
    fn from(raw: u16) -> Self {
        if raw == 0 {
            return Self::Invalid(RetryLimitError::Zero);
        }
        Self::Parsed(RetryLimit(raw))
    }
}
```

## Keep approved ecosystem macros

The restriction targets authored abstraction, not compiler and ecosystem support.
Keep Serde, thiserror, wasm-bindgen, Tsify, test attributes, and approved derives.
Standard formatting, logging, assertions, and collection macros remain allowed.
Review other external macros for whether they obscure ordinary Rust.

**Prohibited:** a local wrapper adds another name around a standard assertion.

```rust
macro_rules! assert_same {
    ($left:expr, $right:expr) => {
        assert_eq!($left, $right);
    };
}

// Inside a test:
assert_same!(actual, expected);
```

**Preferred:** use the standard macro directly.

```rust
// Inside the same test:
assert_eq!(actual, expected);
```

Generated/vendor source is outside this rule. Purpose-built external generation
libraries are allowed when producing code is the actual product requirement;
reducing ordinary application boilerplate is not that requirement. Any remaining
authored macro definition requires a documented architecture exception.

## Replace a macro without changing its contract

Inventory definitions and all call sites before expansion. Preserve public APIs,
serialized representations, error messages, and behavior. Do not use macro removal
as permission to change a protocol or type invariant.

**Prohibited:** expand a generated identifier but accidentally remove its
transparent Serde representation, changing a scalar into an object.

**Preferred:** preserve its Serde attributes and verify the same wire value,
then check every former macro call site against the explicit declarations.

## Validation

- Check macro definitions and call sites with available syntax-aware tooling;
  update preflight coverage when the project supplies that check.
- Compile both alternatives with their stated context; distinguish policy
  violations from compiler errors.
- Test conversion branches, validation failures, serialized output, error text,
  and public API compatibility affected by the replacement.
