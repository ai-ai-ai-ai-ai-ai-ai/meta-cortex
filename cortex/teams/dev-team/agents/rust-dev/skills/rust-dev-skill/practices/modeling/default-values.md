# Rust Default Values

## Choose a valid default

Use Rust’s built-in `#[derive(Default)]` when a type has a useful default.
Do not invent a default for required input or a state that needs validation.

## Structs: derive field defaults

Derive `Default` when every field’s default is the intended starting value.
Write a manual implementation only when the type needs different defaults.
Both alternatives use the same domain value for search text. An empty value is
valid; the private representation stays inside its value type.

```rust
#[derive(Default)]
pub struct SearchText(String);
```

**Prohibited:** handwrite what the derive already provides.

```rust
pub struct SearchQuery {
    pub text: SearchText,
}

impl Default for SearchQuery {
    fn default() -> Self {
        Self { text: SearchText::default() }
    }
}

let query = SearchQuery::default();
```

**Preferred:** an empty search query is a valid starting point.

```rust
#[derive(Default)]
pub struct SearchQuery {
    pub text: SearchText,
}

let query = SearchQuery::default();
```

## Enums: mark the default variant

Use `#[default]` on the intended unit variant. If the default variant carries
payload data, implement `Default` manually.

**Prohibited:** handwrite a unit-variant default.

```rust
pub enum SortOrder {
    Ascending,
    Descending,
}

impl Default for SortOrder {
    fn default() -> Self {
        Self::Ascending
    }
}

let order = SortOrder::default();
```

**Preferred:** declare the default beside the variant.

```rust
#[derive(Default)]
pub enum SortOrder {
    #[default]
    Ascending,
    Descending,
}

let order = SortOrder::default();
```
