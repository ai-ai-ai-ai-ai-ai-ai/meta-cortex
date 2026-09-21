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

1. Open an existing project directory.
2. Run initialization:

   ```sh
   meta-cortex init
   ```

   To initialize another directory, provide its path:

   ```sh
   meta-cortex init /path/to/project
   ```

3. Choose Codex, Claude, Cursor, or None. The menu shows detected harness files.
4. Approve adding instructions to the selected file, or creating it if absent.
   The default is No; declining still installs the framework.
5. Choose a model and reasoning effort for Gizmo Prime, Team Gizmo, and team agents.
   - Models: Luna, Terra, Sol, and Astra. The menu shows their full model IDs.
   - Efforts: low, medium, high, xhigh, max, and ultra. Luna supports up to max.
   - Press Enter to accept the highlighted setting, or Esc to cancel without writing files.
   - Choices are saved in `.meta-cortex/meta-cortex.toml`.
6. Use the selected harness with models it supports.

The executable contains the framework, so initialization works offline.
Installing or initializing Meta-Cortex does not start agents.

### Initialize without a terminal

For scripts and CI, explicitly choose the harness, instruction action, and bundled
model settings:

```sh
meta-cortex init --non-interactive --harness codex --instructions write /path/to/project
```

Use `--instructions skip` to leave harness files untouched, or `--harness none`
to install only the framework. Noninteractive initialization requires explicit
integration choices.

Interactive initialization asks for a harness and instruction approval on each
run. Re-running `init` preserves valid project model settings without asking for
models again. Edit `.meta-cortex/meta-cortex.toml` to change them later.

### Harness instruction files

- **Codex:** uses an existing nonempty `AGENTS.override.md`, otherwise `AGENTS.md`.
- **Claude:** uses `CLAUDE.md`, or an existing `.claude/CLAUDE.md`.
- **Cursor:** uses `.cursor/rules/meta-cortex.mdc`, then an existing `.cursorrules`
  or `AGENTS.md`. Otherwise creates `.cursor/rules/meta-cortex.mdc` with
  `alwaysApply: true`.

Detection suggests a target; you still choose the harness and approve the change.
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

Initialization replaces the previous HTML-comment markers with this format when
you approve the instruction update. Other project content stays unchanged.
Cursor's `alwaysApply` frontmatter remains separate from this section.

Cursor frontmatter is parsed as YAML and must set `alwaysApply: true`. Existing
formatting and comments are preserved. Malformed frontmatter or managed blocks
are rejected rather than overwritten. Markers inside code examples are ignored.

### Inspect a project

```sh
meta-cortex info
meta-cortex info /path/to/project
```

The command writes one YAML document to stdout, so agents and scripts can save
or parse it directly:

```sh
meta-cortex info > meta-cortex-info.yaml
```

Example output (paths and versions depend on the installation):

```yaml
schema_version: 2
cli_version: 0.1.3
framework_version:
  status: Recorded
  value: 0.1.3
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
    model: gpt-5.6-terra
    reasoning_effort: low
  team:
    gizmo:
      model: gpt-5.6-terra
      reasoning_effort: low
    agent:
      model: gpt-5.6-luna
      reasoning_effort: xhigh
model_availability: NotChecked
```

- `schema_version` identifies the output contract; incompatible changes increment it.
- `framework_version.status` is `Legacy` without a `value` when installation
  version metadata is absent.
- `integrations` reports each harness's resolved instruction file and managed-block
  status: `Connected`, `Missing`, or `Conflict`. Multiple harnesses can share a file;
  this reports file contents, not which harness is running.
- `models` preserves the configuration's role names and reads their project settings.
- `model_availability: NotChecked` means the command has not queried your AI host.

The command does not modify project files. Failures return a nonzero exit code,
write the error to stderr, and leave stdout empty.

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
Read the [framework guide](cortex/README.md) for project context, agent
coordination, model configuration, and skill composition.

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
3. Run `meta-cortex init` with the new executable.
4. Review and reapply your configuration changes.

Repeated initialization succeeds when the installed framework is unchanged and
matches the executable's bundle, allowing valid changes to `meta-cortex.toml`.
Initialization refuses to overwrite a different version, edited framework files,
invalid configuration, or symbolic links.

If a filesystem error interrupts initialization, inspect and move the incomplete
installation before retrying.

For development and release instructions, see [Contributing](CONTRIBUTING.md).
