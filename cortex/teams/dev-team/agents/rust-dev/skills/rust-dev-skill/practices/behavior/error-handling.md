# Rust Error Handling

Preserve the meaning and source of each failure. Propagate typed errors until an owner can classify, recover, or present them.

## Required actions

- Return `Result<T, E>` for genuine fallible operations; name application failures
  with `thiserror` enums. Use infallible `From` for valid value classification,
  including [empty free-form text](../modeling/domain-states.md#represent-empty-prose-as-a-value).
- Preserve typed sources. Use `#[from]` and `?` for direct conversions.
- Use `map_err` only to add context or select the appropriate error variant.
- Classify constrained primitive-wrapper input with explicit enums; reject invalid
  classifications where the operation requires a usable value. Do not conceal
  classification behind `TryFrom`, `FromStr`, or a renamed `Result` constructor.
- In tests, return a concrete `Result` or `anyhow::Result` and propagate with `?`.
- Use `serde_json::Result<T>` when JSON encoding/decoding is the only failure.

## Propagate errors instead of panicking

Do not use `.unwrap()`, `.expect(...)`, or `.expect_err(...)`, including in tests.
Production libraries, binaries, examples, and build scripts use concrete errors.

These alternatives convert a boundary string into the numeric `RetryCount`.
This is a genuine representation conversion and may return `Result`. It is not
classification of a string-backed ID: those APIs must return
[explicit parse states](../modeling/domain-types.md#classify-primitive-wrapper-input-with-explicit-states),
with any `Result` adaptation isolated at the external boundary.

**Prohibited:** malformed input becomes a panic, so the caller cannot classify
or recover from the expected input error.

```rust
use std::num::ParseIntError;

pub struct RetryCount(u16);

impl TryFrom<&str> for RetryCount {
    type Error = ParseIntError;

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

## Add context only when it changes the error

`#[from]` cannot choose between two variants carrying the same source type.
Use `map_err` at the operation that knows which failure occurred. These method
fragments belong inside `DocumentFile`, whose `path` is a typed path wrapper.
`DocumentText` wraps `String` and implements `From<String>`.

**Prohibited:** erase the operation and source into a message.

```rust
use std::fs;

// Inside impl DocumentFile:
pub fn read(&self) -> Result<DocumentText, String> {
    fs::read_to_string(&self.path.value)
        .map(DocumentText::from)
        .map_err(|error| error.to_string())
}
```

**Preferred:** distinguish reading from writing while preserving the I/O source.

```rust
use std::{fs, io};

#[derive(Debug, thiserror::Error)]
pub enum DocumentFileError {
    #[error("could not read document")]
    Read(#[source] io::Error),
    #[error("could not write document")]
    Write(#[source] io::Error),
}

// Inside impl DocumentFile:
pub fn read(&self) -> Result<DocumentText, DocumentFileError> {
    let text = fs::read_to_string(&self.path.value)
        .map_err(DocumentFileError::Read)?;
    Ok(DocumentText::from(text))
}
```

For a single direct conversion, use `#[from]` as in `RetryCountError` above;
do not add `map_err` that repeats the generated conversion.

## Keep `anyhow` in tests

Use concrete errors in production. Tests combining unrelated error families may
use `anyhow::Result`; declare `anyhow` under `[dev-dependencies]`. Do not substitute
`Box<dyn std::error::Error>` as a catch-all test error.

These alternatives use the `RetryCount` and `RetryCountError` definitions above.

**Prohibited:** panic during fixture setup or error extraction.

```rust
#[test]
fn parses_retry_count() {
    let RetryCount(count) = RetryCount::try_from("3").unwrap();
    assert_eq!(count, 3);
}

#[test]
fn rejects_invalid_count() {
    let _error = RetryCount::try_from("invalid").err().unwrap();
}
```

**Preferred:** propagate unexpected failures and assert the expected variant.

```rust
#[test]
fn parses_retry_count() -> Result<(), RetryCountError> {
    let RetryCount(count) = RetryCount::try_from("3")?;
    assert_eq!(count, 3);
    Ok(())
}

#[test]
fn rejects_invalid_count() {
    assert!(matches!(
        RetryCount::try_from("invalid"),
        Err(RetryCountError::InvalidNumber(_))
    ));
}
```

## Validation

- Run the affected tests, including expected-error assertions.
- Run Clippy for all targets with `clippy::expect_used` and
  `clippy::unwrap_used` denied. Keep `allow-expect-in-tests` and
  `allow-unwrap-in-tests` false in `clippy.toml`.
- Check that `anyhow` appears only in test code and dev-dependencies. Use the
  project's preflight when available; do not duplicate Clippy with a custom scanner.
