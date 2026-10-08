# Meta-Cortex

Meta-Cortex is a composable development platform that organizes teams of AI
agents to turn ideas and requirements into working software.

Your AI host supplies the models and execution tools. Meta-Cortex supplies the
agent roles, skills, practices, and coordination instructions used in your
project.

- [Get started](#get-started)
- [Use Meta-Cortex](#use-meta-cortex)
- [Update a project](#update-a-project)
- [Contribute and release](CONTRIBUTING.md)

## Get started

### Add the project wrapper

Commit `meta-cortexw`, `meta-cortexw.ps1`, and `.meta-cortex-version` in your
Git repository. The scripts bootstrap the exact executable version in the pin
file, so collaborators can use a fresh clone without installing a global command.
The current pin is `0.16.0`; it has no `v` prefix and does not select `latest`.
The wrapper accepts stable numeric release versions from `0.15.0` onward.

1. Obtain both launcher scripts from a fixed source revision that contains them.
   The wrapper scripts are source files, separate from executable release
   installers. Copy both files from an inspected source checkout, or download
   the fixed source revision below. Run these shell commands in the consuming
   project. Replace `/path/to/meta-cortex-source` with that checkout's absolute path:

   ```sh
   source_checkout=/path/to/meta-cortex-source
   cp "$source_checkout/meta-cortexw" "$source_checkout/meta-cortexw.ps1" .
   printf '%s\n' '0.16.0' > .meta-cortex-version
   chmod +x meta-cortexw
   ```

   In PowerShell, set `$sourceCheckout` to that checkout's absolute path, then
   copy the files and write the pin:

   ```powershell
   $sourceCheckout = 'C:\path\to\meta-cortex-source'
   Copy-Item (Join-Path $sourceCheckout 'meta-cortexw') .
   Copy-Item (Join-Path $sourceCheckout 'meta-cortexw.ps1') .
   Set-Content -Encoding ascii .meta-cortex-version '0.16.0'
   ```

   To download the same source files directly:

   ```sh
   source_revision=8e09fb1bee5633ba7f05ab6c53918a3401bdeaf7
   source_url="https://raw.githubusercontent.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/$source_revision"
   curl --proto '=https' --tlsv1.2 -fLsS "$source_url/meta-cortexw" -o meta-cortexw
   curl --proto '=https' --tlsv1.2 -fLsS "$source_url/meta-cortexw.ps1" -o meta-cortexw.ps1
   printf '%s\n' '0.16.0' > .meta-cortex-version
   chmod +x meta-cortexw
   ```

   In PowerShell:

   ```powershell
   $sourceRevision = '8e09fb1bee5633ba7f05ab6c53918a3401bdeaf7'
   $sourceUrl = "https://raw.githubusercontent.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/$sourceRevision"
   Invoke-WebRequest "$sourceUrl/meta-cortexw" -OutFile meta-cortexw
   Invoke-WebRequest "$sourceUrl/meta-cortexw.ps1" -OutFile meta-cortexw.ps1
   Set-Content -Encoding ascii .meta-cortex-version '0.16.0'
   ```

2. Commit the three files, including the shell script's executable permission.
   Git clients on Windows can record that permission with
   `git update-index --chmod=+x meta-cortexw` after staging it.
3. Discover the pinned executable's commands:

   ```sh
   ./meta-cortexw list
   ```

   ```powershell
   .\meta-cortexw.ps1 list
   ```

**Prohibited:** require a globally installed command solely to acquire the
first scripts, or treat the executable installer as a wrapper source download.

**Required:** acquire the scripts directly from their fixed source revision and
write the exact pin before invoking the wrapper.

### Run the pinned command

The first invocation downloads the versioned cargo-dist installer and uses it
to install the executable in the wrapper cache. The current `0.16.0` pin uses
`/releases/download/v0.16.0/meta-cortex-installer.sh` or
`/releases/download/v0.16.0/meta-cortex-installer.ps1` on this repository's
GitHub release. Later invocations reuse the cached executable after checking
that its `--version` matches the pin.

- macOS and Linux require `sh` and `curl`; ARM64 and x86-64 are supported.
- Windows x86-64 requires PowerShell and `Invoke-WebRequest`.
- The release installer selects and downloads the native package. Linux runtime
  requirements still apply; see [native prerequisites](CONTRIBUTING.md#native-dashboard-prerequisites).
- The default POSIX executable cache is
  `${XDG_CACHE_HOME:-$HOME/.cache}/meta-cortex/wrapper/<version>/meta-cortex`.
- The default Windows cache is
  `%LOCALAPPDATA%\meta-cortex\wrapper\<version>\meta-cortex.exe`.
- `META_CORTEX_WRAPPER_CACHE` overrides the cache root. The wrapper adds a
  version directory beneath that root.
- First use requires network access. A populated cache can be reused without
  downloading the executable again; framework initialization has its own
  tool and dependency requirements below.

The wrapper forwards arguments and the executable's exit status. It keeps the
caller's working directory, including when called from a subdirectory:

```sh
./meta-cortexw run --request request.yaml
cd src
../meta-cortexw run --request ../request.yaml
```

Relative request paths resolve from that working directory. YAML `project`
continues to name the explicit project. Bootstrap failures stop before command
execution; inspect the diagnostic, correct the pin or download problem, and
retry. A missing or malformed pin and a cached executable version mismatch
are errors.

**Prohibited:** run `../meta-cortexw run --request request.yaml` from `src/`
when the request exists only in the repository root.

**Required:** pass `../request.yaml` from `src/`, or invoke the wrapper from the
root with `request.yaml`.

### Install a global command

A global command remains optional. Choose one installation method.

**Homebrew**

```sh
brew tap ai-ai-ai-ai-ai-ai-ai/tap
brew install ai-ai-ai-ai-ai-ai-ai/tap/meta-cortex
```

**Shell installer (macOS and Linux)**

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases/latest/download/meta-cortex-installer.sh | sh
```

**PowerShell installer (Windows x86-64)**

Run this command in PowerShell:

```powershell
irm https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases/latest/download/meta-cortex-installer.ps1 | iex
```

Prebuilt binaries are available for macOS and Linux on ARM64 and x86-64,
and for Windows on x86-64.
See [GitHub Releases](https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases)
for downloadable artifacts.

#### Scoop (Windows x86-64)

Install [Scoop](https://scoop.sh/) using its official setup instructions. In
PowerShell, install Git if it is not already available:

```powershell
scoop install git
```

Add the Meta-Cortex bucket and install its command:

```powershell
scoop bucket add meta-cortex https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex
scoop install meta-cortex/meta-cortex
meta-cortex list
```

The bucket installs the native Windows x86-64 executable and makes
`meta-cortex` available on `PATH`. Initialize your Git project with the typed
request below. Framework initialization installs the managed mise, Bun, and Vale
tools separately from Scoop.

### Initialize your project

Create `request.yaml` with an existing Git project directory and explicit harness choices:

```yaml
version: 1
project: /path/to/project
operation:
  group: Framework
  command:
    name: Initialize
    arguments:
      harness: codex
      instructions: write
```

Then run from your project:

```sh
./meta-cortexw run --request request.yaml
```

In PowerShell, run `.\meta-cortexw.ps1 run --request request.yaml`.
The global `meta-cortex` command accepts the same arguments.

Use `harness: none` and `instructions: skip` to install only the framework.
Initialization installs `.meta-cortex/` with the bundled model and reasoning-effort
settings, without terminal prompts. Edit `.meta-cortex/meta-cortex.toml` if your
host needs different models or reasoning efforts. Repeating the request preserves valid project
settings and does not replace a modified framework.

Initialization requires a Git repository. It uses its own tools under
`~/.meta-cortex` (`$HOME\.meta-cortex` in PowerShell) and ignores copies on the user's `PATH`.
It installs missing tools in this order:

1. Install mise through its [official installer](https://mise.jdx.dev/installing-mise.html#https-mise-run)
   into `~/.meta-cortex/mise/bin/mise` on macOS and Linux. Windows uses the
   official standalone mise release executable at
   `$HOME\.meta-cortex\mise\bin\mise.exe`.
2. Use mise's `install-into` command to install Bun into `~/.meta-cortex/bun`
   and Vale into `~/.meta-cortex/vale/bin`.
3. Use Bun to install the shared framework dependencies.

- Runtime versions come from [cortex/mise.toml](cortex/mise.toml).
  The installer embeds this file at build time; CI reads it directly.
- All repositories and worktrees share these tool installations.
- Tool installation stays inside the application directory; no global tool
  installation or shell activation is performed.
- Mise's data, cache, configuration, and state directories stay under `~/.meta-cortex/mise`.
- `META_CORTEX_HOME` overrides the application directory.
- On macOS and Linux, bootstrapping mise uses `curl`, `sh`, and the official installer's platform requirements.
- Windows bootstrapping downloads the pinned official mise executable with `curl`.
  Bun and Vale use managed `bin\bun.exe` and `bin\vale.exe` paths.
  Initialization does not require WSL or Git Bash.
- Setup leaves shell configuration unchanged and ignores the user's `BUN_INSTALL`.

For framework script commands in a new shell:

```sh
export PATH="${META_CORTEX_HOME:-$HOME/.meta-cortex}/mise/bin:${META_CORTEX_HOME:-$HOME/.meta-cortex}/bun/bin:${META_CORTEX_HOME:-$HOME/.meta-cortex}/vale/bin:$PATH"
```

In PowerShell, use the managed tool directories with Windows path separators:

```powershell
$metaCortexHome = if ($env:META_CORTEX_HOME) { $env:META_CORTEX_HOME } else { Join-Path $HOME '.meta-cortex' }
$env:PATH = "$metaCortexHome\mise\bin;$metaCortexHome\bun\bin;$metaCortexHome\vale\bin;$env:PATH"
```

**Prohibited:** paste the shell's `export PATH=...` command into PowerShell.

**Required:** assign `$env:PATH` as above so PowerShell can find the managed tools.

- The request's `mise`, `bun`, and `vale` arguments each default to `InstallMissing`.
- Set a tool's argument to `RequireExisting` to require an existing copy in the
  application directory.
- An existing tool that cannot run produces an error without replacement.
- Tool setup failures return structured errors before writing framework or harness
  instruction files. Downloaded tool files can remain for inspection.

After the tools are ready, initialization runs the shared dependency installation:

```sh
bun install --frozen-lockfile --ignore-scripts
```

All framework scripts share that workspace's `node_modules`; individual skills
do not install dependencies. Repeating initialization also restores missing dependencies.
Effect guidance comes directly from `.meta-cortex/node_modules/effect/AGENTS.md`.
Dependency installation requires network access or a populated Bun cache.
Installing or initializing Meta-Cortex does not start agents. Run `./meta-cortexw list`
to discover every operation, its typed schema, and a complete request example.
`./meta-cortexw run --request -` reads a request from stdin.

### PowerShell typed requests

Use the project wrapper for the examples below. A global `meta-cortex` command
can receive the same arguments. Use the same YAML command schema on Windows. Set `project` to an absolute Git
repository path such as `'C:\projects\my-app'`. Single-quoted PowerShell
here-strings preserve the YAML literally:

```powershell
.\meta-cortexw.ps1 list
@'
version: 1
project: 'C:\projects\my-app'
operation:
  group: Framework
  command:
    name: Initialize
    arguments:
      harness: codex
      instructions: write
'@ | .\meta-cortexw.ps1 run --request -
```

To inspect the project through a request file:

```powershell
@'
version: 1
project: 'C:\projects\my-app'
operation:
  group: Framework
  command:
    name: Info
    arguments: {}
'@ | Set-Content -Encoding utf8 info.yaml
.\meta-cortexw.ps1 run --request info.yaml
```

Open the native Workbench dashboard from your repository root:

```powershell
.\meta-cortexw.ps1 dashboard
```

From an immediate `src` subdirectory, address the root launcher explicitly:

```powershell
Set-Location src
..\meta-cortexw.ps1 dashboard
```

For any other subdirectory, use the actual relative or absolute path to the
launcher. The caller's directory remains the dashboard's repository context.

No request file or required arguments are needed. For headless text output,
use an explicit project with `mode: Snapshot`:

```powershell
@'
version: 1
project: 'C:\projects\my-app'
operation:
  group: Workbench
  command:
    name: Dashboard
    arguments:
      mode: Snapshot
      view: {kind: Features}
      page: 0
'@ | Set-Content -Encoding utf8 dashboard.yaml
.\meta-cortexw.ps1 run --request dashboard.yaml > dashboard-output.yaml
```

Use `mode: Desktop` without `view` or `page` to open the native window for that project.
Workbench observation requires an existing repository
identity and ledger; initialization of the framework alone does not create a ledger.

### Harness instruction files

- **Codex:** uses an existing nonempty `AGENTS.override.md`, otherwise `AGENTS.md`.
- **Claude:** uses `CLAUDE.md`, or an existing `.claude/CLAUDE.md`.
- **Cursor:** uses `.cursor/rules/meta-cortex.mdc`, then an existing `.cursorrules`
  or `AGENTS.md`. Otherwise creates `.cursor/rules/meta-cortex.mdc` with
  `alwaysApply: true`.

Select the harness and set `instructions: write` in the request to update it.
Existing instructions are preserved. Repeated initialization updates the same
managed block without duplicating it. Skipping leaves any existing block in place.
The managed section uses a YAML header and Markdown delimiters:

```markdown
---
meta-cortex: instructions
---

Read and follow [.meta-cortex/AGENTS.md](.meta-cortex/AGENTS.md).

---
```

Other project content stays unchanged.
Cursor's `alwaysApply` frontmatter remains separate from this section.

Cursor frontmatter is parsed as YAML and must set `alwaysApply: true`. Existing
formatting and comments are preserved. Malformed frontmatter or managed blocks
are rejected rather than overwritten. Markers inside code examples are ignored.

### Inspect a project

Save an inspection request as `info.yaml`:

```yaml
version: 1
project: /path/to/project
operation:
  group: Framework
  command:
    name: Info
    arguments: {}
```

```sh
./meta-cortexw run --request info.yaml > meta-cortex-info.yaml
```

The operation returns a versioned YAML response containing the project report.

Example output (paths and versions depend on the installation):

```yaml
version: 1
result:
  status: success
  data:
    kind: framework_info
    value:
      schema_version: 5
      cli_version: 0.10.0
      framework_version: 0.10.0
      paths:
        project: /path/to/project
        framework: /path/to/project/.meta-cortex
        configuration: /path/to/project/.meta-cortex/meta-cortex.toml
      integrations:
        - harness: Codex
          path: /path/to/project/AGENTS.md
          status: Connected
        - harness: Claude
          path: /path/to/project/CLAUDE.md
          status: Missing
        - harness: Cursor
          path: /path/to/project/AGENTS.md
          status: Connected
      models:
        gizmo-prime:
          model: gpt-6-luna
          reasoning_effort: max
        team:
          gizmo:
            model: gpt-6-luna
            reasoning_effort: max
          agent:
            model: gpt-6-luna
            reasoning_effort: max
      model_availability: NotChecked
```

- `schema_version` identifies the output contract; incompatible changes increment it.
- `framework_version` identifies a release declared in the executable's typed
  release catalog, serialized as semantic-version text. Missing, malformed, or
  unsupported installed version metadata produces an error.
- `integrations` reports each harness's resolved instruction file and managed-block
  status: `Connected`, `Missing`, or `Conflict`. Multiple harnesses can share a file;
  this reports file contents, not which harness is running.
- `models` preserves the configuration's role names and reports model and reasoning effort.
- `model_availability: NotChecked` means the command has not queried your AI host.

These are requested settings, not evidence of an agent's runtime configuration.
The [agent configuration rules](cortex/teams/gizmo-team/docs/agent-configuration.md#use-the-host-speed-setting)
leave speed to the host session. Select Fast in the host before launching agents;
Meta-Cortex does not configure or override the service tier. Remove `mode` and
`service_tier` from role sections; both fields are rejected. The CLI report uses
schema version 5 and reports only model and reasoning effort for each role.
Actual processing-tier verification requires host runtime metadata.

Inspection does not modify project files. Failures produce a structured error
response on stdout with exit status 2.

### What gets installed

- **Executable**
  - Homebrew manages it under the prefix shown by `brew --prefix`.
  - The command is available through that prefix's `bin/` directory.
- **Project framework**
  - Initialization writes the framework to `<project>/.meta-cortex/`.
  - The current directory is the default project.
- **Project entry point**
  - With your approval, initialization adds a managed block to the selected harness file.
  - The block directs the host to `.meta-cortex/AGENTS.md`.
  - Existing project instructions are preserved.

## Use Meta-Cortex

Give your AI host a development task in the initialized project.
In Codex, the current agent asks at the start of every new session whether to use
`single_agent` (this thread and agent) or `multi_agent` (Gizmo coordination), and
whether delivery should `create_pr` (recommended) or stay `local_only`.
Tasks and follow-ups in that conversation retain both choices. Configuration uses native
questions and the library's Bun helper; see the
[setup and configuration instructions](cortex/README.md#execution-configuration).
Read the [framework guide](cortex/README.md) for project context, agent
coordination, model configuration, and agent skills.
The [coordination state machine](cortex/teams/gizmo-team/docs/coordination-state-machine.md)
is the evolving framework architecture and human handoff specification.

## Develop the application

The [Rust workspace](app/Cargo.toml) contains three crates:

- [installer](app/installer): the `meta-cortex` executable, framework installation,
  command discovery, and typed YAML transport.
- [workbench](app/workbench): the `meta-cortex-workbench` library for durable agent
  tasks, claims, progress, Git checkpoints, and repository-wide Turso ledgers. It owns
  database migrations and storage tests; installer uses its public API.
- [visualization](app/visualization): the `meta-cortex-visualization` library for
  the native Tauri dashboard with embedded Svelte/TypeScript assets, using
  Workbench’s read-only observation API.

Install the dashboard’s package-local dependencies once before Cargo builds:

```sh
cd app/visualization/frontend
bun install --frozen-lockfile
cd ../..
```

Ordinary Cargo builds run the frontend TypeScript/Vite build and embed its assets.
See [native build prerequisites](CONTRIBUTING.md#native-dashboard-prerequisites).
From `app/`, run:

```sh
cargo fmt --all --check
cargo check --locked --workspace --all-targets
cargo clippy --locked --workspace --all-targets -- -D warnings
cargo test --locked --workspace
cargo llvm-cov --locked --workspace --fail-under-lines 90
cargo build --release --locked --workspace
```

Run `cargo run -p meta-cortex -- list` from `app/` to inspect agent commands.
The binary is built at `app/target/release/meta-cortex`
(`app\target\release\meta-cortex.exe` on Windows). Release configuration
lives in [app/dist-workspace.toml](app/dist-workspace.toml); only the executable
is distributed. The [framework source](cortex/) remains at the repository root.

### Dashboard projection boundary

The native dashboard reads the existing ledger through the public Workbench
observation API. The frontend's `dashboard_workflow` invocation reaches the
[Tauri command handler](app/visualization/src/dashboard/desktop.rs), which calls
`Workbench::observe` and `Observation::workflow` to return `FeatureWorkflow`.
The handler remains a transport adapter; Workbench owns the read-only Turso
access and the meaning of the returned workflow.

- **Workbench:** derive recorded state windows, worker UUID groups and legacy
  role groups, their order, and historical attribution. Supply each piece's
  task objective, progress or blocked reason, timestamps, and numeric duration
  from the corresponding recorded history. Preserve task chapters and event
  history for the Log view.
- **Visualization:** consume that projection through the generated Rust JSON
  Schema and TypeScript contract. Svelte/TypeScript owns pixel geometry, visual
  lanes, CSS, icons, hover and navigation behavior, and date/duration string
  formatting. It does not reconstruct domain windows or worker attribution.
- **Shared observation:** keep these derivations in Workbench so native and
  Snapshot consumers use the same recorded meanings. The projection adds no
  database format, alternate backend, or separate service.

**Prohibited:** derive a second timeline in TypeScript by grouping raw events
under each task's latest worker, then fill older cards with current progress.

**Required:** use Workbench's historical groups and pieces; map their timestamps
to pixels and format their numeric durations in the frontend. Keep the original
history available for Log navigation.

#### Verification evidence

Validate the native command path with Tauri's `MockRuntime` against a real
repository ledger, checking the handler's projected reply and read-only behavior.
That establishes command-to-Turso integration; it does not establish native
window rendering. Report rendered-window or browser visual checks separately.

**Prohibited:** report a passing mocked-runtime command test as proof that a
native window rendered correctly.

**Required:** report the command-path result and the actual visual environment,
such as a browser preview; identify native-window rendering as unverified when
it was not exercised.

## Update a project

Updating the executable and updating a project's framework are separate actions.
An existing `.meta-cortex/` directory does not change when Homebrew or Scoop
updates the command.

### Upgrade the project pin

1. Choose an exact published stable release at or above `0.15.0` and edit
   `.meta-cortex-version`, for example replacing `0.15.0` with `0.16.0`.
   Keep only the version and a trailing newline. Earlier releases, prerelease
   suffixes, build metadata, and leading-zero components are unsupported.
2. Run `./meta-cortexw list` or `.\meta-cortexw.ps1 list`. The wrapper installs
   that version in its separate cache directory and checks its identity.
3. Review and commit the pin change. Collaborators receive it through Git and
   bootstrap the same executable on their next invocation.

Changing the pin leaves the installed project framework untouched. Follow
[framework replacement](#replace-an-installed-framework) when that also needs
an upgrade. Updating a global command does not change the wrapper's pin.
Update launcher source deliberately from an inspected source revision when
the launcher itself changes; review and commit those files separately from
choosing the executable release.

**Prohibited:** replace the pin with `latest` or expect a Homebrew upgrade to
change the committed pin.

**Required:** commit the exact published version and validate it through the
project wrapper.

### Scaffold with the command

Release `0.16.0` provides typed `Framework / Wrapper` scaffolding. Released
`0.15.0` cannot execute it. Use direct source acquisition above when no capable
executable is installed, or discover `Framework / Wrapper` through `list` before
using this request:

```yaml
version: 1
project: /path/to/project
operation:
  group: Framework
  command:
    name: Wrapper
    arguments:
      release: '0.16.0'
```

The capable executable writes the two launchers and exact pin into the project.
It refuses existing wrapper files; edit an existing pin deliberately to upgrade.
The `release` argument chooses the executable to bootstrap, independently of
the executable running the scaffolding request.

**Prohibited:** send this request to released `0.15.0` and claim wrapper setup
is supported there.

**Required:** obtain the first launchers from source, or use a published release
whose `list` output advertises `Framework / Wrapper`.

### Upgrade a global command

For a Homebrew installation:

```sh
brew upgrade ai-ai-ai-ai-ai-ai-ai/tap/meta-cortex
```

For a shell or PowerShell installation, rerun the corresponding installer above.

For a Scoop installation, refresh the bucket and update the command:

```powershell
scoop update
scoop update meta-cortex
```

### Remove the Scoop command

```powershell
scoop uninstall meta-cortex
```

Uninstalling removes the Scoop-managed executable and command shim. It leaves
project `.meta-cortex/` directories and the application home intact, including
managed mise, Bun, Vale, and Workbench databases. `META_CORTEX_HOME` selects a
custom application home; otherwise it is `$HOME\.meta-cortex` on Windows.

### Replace an installed framework

Automated framework upgrades are not implemented yet.

1. Back up the project's `.meta-cortex/` directory.
2. Move the existing directory out of the installation path.
3. Run a `Framework / Initialize` YAML request with the new executable.
4. Review and reapply your configuration changes.

Repeated initialization succeeds when the installed framework is unchanged and
matches the executable's bundle, allowing valid changes to `meta-cortex.toml`.
Initialization refuses to overwrite a different version, edited framework files,
invalid configuration, or symbolic links.

If initialization reports `missing required framework entry`, the existing
directory is incomplete or uses an older framework layout. The error names the
missing path. Follow the replacement steps above; upgrading the Homebrew command
alone does not replace that directory. Initialization leaves the existing files
in place.

If a filesystem error interrupts initialization, inspect and move the incomplete
installation before retrying.

## Agent work ledger

The `meta-cortex` binary includes an embedded Turso ledger at
`~/.meta-cortex/<repo-name>/<repo_id>/features/<feature>.db`. Each feature has
its own database, shared by its agents and linked worktrees. Framework or feature
initialization generates a UUID once in the main checkout's
`.meta-cortex/repository-id`. Initialization from any linked worktree reuses that
ID. The file is locally ignored by Git, so a fresh clone gets a new identity;
repositories with the same name remain separate. Repeated initialization and
renaming the checkout preserve the ID and the existing named data directory.
Bun is shared across repositories at `~/.meta-cortex/bun`; Vale is shared at `~/.meta-cortex/vale`.
`META_CORTEX_HOME` overrides the application directory. Keep the identity file when replacing an installed framework or
restoring a repository whose ledgers you want to retain.
Database files and their engine-managed sidecars are persistent state; keep them
together when backing up or moving them. Application storage is outside `.git`.

```sh
./meta-cortexw list
./meta-cortexw run --request request.yaml
```

`list` prints typed command schemas and complete YAML requests. `run` accepts a
request file or `--request -` for stdin and emits a versioned YAML response. It
supports durable assignments, atomic claims, progress/checkpoints, history, and
integration records, framework initialization, and project inspection.

See the [agent ledger protocol](cortex/teams/gizmo-team/docs/agent-ledger.md) for
ownership, recovery, version compatibility, and local storage boundaries.

- **Prohibited:** continue feature `alpha` by opening another feature’s database
  or creating a new ledger for each worker checkout.

- **Required:** pass `alpha` and the consuming project path so linked worktrees
  resolve the same `features/alpha.db` ledger.

### Observe recorded work

From your repository root, run:

```sh
./meta-cortexw dashboard
```

From an immediate `src` subdirectory, address the root launcher explicitly:

```sh
cd src
../meta-cortexw dashboard
```

- Use the actual relative or absolute launcher path from any other subdirectory.
- A linked worktree uses its checked-out root launcher in the same way.
- The wrapper preserves the caller's directory, so the executable resolves that
  repository or linked worktree.

**Prohibited:** use `./meta-cortexw dashboard` from `src/` when the launcher
exists only at the repository root.

**Required:** use `../meta-cortexw dashboard` from that immediate subdirectory,
or supply the launcher's actual path from a deeper directory.

- No request file or required arguments are needed.
- The command resolves the existing repository identity and feature storage,
  then opens the native Tauri Workbench window. Close the window to exit.
- The executable embeds the dashboard assets and reads through native IPC;
  no HTTP server is required.

The always-visible **Agent guide** button in the top bar opens the roles graph
inside the same native window, including when the ledger catalog is empty.
Select any catalog agent to read its canonical role documentation beside the
graph. After following a bundled document link, **Back to agent document**
returns to the selected role document. **Workbench** returns to the feature journal.
The executable bundles the guide at build time from the shipped framework's
canonical `cortex/teams/*/agents/*/AGENTS.md` files. It does not load a localhost
server or retained preview JSON at runtime.

- **Prohibited:** require a recorded feature or a localhost preview to read an agent role.
- **Required:** open **Agent guide**, select a catalog agent, and read its bundled role documentation even with an empty feature catalog.

The window opens on a split feature preview. Compact cards show the title,
precise first-task date, expandable description, task progress, recorded roles,
and pull requests. Selecting a card opens a briefing with task inventory,
latest recorded update, start and finish times, elapsed duration, and branch.
Each inventory block opens that task's **Log** chapter in the full workflow.

**Open workflow** opens on **Feature log**, a compact journal of explicit
implementation outcomes after their owning Git tasks integrate. Expand a row
for checkpoint and integration evidence or follow its task link to **Log**.
The canonical [Feature log guidance](cortex/teams/gizmo-team/docs/agent-ledger.md#feature-log)
defines inclusion, milestone identity, recorder attribution, and labeled times.

The shared agent/task index navigates **Log** and **Time windows**. **Log** presents
task chapters with distinct action icons, time and revision metadata, and
expandable commands, findings, next steps, checkpoints, and saved details.
**Time windows** compares task lifetimes from creation to their latest recorded
update. Overlap does not prove continuous agent execution. Select a window to
jump to its log. Repeated evidence appears only when it changes.

- **Prohibited:** expect completed review tasks or undeclared historical progress
  to appear as implementation outcomes.
- **Required:** record explicit outcomes under the
  [checkpoint protocol](cortex/teams/gizmo-team/docs/agent-ledger.md#record-implementation-outcomes)
  and inspect their integration evidence in Feature log.

- The dashboard refreshes summaries every five seconds; Pause stops automatic
  reads and Refresh reads at once.
- Selected workflow history refreshes when its recorded activity changes.
- Automatic reads use read-only multiprocess WAL connections; no HTTP server or
  automatic database migration is involved.

Pull requests come exclusively from URLs saved in task progress extensions,
such as `pr_url`; clicking one opens the system browser. Feature start means
first task creation. Finish means all tasks are closed, using their terminal
events rather than later annotations; duration includes pauses. These values
do not establish separate feature acceptance. The feature list covers the 100
most recently active features and reports when more exist; a selected workflow
loads every task and history page.

Run `./meta-cortexw list` for advanced typed `Workbench / Dashboard` requests with
an explicit project. `mode: Desktop` opens the native window; `mode: Snapshot`
with a `view` and `page` returns headless text through
`./meta-cortexw run --request dashboard.yaml > dashboard-output.yaml`.
The dashboard observes recorded ledger content; event actors identify who
recorded evidence and do not establish Git authorship. See the canonical
[dashboard guidance](cortex/teams/gizmo-team/docs/agent-ledger.md#workbench-dashboard)
for exact typed requests, views, fields, paging, refresh, and storage requirements.
The command reports errors outside Git or when repository identity is missing.
An absent `features/` directory produces an empty catalog. Only the resolved
repository’s `features/<id>.db` files are read; older storage layouts are ignored
and left untouched. Opening and refreshing the dashboard never migrate storage.
Supported older features remain listed with an upgrade state; their detail stays
closed until **Upgrade and open** upgrades only that selected feature. Future
schemas and unreadable feature files show an unavailable state while other cards
remain visible. The canonical guidance describes the supported metadata limits.

- **Prohibited:** a refresh upgrades every older ledger or one future schema
  blanks the whole feature list.
- **Required:** keep available cards visible, label the affected feature,
  and upgrade only the supported feature explicitly selected by the user.

## Cortex context declarations

The [YAML authoring entry point](cortex/teams/ai-team/agents/tech-writer/skills/context-engineering/AGENTS.yaml)
provides instructions for agent context declarations. The
[authoring guidance](cortex/teams/ai-team/docs/context-authoring.md) and
[composition example](cortex/teams/ai-team/agents/tech-writer/skills/context-engineering/examples/context/authoring.context.yaml)
explain static references and inert command payloads. The
[shared Effect schema](cortex/scripts/src/ts/context-schema.ts) validates their
structure. Existing Markdown instructions, YAML catalogs, and TypeScript tooling
retain their roles.

**Prohibited:** treat a declaration's command string as an instruction to execute
it while reading context.

**Required:** read the declaration as text, validate it with `bun run context:check`
from `cortex/`, and execute only commands required by the active assignment
through the host tools.
