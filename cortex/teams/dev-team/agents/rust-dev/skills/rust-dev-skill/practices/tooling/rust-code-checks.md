# Rust Code Checks

## Required actions

### Establish repeatable checks

Establish formatting, compilation, and Clippy checks for the consuming Rust
project. Inspect its manifests, toolchain, Cargo configuration, and existing
verification commands first. Extend the existing project-owned check entry point
when any check is missing; keep the commands reproducible for later work.
Reuse existing automation. Pipeline changes belong with the CI/CD owner under
the active development mode.

Run from each applicable Cargo workspace or standalone crate root. The baseline
is:

```sh
cargo fmt --all --check
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
```

All three checks are mandatory. Include the project's supported target and
feature configurations; `--all-targets` does not cover every target triple or
enable every feature. Check mutually exclusive features separately instead of
blindly adding `--all-features`. Preserve required toolchain and build flags.
Use the project's existing lint configuration or compiler flags to deny compiler
warnings during compilation as well as Clippy.

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

Compilation must produce no warnings. Treat every compiler or Clippy warning
as unfinished work, including pre-existing warnings encountered by the required
checks. Correct the cause, then rerun the checks after the final edit. Run
`cargo fmt --all` to repair formatting and verify with `--check` afterward.
These checks supplement the tests required by
[Rust testing](rust-testing.md); compilation does not execute tests.

**Prohibited:** leave an unused import and accept a successful compile with
`warning: unused import`, or silence it using `#[allow(unused_imports)]`.

**Preferred:** remove the unused import, format the result, and rerun compilation
and Clippy with warnings denied.

Do not hide diagnostics with lint allowances, warning caps, suppressed output,
or ignored exit codes merely to pass checks. Fix dependency or generated-code
warnings through their owning dependency or generator. If a correction is outside
the assigned scope, report the blocker for coordinated repair; unresolved
warnings do not qualify as successful completion.

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

The preferred sequence assumes compiler warnings are denied by the project's
existing configuration. Review command output too: Cargo and build-script
warnings are not necessarily promoted by compiler lint settings.

### Report verification evidence

Report the commands, workspace roots, target/feature configurations, and results
actually verified. Completion requires successful formatting, compilation, and
Clippy checks with no warnings. Missing tools, unavailable targets, failed
checks, and unresolved diagnostics are blockers, not passing results.

**Prohibited:** “Checks passed” after running only formatting, or “build passed”
while its output still contains warnings.

**Preferred:** “Formatting, compilation, and Clippy passed without warnings for
the workspace's default configuration. The required WASM check is blocked by
a missing target; verification remains incomplete.”
