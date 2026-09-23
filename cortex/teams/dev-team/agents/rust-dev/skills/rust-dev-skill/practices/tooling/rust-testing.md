# Rust Testing

## Domain and boundary tests

Keep functional domain coverage in portable Rust unit and property tests.
WASM tests check typed exports and browser adapters; browser E2E checks user
flows. Neither replaces tests of the Rust implementation.

These fragments assume `RetryLimitParse::from(u16)` classifies zero as
`RetryLimitParse::Invalid(RetryLimitError::Zero)` and positive values as
`RetryLimitParse::Parsed(RetryLimit)`. The value, classification, and error
implement `Debug` and `PartialEq`. Prohibited examples compile but test the
wrong thing.

**Prohibited:** duplicate the validation algorithm in the test. This passes
even if `RetryLimit` accepts zero.

```rust
#[test]
fn rejects_zero() {
    let result = match 0_u16 {
        0 => Err(RetryLimitError::Zero),
        value => Ok(value),
    };

    assert_eq!(result, Err(RetryLimitError::Zero));
}
```

**Preferred:** call the implementation and check its domain error.

```rust
#[test]
fn rejects_zero() {
    assert_eq!(RetryLimitParse::from(0), RetryLimitParse::Invalid(RetryLimitError::Zero));
}
```

Do not recreate the algorithm in TypeScript either. For a retry-limit feature,
place checks at their owning layer:

### Portable Rust

- **Prohibited:** rely only on clicking through a browser form.
- **Preferred:** test zero, valid limits, and domain invariants directly in Rust.

### WASM

- **Prohibited:** repeat every portable validation case at the WASM boundary.
- **Preferred:** check that the typed export preserves the domain error.

### Browser E2E

- **Prohibited:** treat a visible error message as proof of Rust validation.
- **Preferred:** check that the user can correct the input and continue.

## Test placement

Keep unit tests and test-only helpers in named child module files, separate from
implementation bodies. The implementation retains `#[cfg(test)] mod tests;`;
`<module>/tests.rs` holds the tests and accesses private items through `super`.
Use ordinary module declarations and the [named module layout](module-layout.md).
Do not introduce `mod.rs` or widen production visibility to move tests.
Executable documentation examples may remain in API doc comments.

**Prohibited — `src/retry_limit.rs`:**

```rust
#[cfg(test)]
mod tests {
    // Test bodies mixed into the implementation file.
    #[test]
    fn rejects_zero() {
        assert_eq!(super::RetryLimitParse::from(0), super::RetryLimitParse::Invalid(super::RetryLimitError::Zero));
    }
}
```

**Preferred — `src/retry_limit.rs`:**

```rust
#[cfg(test)]
mod tests;
```

**Preferred — `src/retry_limit/tests.rs`:**

```rust
use super::{RetryLimit, RetryLimitError, RetryLimitParse};

#[test]
fn rejects_zero() {
    assert_eq!(RetryLimitParse::from(0), RetryLimitParse::Invalid(RetryLimitError::Zero));
}

#[test]
fn accepts_positive_limit() -> Result<(), RetryLimitError> {
    let limit = match RetryLimitParse::from(3) {
        RetryLimitParse::Parsed(limit) => limit,
        RetryLimitParse::Invalid(error) => return Err(error),
    };

    assert_eq!(limit, RetryLimit(3));
    Ok(())
}
```

Test functions are test-harness entrypoints and may contain scenario setup,
actions, and assertions. Keep reusable test helpers on their owning fixture
types; do not recreate production algorithms in either location.

### Integration tests exercise public APIs

Use crate-level `tests/` for integration tests through the crate's public API.
Do not relabel private unit tests as integration tests to move them out of `src/`.
These alternative fragments assume a crate named `retry_policy` exports the
types above.

**Prohibited — `tests/retry_limit.rs`:** import the implementation file to
reach its internals.

```rust
#[path = "../src/retry_limit.rs"]
mod retry_limit;
```

**Preferred — `tests/retry_limit.rs`:** exercise the exported contract.

```rust
use retry_policy::{RetryLimitError, RetryLimitParse};

#[test]
fn public_api_rejects_zero() {
    assert_eq!(RetryLimitParse::from(0), RetryLimitParse::Invalid(RetryLimitError::Zero));
}
```

### Split production ownership before tests

The 1,000-line file limit applies to implementation and test files independently.
Separate test files do not excuse oversized production abstractions. Split
distinct production owners and keep each owner's tests in its child directory.

**Prohibited:** retain policy and limit logic in an oversized `retry_policy.rs`
and treat moving its tests as sufficient while the implementation remains oversized.

**Preferred:** separate policy behavior into `retry_policy.rs` and limit
validation into `retry_limit.rs`, with tests in `retry_policy/tests.rs` and
`retry_limit/tests.rs` respectively.

## Regression tests precede the fix

For a portable domain bug, add a test in the owning test module that fails before the fix and
passes after it. For a WASM bug, test the narrow owning boundary. For a
cross-layer bug, cover both the affected contract and the user flow.

**Prohibited:** call the broken operation without checking its result.

```rust
#[test]
fn zero_limit_regression() {
    let _ = RetryLimitParse::from(0);
}
```

**Preferred:** assert the behavior the fix must restore.

```rust
#[test]
fn zero_limit_regression() {
    assert_eq!(RetryLimitParse::from(0), RetryLimitParse::Invalid(RetryLimitError::Zero));
}
```

## 90% Rust line coverage floor

Measure portable Rust crates together against a committed 90% line-coverage
gate. Below 90%, add tests in the same task. At or above it, prioritize missing
behavior and invariants over marginal line coverage.

**Prohibited:** “Combined coverage is 88%; one crate reaches 95%, so the gate passes.”

**Preferred:** “Combined coverage is 88%; the gate fails. Add tests for the
uncovered validation and recovery behavior, then measure again.”

## Validation evidence

Report Rust test results and combined coverage against the floor. Identify
checks you did not run; passing tests alone do not establish coverage.

**Prohibited:** “Tests passed, so coverage is sufficient.”

**Preferred reporting example:** “Rust: 42 tests passed. Combined portable
line coverage: 92%, above the 90% floor. Browser tests were not run.”
