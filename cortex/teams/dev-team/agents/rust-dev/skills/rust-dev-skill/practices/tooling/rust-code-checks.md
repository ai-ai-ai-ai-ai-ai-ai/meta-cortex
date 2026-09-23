# Rust Code Checks

## Required actions

### Establish repeatable checks

- Establish formatting, compilation, and Clippy checks for the consuming Rust project.
- Inspect the project's manifests, toolchain, Cargo configuration, and verification commands first.
- Extend the existing project-owned check entry point when a check is missing.
- Keep check commands reproducible for later work.
- Reuse existing automation.
- Keep pipeline changes with the CI/CD owner under the active development mode.
- Run checks from each applicable Cargo workspace or standalone crate root.

Baseline commands:

```sh
cargo fmt --all --check
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
```

- Run all three checks.
- Include the project's supported target and feature configurations.
  - `--all-targets` does not cover every target triple or enable every feature.
  - Check mutually exclusive features separately instead of blindly adding `--all-features`.
- Preserve required toolchain and build flags.
- Apply the [Option review requirements](../modeling/domain-states.md#review-the-option-prohibition).
- Complete the [domain-type review](../modeling/domain-types.md#validation),
  including private metadata and touched aggregates. Passing the mechanical
  gates does not complete that review.
- Deny compiler warnings during compilation as well as Clippy.
  - Use the project's existing lint configuration or compiler flags.

For example, in a project that uses `RUSTFLAGS` and does not set
`CARGO_ENCODED_RUSTFLAGS`, preserve existing flags while denying warnings:

```sh
RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }-D warnings" cargo check --workspace --all-targets
```

**Prohibited:** run only `cargo check` on the default package and declare the
workspace verified; it can succeed with warnings and omit other members.

**Preferred:** wire all three checks into the existing verification entry point,
deny warnings, and run each supported configuration required by the project.

### Enforce the lint baseline

- Add these settings to each package's `Cargo.toml`.
- For shared workspace settings, use `[workspace.lints]` and opt every member into `[lints] workspace = true`.
- Review the [Option prohibition](../modeling/domain-states.md#review-the-option-prohibition) separately.

```toml
[lints.rust]
unused_must_use = "deny"

[lints.clippy]
unwrap_used = "deny"
expect_used = "deny"
absolute_paths = "deny"
fn_params_excessive_bools = "deny"
struct_excessive_bools = "deny"
let_underscore_must_use = "deny"
let_underscore_future = "deny"
return_self_not_must_use = "deny"
result_unit_err = "deny"
wildcard_enum_match_arm = "deny"
too_many_arguments = "deny"
excessive_nesting = "deny"
```

- Add these thresholds to the project's `clippy.toml`.

```toml
absolute-paths-max-segments = 2
allow-expect-in-tests = false
allow-unwrap-in-tests = false
max-fn-params-bools = 0
max-struct-bools = 0
too-many-arguments-threshold = 2
excessive-nesting-threshold = 5
```

- Enforce [domain states](../modeling/domain-states.md) with the targeted boolean lints.
- Keep direct boolean parameters and struct fields at zero.
- Review boolean aliases, enum payloads, return values, containers, and stored locals manually.
- Preserve the permitted `From<bool>` boundary conversions.
- Do not claim these lints enforce a complete boolean ban.
- Review [serialization implementations and callbacks](../boundaries/serialization-boundaries.md#derive-serialization-instead-of-writing-boilerplate) for prohibited handwritten boilerplate.
- Enforce [error handling](../behavior/error-handling.md) with `result_unit_err`, `unused_must_use`, and `let_underscore_must_use`.
- Handle fallible results instead of discarding them.
- Review private APIs and error meaning manually; `result_unit_err` primarily checks public APIs.
- Await or explicitly manage asynchronous work instead of discarding futures with `let _`.
- Mark methods returning replacement `Self` values with `#[must_use]` under [owned updates](../behavior/owned-updates.md).
- Review fallible replacement methods manually; `return_self_not_must_use` does not cover every wrapper around `Self`.
- Name enum alternatives explicitly in `match` arms.
- Use partial matching only when permitted by [exhaustive matching](../modeling/domain-states.md#match-decisions-exhaustively).
- Review [API inputs](../behavior/api-inputs.md) for the one-nonreceiver-parameter limit.
- Set the argument threshold to two because Clippy counts `self`.
- Check associated and free functions manually; two nonreceiver parameters still pass this threshold.
- Use the nesting threshold of five as a structural backstop.
- Review decision depth separately under [function ownership](../../../../../../docs/programming/function-ownership.md).
- Account for enclosing modules, implementations, and function blocks in Clippy's nesting count.
- Do not equate five structural levels with five nested decisions.
- Do not raise thresholds or add allowances merely to pass the baseline.
- Verify these settings against the project's toolchain before reporting enforcement.

**Prohibited:** assume a passing Clippy run proves that every domain rule is satisfied.

**Preferred:** enforce the mechanical checks and review the documented gaps.

### Fix diagnostics before completion

- Require compilation to produce no warnings.
- Treat every compiler or Clippy warning as unfinished work.
  - Include pre-existing warnings encountered by the required checks.
- Correct each diagnostic's cause.
- Rerun the checks after the final edit.
- Run `cargo fmt --all` to repair formatting.
  - Verify the result with `--check` afterward.
- Also run the tests required by [Rust testing](rust-testing.md).
  - Compilation does not execute tests.

**Prohibited:** leave an unused import and accept a successful compile with
`warning: unused import`, or silence it using `#[allow(unused_imports)]`.

**Preferred:** remove the unused import, format the result, and rerun compilation
and Clippy with warnings denied.

- Do not hide diagnostics merely to pass checks.
  - Do not add lint allowances or warning caps for that purpose.
  - Do not suppress output or ignore failure exit codes.
- Fix dependency warnings through the owning dependency.
- Fix generated-code warnings through the owning generator.
- Report corrections outside the assigned scope as blockers for coordinated repair.
- Do not report successful completion while warnings remain unresolved.

```sh
# Prohibited: suppress diagnostics or turn a failed check into success.
RUSTFLAGS="-A warnings" cargo check
cargo clippy --workspace --all-targets -- -D warnings || true
```

```sh
# Preferred: after correcting the diagnosed code, preserve failure status.
cargo fmt --all --check &&
  cargo check --workspace --all-targets &&
  cargo clippy --workspace --all-targets -- -D warnings
```

The preferred sequence assumes the project's existing configuration denies
compiler warnings.

- Review command output for Cargo and build-script warnings.
  - Compiler lint settings do not necessarily promote these warnings to errors.

### Report verification evidence

- Report the commands actually run.
- Identify the workspace roots and target/feature configurations checked.
- Report the results actually verified.
- Report the [domain-type review](../modeling/domain-types.md#validation) scope
  and unresolved findings separately from mechanical check results.
- Require formatting, compilation, and Clippy checks to pass without warnings before completion.
- Report missing tools and unavailable targets as blockers.
- Report failed checks and unresolved diagnostics as blockers.

**Prohibited:** “Checks passed” after running only formatting, or “build passed”
while its output still contains warnings.

**Preferred:** “Formatting, compilation, and Clippy passed without warnings for
the workspace's default configuration. The required WASM check is blocked by
a missing target; verification remains incomplete.”
