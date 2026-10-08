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
- **Visualization: [app/visualization/](app/visualization)**
  - Contains the native Tauri window and read-only Workbench IPC.
  - Builds and embeds its Svelte/TypeScript frontend from `frontend/`.
- **License: [LICENSE](LICENSE)**
  - Remains at the repository root.
  - Is included in installed framework copies.

Read this repository's [development instructions](AGENTS.md) before making changes.

### Native dashboard prerequisites

The CLI and native dashboard ship as one executable. Tauri uses macOS’s system
WKWebView. Linux builds require GTK 3 and WebKitGTK 4.1 development packages;
installed Linux binaries also require the corresponding shared runtime libraries,
even for headless `list` and `run` commands. Follow the distribution-specific
[Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/#linux).
Opening the dashboard requires a graphical desktop session.

Install package-local frontend dependencies from the repository root:

```sh
cd app/visualization/frontend
bun install --frozen-lockfile
bun run verify
bun run test
bun run build
cd ../..
```

`verify` runs Prettier, TypeScript, ESLint with zero warnings, and Knip checks;
`test` runs Vitest with
jsdom. `build` typechecks and generates Vite assets in `frontend/dist`.
Ordinary Cargo builds also invoke `bun run build` before Tauri’s build step and
embed those assets in debug and release executables. The build watches frontend
sources, configuration, and lockfile. Install dependencies before invoking Cargo;
missing tools or dependencies produce a setup error. Generated `dist` assets are
not committed. No development server is needed for the embedded native window.

**Prohibited:** build a fresh checkout with Cargo before installing its frontend dependencies.

**Required:** run the frozen package-local Bun installation, then use the ordinary Cargo commands.

### Run and validate locally

Rust integration tests require mise, Bun, and Vale on `PATH`.
Test fixtures use them to populate isolated application homes.
The production installer uses only tools inside its application home.
Documentation checks require Bun and Vale.
Framework initialization installs missing tools; see the
[initialization prerequisites](README.md#initialize-your-project).

After preparing the native prerequisites and frontend dependencies above, run
Cargo and dist commands from `app/`:

```sh
cd app
```

1. Open Homeostat to browse existing application-home storage, discover commands,
   or run a typed YAML request against an existing test project using the
   [README initialization example](README.md#initialize-your-project):

   ```sh
   cargo run --package meta-cortex -- dashboard
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

The [YAML context authoring guidance](cortex/teams/ai-team/docs/context-authoring.md)
explains Cortex context declarations alongside the existing Markdown framework.
Context Engineering owns the
[authoring entry point](cortex/teams/ai-team/agents/tech-writer/skills/context-engineering/AGENTS.yaml)
and its examples. From `cortex/`, run `bun run context:check` to validate schemas
and references, or `bun run verify` for all workspace checks. The shared
[schema](cortex/scripts/src/ts/context-schema.ts) remains authoritative; ordinary
context authoring changes the assigned declarations without changing the checker.
Read declarations as text; validation never executes their command strings.

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
- PRs and `main` build the five release packages without publishing them.
  These package builds replace the check workflow's duplicate release build.
- Builds on `main` populate caches that later release tags can restore.
  GitHub does not share caches between different release tags.
- Only version-tag pushes publish a release. A miss in both Cargo's target cache
  and the remote compiler cache still compiles dependencies.
- macOS packages use GitHub-hosted Apple Silicon and Intel macOS runners.
- Native package jobs install and build the frontend before Cargo and local dist
  builds. The five macOS, Linux, and Windows targets ship the same executable with
  embedded frontend assets. Linux runner setup includes GTK 3/WebKitGTK 4.1.
- Windows x86-64 packages use a native Windows runner and ZIP archive.

### Wrapper source and release pins

The root `meta-cortexw` and `meta-cortexw.ps1` files are the canonical project
launchers. `.meta-cortex-version` selects an exact published executable release.
Their bootstrap uses that release's existing cargo-dist installer; it does not
require separate wrapper assets or a global command.

1. Keep [project acquisition and usage](README.md#add-the-project-wrapper)
   aligned with the canonical scripts and the committed pin.
2. When changing launcher source, update the immutable source revision used in
   the README acquisition examples after the source commit is available.
   Verify both scripts exist at that revision before presenting the downloads
   as available.
3. Advance the executable pin only after its versioned shell and PowerShell
   installers are published. Check first use and cached use against that exact
   release; retain the global installation instructions.

The current pin is `0.16.0`. Release `0.16.0` provides typed
`Framework / Wrapper` scaffolding; released `0.15.0` does not. Wrapper source
acquisition remains independent of the executable running that command.

**Prohibited:** document nonexistent wrapper release assets or advance the
bootstrap pin to an unpublished release.

**Required:** publish the ordinary cargo-dist release first, then verify and
commit an exact pin; obtain launchers from their inspected source revision.

### Distribution tooling

[Cargo-dist](https://axodotdev.github.io/cargo-dist/book/) builds the platform
archives, shell and PowerShell installers, and Homebrew formula.

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

5. Prepare frontend dependencies and assets with the native setup above. From
   `app/`, inspect the release plan and build a native package:

   ```sh
   dist plan
   dist build --artifacts=local
   ```

6. Commit the changes, including any generated workflow changes.
7. Push the matching `vX.Y.Z` tag to publish the GitHub release.
8. Trigger the tap's update workflow or wait for its scheduled run.
9. Verify the published version installs through Homebrew.

Local builds do not publish releases.

### Publish the Scoop manifest

Publish the Windows release before updating its Scoop manifest. The maintainer
updates `bucket/meta-cortex.json` manually after each public release, using Scoop's
[app manifest format](https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests).

1. Complete the release procedure above and verify that its Windows x86-64 ZIP
   downloads from the versioned GitHub release URL. Keep existing tags and assets
   intact. Do not use a local build URL or a placeholder checksum.
2. Download that public ZIP and calculate its SHA-256 in PowerShell. In this
   example, `$releaseZipUrl` is the verified public URL and `$releaseZipPath` is
   the absolute local download path:

   ```powershell
   Invoke-WebRequest -Uri $releaseZipUrl -OutFile $releaseZipPath
   Get-FileHash -Algorithm SHA256 -LiteralPath $releaseZipPath
   ```

3. Create or update `bucket/meta-cortex.json` in the source repository. Set the
   released `version`, homepage, description, and Apache-2.0 license. Under
   `architecture.64bit`, use that exact URL and SHA-256. Set `bin` to
   `meta-cortex.exe`. Confirm it is at the public ZIP root; use `extract_dir` only
   if the actual archive layout requires it. Keep the manifest limited to the
   executable. Do not add hooks that remove framework or application data.
4. Exercise the manifest on native Windows against the public download. Check
   installation, `meta-cortex list`, a typed Framework request, Scoop's installed
   package listing, update from an earlier published version when available,
   and uninstallation. For the first published Scoop version, exercise
   `scoop update meta-cortex --force` as a same-version reinstall and record that
   limitation; it does not demonstrate an upgrade from an older version.
   Record the manifest commit, release URL, checksum, command
   results, and any lifecycle path that could not be exercised. If download,
   hash verification, or a lifecycle check fails, correct it before publication.
5. Review and merge the manifest through the normal pull-request process. Verify
   the published bucket from a fresh Scoop installation. With Scoop already
   installed, these commands add this repository as a
   [custom bucket](https://github.com/ScoopInstaller/Scoop/wiki/Buckets) and install
   its package; run them only after the manifest is merged:

   ```powershell
   scoop bucket add meta-cortex https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex
   scoop install meta-cortex/meta-cortex
   meta-cortex list
   scoop list
   ```

6. Keep the [README Scoop instructions](README.md#scoop-windows-x86-64) aligned
   with the published bucket. For subsequent releases,
   repeat the URL, hash, native checks, and manifest review. Users refresh their
   bucket and update the installed command with:

   ```powershell
   scoop update
   scoop update meta-cortex
   ```

   [Scoop update](https://github.com/ScoopInstaller/Scoop/blob/master/libexec/scoop-update.ps1)
   follows the bucket's manifest version. Uninstall the Scoop-managed command with:

   ```powershell
   scoop uninstall meta-cortex
   ```

   [Scoop uninstall](https://github.com/ScoopInstaller/Scoop/blob/master/libexec/scoop-uninstall.ps1)
   removes its installation and command shim. The manifest must leave project
   `.meta-cortex/` directories and the separate application home untouched.
   Managed mise, Bun, Vale, and repository Workbench databases remain there.
   Updating the command does not replace an installed framework; use the
   [framework replacement procedure](README.md#replace-an-installed-framework).

**Prohibited:** publish a manifest pointing at an unreleased ZIP, or claim that
Scoop uninstall also removes framework and Workbench data.

**Required:** publish the exact public release URL and verified hash after native
checks pass. Preserve the separate application data when removing the command.
