# Rust Struct Construction

Do not define `new` constructors. They hide field assignments behind another
function, making construction harder to read and reason about.

## Single field: derive From

Use `#[derive(derive_more::From)]` for infallible wrappers instead of writing
the conversion by hand. Write `TryFrom<T>` when validation can fail.

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

Validated workflow states still require their state transitions; do not expose
private fields to bypass them.
