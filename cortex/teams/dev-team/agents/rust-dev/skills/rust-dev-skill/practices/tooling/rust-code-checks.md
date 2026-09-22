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
- Require formatting, compilation, and Clippy checks to pass without warnings before completion.
- Report missing tools and unavailable targets as blockers.
- Report failed checks and unresolved diagnostics as blockers.

**Prohibited:** “Checks passed” after running only formatting, or “build passed”
while its output still contains warnings.

**Preferred:** “Formatting, compilation, and Clippy passed without warnings for
the workspace's default configuration. The required WASM check is blocked by
a missing target; verification remains incomplete.”
