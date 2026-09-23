# Meta-Cortex

Meta-Cortex is a composable development platform that organizes teams of AI
agents to turn ideas and requirements into working software.

Your AI host supplies the models and execution tools. Meta-Cortex supplies the
agent roles, skills, practices, and coordination instructions used in your
project.

- [Get started](#get-started)
- [Use Meta-Cortex](#use-meta-cortex)
- [Update a project](#update-a-project)

## Get started

### Install the command

Choose one installation method.

**Homebrew**

```sh
brew tap ai-ai-ai-ai-ai-ai-ai/tap
brew install ai-ai-ai-ai-ai-ai-ai/tap/meta-cortex
```

**Shell installer**

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases/latest/download/meta-cortex-installer.sh | sh
```

Prebuilt binaries are available for macOS and Linux on ARM64 and x86-64.
See [GitHub Releases](https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases)
for downloadable artifacts.

### Initialize your project

Create `request.yaml` with an existing project directory and explicit harness choices:

```yaml
version: 1
project: /path/to/project
operation:
  name: InitializeFramework
  arguments:
    harness: codex
    instructions: write
```

Then run:

```sh
meta-cortex run --request request.yaml
```

Use `harness: none` and `instructions: skip` to install only the framework.
Initialization installs `.meta-cortex/` with the bundled model and reasoning-effort
settings, without terminal prompts. Edit `.meta-cortex/meta-cortex.toml` if your
host needs different settings. Repeating the request preserves valid project
settings and does not replace a modified framework.

The executable contains the framework, so initialization works offline.
Installing or initializing Meta-Cortex does not start agents. Run `meta-cortex list`
to discover every operation, its typed schema, and a complete request example.
`meta-cortex run --request -` reads a request from stdin.

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
  name: GetFrameworkInfo
  arguments: {}
```

```sh
meta-cortex run --request info.yaml > meta-cortex-info.yaml
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
      schema_version: 3
      cli_version: 0.6.2
      framework_version: 0.6.2
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
- `framework_version` is the installed version string; missing version metadata
  is an incomplete installation and produces an error.
- `integrations` reports each harness's resolved instruction file and managed-block
  status: `Connected`, `Missing`, or `Conflict`. Multiple harnesses can share a file;
  this reports file contents, not which harness is running.
- `models` preserves the configuration's role names and reads their project settings.
- `model_availability: NotChecked` means the command has not queried your AI host.

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

## Develop the application

The [Rust workspace](app/Cargo.toml) contains two crates:

- [installer](app/installer): the `meta-cortex` executable, framework installation,
  command discovery, and typed YAML transport.
- [workbench](app/workbench): the `meta-cortex-workbench` library for durable agent
  tasks, claims, progress, Git checkpoints, and per-feature Turso ledgers. It owns
  database migrations and storage tests; installer uses its public API.

```sh
cd app
cargo fmt --all --check
cargo check --locked --workspace --all-targets
cargo clippy --locked --workspace --all-targets -- -D warnings
cargo test --locked --workspace
cargo llvm-cov --locked --workspace --fail-under-lines 90
cargo build --release --locked --workspace
```

Run `cargo run -p meta-cortex -- list` from `app/` to inspect agent commands.
The binary is built at `app/target/release/meta-cortex`. Release configuration
lives in [app/dist-workspace.toml](app/dist-workspace.toml); only the executable
is distributed. The [framework source](cortex/) remains at the repository root.

## Update a project

Updating the executable and updating a project's framework are separate actions.
An existing `.meta-cortex/` directory does not change when Homebrew upgrades the
command.

### Upgrade the command

For a Homebrew installation:

```sh
brew upgrade ai-ai-ai-ai-ai-ai-ai/tap/meta-cortex
```

For a shell installation, rerun the shell installer above.

### Replace an installed framework

Automated framework upgrades are not implemented yet.

1. Back up the project's `.meta-cortex/` directory.
2. Move the existing directory out of the installation path.
3. Run a `InitializeFramework` YAML request with the new executable.
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

For development and release instructions, see [Contributing](CONTRIBUTING.md).

## Agent work ledger

The `meta-cortex` binary includes an embedded Turso ledger, isolated by feature
in the consuming repository’s common Git directory. Linked worktrees share the
feature database without a server or tracked project files.

```sh
meta-cortex list
meta-cortex run --request request.yaml
```

`list` prints typed command schemas and complete YAML requests. `run` accepts a
request file or `--request -` for stdin and emits a versioned YAML response. It
supports durable assignments, atomic claims, progress/checkpoints, history, and
integration records, framework initialization, and project inspection.

See the [agent ledger protocol](cortex/teams/gizmo-team/docs/agent-ledger.md) for
ownership, recovery, version compatibility, and local storage boundaries.
