# Rust Struct Construction

## No constructor indirection

Do not define `new` constructors. They hide field assignments behind another
function, making construction harder to read and reason about.
This restriction targets trivial construction. Preserve validating conversions,
invariant-enforcing fallible constructors, and legal capability transitions;
they must not expose unchecked fields merely to permit a literal.

## Single field: derive From

Use `#[derive(derive_more::From)]` for infallible wrappers instead of writing
the conversion by hand. Constrained wrappers use
[explicit classification enums](domain-types.md#classify-primitive-wrapper-input-with-explicit-states);
reserve `TryFrom<T>` for genuine representation conversions or required adapters.
For a generic workflow owner, implement only the permitted initial-state
conversion manually; a blanket derive would expose construction for every state.

Enable the crate’s `from` feature:

```toml
derive_more = { version = "2", features = ["from"] }
```

**Prohibited:**

```rust
pub struct RetryLimit(u32);

impl RetryLimit {
    pub fn new(value: u32) -> Self {
        Self(value)
    }
}

let limit = RetryLimit::new(3);
```

**Preferred:**

```rust
#[derive(derive_more::From)]
pub struct RetryLimit(u32);

let limit = RetryLimit::from(3);
```

## Multiple fields: use a struct literal

Named fields show what each value means without opening a constructor.
Renaming `new` to `create` adds the same unnecessary indirection.

**Prohibited:**

```rust
pub struct Transfer {
    pub source: AccountId,
    pub destination: AccountId,
    pub amount: Amount,
}

impl Transfer {
    pub fn new(source: AccountId, destination: AccountId, amount: Amount) -> Self {
        Self { source, destination, amount }
    }
}

let transfer = Transfer::new(source, destination, amount);
```

**Preferred:**

```rust
pub struct Transfer {
    pub source: AccountId,
    pub destination: AccountId,
    pub amount: Amount,
}

let transfer = Transfer { source, destination, amount};
```

Validated aggregates and workflow states still require their validating owner
or legal transition. A named fallible constructor may accept one typed request
when it enforces an aggregate invariant; renaming a trivial constructor does not
qualify. Follow the [domain construction rules](domain-types.md#aggregate-construction).
