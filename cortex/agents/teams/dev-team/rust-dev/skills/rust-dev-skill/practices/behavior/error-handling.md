# Rust Error Handling

Preserve the meaning and source of each failure. Propagate typed errors until an owner can classify, recover, or present them.

## Required actions

- When a missing value violates an invariant, add a precise `thiserror` variant.
  Return `Result<T, DomainError>` and propagate it with `?`.
- Production code returns, propagates, or explicitly classifies failure.
- Every fallible test returns a concrete or `anyhow::Result` and propagates with
  `?`, including locally constructed fixtures.
- Production libraries, binaries, examples, and build scripts use concrete
  `thiserror` enums with operation-specific variants and typed sources.
- Prefer `#[from]` and `?` for direct source-error conversions. Keep `map_err`
  when adding context or choosing between variants with the same source type.
- Test crates that use `anyhow` declare it under `[dev-dependencies]`.
- Use `serde_json::Result<T>` for codecs whose only failure is serde JSON.

- Retain Rust’s standard `Result<T, E>` for fallible operations.

## Prohibited actions

- Do not call `.unwrap()`, `.expect(...)`, or `.expect_err(...)` in authored
  Rust.
- Do not use `anyhow` in production libraries, binaries, examples, or build
  scripts. Restrict it to `#[cfg(test)]` unit tests and integration tests under
  `tests/`.

## Examples

These alternatives convert a boundary string into `RetryCount`.

**Prohibited:** malformed input becomes a panic, so the caller cannot classify
or recover from the expected input error.

```rust
pub struct RetryCount(u16);

impl TryFrom<&str> for RetryCount {
    type Error = std::num::ParseIntError;

    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        Ok(Self(raw.parse().unwrap()))
    }
}
```

**Preferred:** the failure names the operation and retains its typed source.
`#[from]` supplies the conversion used by `?` and preserves the source.

```rust
use std::num::ParseIntError;
use thiserror::Error;

pub struct RetryCount(u16);

#[derive(Debug, Error)]
pub enum RetryCountError {
    #[error("invalid retry count")]
    InvalidNumber(#[from] ParseIntError),
}

impl TryFrom<&str> for RetryCount {
    type Error = RetryCountError;

    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        let count = raw.parse()?;
        Ok(Self(count))
    }
}
```

## Validation

- Make fallible Rust tests return `Result<(), E>` and use `?` for setup and
  verification. Panic shortcuts are prohibited; do not replace one with
  another or hide it behind a helper.
- Do not use `Box<dyn std::error::Error>` as a catch-all test error. Return the
  concrete crate error for one error family, or `anyhow::Result` when the test
  intentionally combines unrelated error types.
- Run Clippy for all targets with `clippy::expect_used` and
  `clippy::unwrap_used` denied and workspace `clippy.toml` keeping
  `allow-expect-in-tests` / `allow-unwrap-in-tests` false. Clippy owns panic
  shortcuts; do not add a duplicate syn scanner. Run the syntax-aware
  preflight that rejects production `anyhow` paths and non-dev Cargo
  dependencies.
