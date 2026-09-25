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

Rust integration tests require mise, Bun, and Vale on `PATH`.
Test fixtures use them to populate isolated application homes.
The production installer uses only tools inside its application home.
Documentation checks require Bun and Vale.
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

### Local Rust compiler cache

Rust builds use sccache by default through the committed
[Cargo configuration](.cargo/config.toml). Install
[sccache](https://github.com/mozilla/sccache) (`brew install sccache` on macOS)
and provision `sccache-host`, `sccache-bucket`, `sccache-access-key`, and
`sccache-secret-key` under `~/.meta-cortex/credentials/` before building locally.
The [wrapper](scripts/rustc-sccache.sh) reads those files at runtime; credentials
never belong in Cargo configuration or Git. Restrict the credential files to
your user (`chmod 600`). If `META_CORTEX_HOME` is set, the wrapper reads its
`credentials/` directory instead.

Run Cargo from `app/` as usual. Every checkout uses the repository configuration;
no machine-local Cargo configuration is needed. The workspace's
[development profile](app/Cargo.toml) disables incremental compilation for dev
and its inherited test profile. Release profiles already disable it by default.
CI uses its configured sccache executable and Actions credentials; fork PRs
still use sccache with local storage when remote credentials are unavailable.

Sccache reads its storage configuration when its server starts. Stop an existing
server with `sccache --stop-server` before switching cache configuration or
credentials, after any active builds finish. Use `sccache --show-stats` to inspect
hits, misses, and cache read/write errors. Incremental compilation is disabled
because [sccache cannot cache incremental Rust builds](https://github.com/mozilla/sccache/blob/main/docs/Rust.md).
Linking and some other compiler invocations still run locally.

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

### Build caches

- CI caches Cargo downloads and compiled dependencies with
  [rust-cache](https://github.com/Swatinem/rust-cache).
- Checks, coverage, and release targets use separate Cargo target caches and a
  shared S3 compiler cache through [sccache](.github/actions/rust-sccache/action.yml).
  Cargo and sccache decide which artifacts can be reused across sources,
  toolchains, platforms, and compiler flags.
- The compiler cache uses HTTPS, the `meta-cortex/` object prefix, and region
  `us-east-1`. Repository Actions variables `SCCACHE_ENDPOINT` (including
  `https://`) and `SCCACHE_BUCKET` select the service. Actions secrets
  `SCCACHE_ACCESS_KEY_ID` and `SCCACHE_SECRET_ACCESS_KEY` supply authentication.
  Populate those secrets from the corresponding local credential files through
  standard input to `gh secret set`; never paste credentials into workflows.
- Fork and Dependabot PRs without those secrets use local sccache storage.
  No privileged PR trigger is used to grant them remote cache access.
- CI installs sccache 0.18.0, disables incremental Rust compilation, and reports
  cache statistics in the action's post-build step. Keep the generated release
  workflow's compiler-cache setup when updating cargo-dist.
- PRs and `main` build the four release packages without publishing them.
  These package builds replace the check workflow's duplicate release build.
- Builds on `main` populate caches that later release tags can restore.
  GitHub does not share caches between different release tags.
- Only version-tag pushes publish a release. A miss in both Cargo's target cache
  and the remote compiler cache still compiles dependencies.
- macOS packages use GitHub-hosted Apple Silicon and Intel macOS runners.

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
   [the CLI report consumer](app/installer/tests/cli/report.rs). `Version::CURRENT` is resolved from
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
