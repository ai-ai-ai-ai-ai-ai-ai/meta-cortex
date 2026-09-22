# Rust Testing

## Domain and boundary tests

Keep functional domain coverage in portable Rust unit and property tests.
WASM tests check typed exports and browser adapters; browser E2E checks user
flows. Neither replaces tests of the Rust implementation.

These fragments assume `RetryLimit::try_from(u16)` rejects zero with
`RetryLimitError::Zero` and accepts positive values. `RetryLimit` and its error
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
    assert_eq!(RetryLimit::try_from(0), Err(RetryLimitError::Zero));
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

Keep unit tests in an inline `#[cfg(test)] mod tests` in their implementation
module. Separate unit-test files under `src/` are prohibited.

**Prohibited — `src/retry_limit.rs`:**

```rust
#[cfg(test)]
mod tests; // Loads a separate unit-test file.
```

**Preferred — in the same file as `RetryLimit`:**

```rust
#[cfg(test)]
mod tests {
    use super::{RetryLimit, RetryLimitError};

    #[test]
    fn rejects_zero() {
        assert_eq!(RetryLimit::try_from(0), Err(RetryLimitError::Zero));
    }

    #[test]
    fn accepts_positive_limit() -> Result<(), RetryLimitError> {
        let limit = RetryLimit::try_from(3)?;

        assert_eq!(limit, RetryLimit(3));
        Ok(())
    }
}
```

Test functions are test-harness entrypoints. Keep reusable test helpers on
their owning fixture types.

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
use retry_policy::{RetryLimit, RetryLimitError};

#[test]
fn public_api_rejects_zero() {
    assert_eq!(RetryLimit::try_from(0), Err(RetryLimitError::Zero));
}
```

### Split production ownership before tests

The 1,000-line file limit includes inline tests. Split distinct production
abstractions, then colocate each one's tests; extracting tests is not a size fix.

**Prohibited:**

```text
src/
  retry_policy.rs        # Policy and limit logic; tests extracted to fit.
  retry_policy_tests.rs
```

**Preferred:**

```text
src/
  retry_policy.rs       # Policy logic and its inline tests.
  retry_limit.rs        # Limit validation and its inline tests.
```

## Regression tests precede the fix

For a portable domain bug, add a colocated test that fails before the fix and
passes after it. For a WASM bug, test the narrow owning boundary. For a
cross-layer bug, cover both the affected contract and the user flow.

**Prohibited:** call the broken operation without checking its result.

```rust
#[test]
fn zero_limit_regression() {
    let _ = RetryLimit::try_from(0);
}
```

**Preferred:** assert the behavior the fix must restore.

```rust
#[test]
fn zero_limit_regression() {
    assert_eq!(RetryLimit::try_from(0), Err(RetryLimitError::Zero));
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
