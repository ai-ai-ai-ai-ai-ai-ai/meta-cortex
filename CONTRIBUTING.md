# Contributing to Meta-Cortex

## Develop

### Source responsibilities

- **Framework: [cortex/](cortex/)**
  - Contains the distributable instructions, roles, skills, and configuration.
- **Installer: [installer/](installer/)**
  - Contains the Rust CLI.
  - Embeds the framework at build time.
- **License: [LICENSE](LICENSE)**
  - Remains at the repository root.
  - Is included in installed framework copies.

Read this repository's [development instructions](AGENTS.md) before making changes.

### Run and validate locally

Run Cargo and dist commands from `installer/`:

```sh
cd installer
```

1. Run the installer against an existing test project:

   ```sh
   cargo run -- init /path/to/test-project
   ```

2. Check formatting, lint, and behavior:

   ```sh
   cargo fmt --check
   cargo clippy --all-targets -- -D warnings
   cargo test
   ```

3. Measure coverage with `cargo-llvm-cov` installed:

   ```sh
   cargo llvm-cov --fail-under-lines 90
   ```

4. Verify the release build:

   ```sh
   cargo build --release --locked
   ```

## Publish a release

### Distribution tooling

[Cargo-dist](https://axodotdev.github.io/cargo-dist/book/) builds the platform
archives, shell installer, and Homebrew formula.

- **Configuration:** [installer/dist-workspace.toml](installer/dist-workspace.toml).
- **Release workflow:** [.github/workflows/release.yml](.github/workflows/release.yml), based on cargo-dist 0.32.0, with commands and artifact paths adjusted for `installer/`.
- **Homebrew tap:** [homebrew-tap](https://github.com/ai-ai-ai-ai-ai-ai-ai/homebrew-tap), maintained separately.

The tap imports the formula from the latest public release.
Its workflow runs hourly and supports manual dispatch.
It uses its own GitHub Actions token; no cross-repository token is required.

### Release procedure

1. Install the pinned release tool:

   ```sh
   cargo install cargo-dist --version 0.32.0 --locked
   ```

2. Update the version in [installer/Cargo.toml](installer/Cargo.toml) and [installer/Cargo.lock](installer/Cargo.lock).
3. Run the local validation described above.
4. Update the release workflow if release configuration changed. CI generation is disabled
   with `allow-dirty = ["ci"]` to preserve its `installer/` directory adjustments.
   Keep those adjustments when adopting changes from a newer cargo-dist template.

5. Inspect the release plan and build a native package:

   ```sh
   dist plan
   dist build --artifacts=local
   ```

6. Commit the changes, including any generated workflow changes.
7. Push the matching `vX.Y.Z` tag to publish the GitHub release.
8. Trigger the tap's update workflow or wait for its scheduled run.
9. Verify the published version installs through Homebrew.

Local builds do not publish releases.
