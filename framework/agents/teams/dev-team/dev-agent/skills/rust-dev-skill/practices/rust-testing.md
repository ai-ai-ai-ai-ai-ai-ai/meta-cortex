# Rust Testing and Test Placement

Apply the [common testing practices](../../../../../../../skills/dev/coding-skill/practices/testing-pyramid-and-regression.md)
and [source-size limit](../../../../../../../skills/dev/coding-skill/practices/source-file-size.md).

## Domain and boundary tests

1. **Rust unit and property tests carry ~99% of functional domain coverage:**
   - Test event sourcing, causal DAG merge, projection replay, epoch rotation, cryptography, and multi-device sync in Rust.
   - Use colocated module tests for pure mechanics and crate `tests/*.rs` integration files for multi-device sync orchestration.
2. **WASM tests own typed browser boundaries:**
   - Test projections, DTOs, browser storage adapters, and Rust-owned policy
     exposed to JavaScript.
   - Do not duplicate portable domain algorithms in WASM tests.

Do not re-implement Rust domain rules in TypeScript for testing. Test domain
code directly in Rust; browser E2E cannot replace domain proof.

## Test placement

Tests must follow the same architecture. Rust unit tests belong in an inline
`#[cfg(test)] mod tests` inside the focused implementation module. Split the
production abstraction first, then colocate each abstraction's unit tests with
its new owning module.

Rust integration tests under the crate-level `tests/` directory remain
separate because they exercise the crate through its public boundary. Do not
relabel unit tests as integration tests merely to evade colocation.

Separate Rust unit-test files are prohibited even after splitting production
code. Check that no external unit-test modules remain under `src`. Do not
move `#[cfg(test)]` code out to evade the 1,000-line limit. Rust receives no
larger allowance.

### 90% Rust line coverage floor

Measure portable Rust crates together against a committed 90% line coverage
floor. Coverage below 90% fails the coverage gate.

- When under 90%, add Rust tests in the same task.
- At or above 90%, do not chase marginal line coverage; focus on behavior and invariants.

## Validation

- For portable domain bugs, write colocated Rust unit tests before the fix.
- For typed Rust/WASM bugs, test the narrow owning boundary.
- For cross-layer bugs, cover the affected Rust/WASM contract and user flow.
- Record Rust test results and the combined coverage result against the 90% floor.
