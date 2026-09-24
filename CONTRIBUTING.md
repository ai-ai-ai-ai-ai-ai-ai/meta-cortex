# Contributing to Meta-Cortex

## Develop

### Source responsibilities

- **Rust workspace: [app/Cargo.toml](app/Cargo.toml)**
  - Owns dependency versions, shared features, pins, and local crate paths.
  - Member manifests select their dependencies with `workspace = true`.
- **Framework: [cortex/](cortex)**
  - Contains the distributable instructions, roles, skills, and configuration.
- **Installer: [app/installer/](app/installer)**
  - Contains the Rust CLI.
  - Embeds the framework at build time.
- **Workbench: [app/workbench/](app/workbench)**
  - Contains the embedded Turso feature ledger and coordination domain.
- **License: [LICENSE](LICENSE)**
  - Remains at the repository root.
  - Is included in installed framework copies.

Read this repository's [development instructions](AGENTS.md) before making changes.

### Run and validate locally

Rust integration tests and documentation checks require Bun and Vale on `PATH`.
Framework initialization installs missing tools; see the
[initialization prerequisites](README.md#initialize-your-project).

Run Cargo and dist commands from `app/`:

```sh
cd app
```

1. Discover commands and run a typed YAML request against an existing test project
   using the [README initialization example](README.md#initialize-your-project):

   ```sh
   cargo run --package meta-cortex -- list
   cargo run --package meta-cortex -- run --request /path/to/request.yaml
   ```

2. Check formatting, lint, and behavior:

   ```sh
   cargo fmt --all --check
   cargo check --locked --workspace --all-targets
   cargo clippy --locked --workspace --all-targets -- -D warnings
   cargo test --locked --workspace
   ```

3. Measure coverage with `cargo-llvm-cov` installed:

   ```sh
   cargo llvm-cov --locked --workspace --fail-under-lines 90
   ```

4. Verify the release build:

   ```sh
   cargo build --release --locked --workspace
   ```

### Check framework scripts and documentation

Run from the repository root after making framework changes:

```sh
cd cortex
bun install --frozen-lockfile --ignore-scripts
bun run verify
bun run docs:check
```

The documentation check reads actual Markdown files and fails on findings. Its
Vale styles ship with the framework, so checks require no style downloads.

## Publish a release

### Distribution tooling

[Cargo-dist](https://axodotdev.github.io/cargo-dist/book/) builds the platform
archives, shell installer, and Homebrew formula.

- **Configuration:** [app/dist-workspace.toml](app/dist-workspace.toml).
- **Release workflow:** [.github/workflows/release.yml](.github/workflows/release.yml), based on cargo-dist 0.32.0, with commands and artifact paths adjusted for `app/`.
- **Homebrew tap:** [homebrew-tap](https://github.com/ai-ai-ai-ai-ai-ai-ai/homebrew-tap), maintained separately.

The tap imports the formula from the latest public release.
Its workflow runs hourly and supports manual dispatch.
It uses its own GitHub Actions token; no cross-repository token is required.

### Release procedure

1. Install the pinned release tool:

   ```sh
   cargo install cargo-dist --version 0.32.0 --locked
   ```

2. Add the release variant and its explicit input/output mappings in
   [the release catalog](app/installer/src/information.rs). Update the workspace
   version in [app/Cargo.toml](app/Cargo.toml), regenerate [app/Cargo.lock](app/Cargo.lock),
   and update the independent report consumer's supported release enum in
   [the CLI tests](app/installer/tests/cli.rs). `Version::CURRENT` is resolved from
   the package version at compile time; an undeclared release fails compilation.
   Keep only the releases whose installed metadata this executable supports.
3. Run the local validation described above.
4. Update the release workflow if release configuration changed. CI generation is disabled
   with `allow-dirty = ["ci"]` to preserve its `app/` directory adjustments.
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
