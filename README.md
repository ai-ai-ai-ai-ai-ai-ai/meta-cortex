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

3. Choose a model and reasoning effort for Gizmo Prime, Team Gizmo, and team agents.
   - Models: Luna, Terra, Sol, and Astra. The menu shows their full model IDs.
   - Efforts: low, medium, high, xhigh, max, and ultra. Luna supports up to max.
   - Press Enter to accept the highlighted setting, or Esc to cancel without writing files.
   - Choices are saved in `.meta-cortex/meta-cortex.toml`.
4. Use a host that supports your choices and reads the project's root `AGENTS.md`.

The executable contains the framework, so initialization works offline.
Installing or initializing Meta-Cortex does not start agents.

### Initialize without a terminal

For scripts and CI, explicitly accept the bundled role settings:

```sh
meta-cortex init --non-interactive /path/to/project
```

Without this flag, a fresh installation requires a terminal for model selection.
Re-running `init` preserves valid project model settings and does not prompt again.
Edit `.meta-cortex/meta-cortex.toml` to change them later.

### Inspect a project

```sh
meta-cortex info
meta-cortex info /path/to/project
```

The read-only report shows CLI and installed framework versions, project and
configuration paths, the `AGENTS.md` connection, and each role's model and effort.
Older installations without version metadata report an unknown framework version.
Model settings come from the project file; `info` does not check host availability.

### What gets installed

- **Executable**
  - Homebrew manages it under the prefix shown by `brew --prefix`.
  - The command is available through that prefix's `bin/` directory.
- **Project framework**
  - Initialization writes the framework to `<project>/.meta-cortex/`.
  - The current directory is the default project.
- **Project entry point**
  - Initialization adds a managed block to the project's root `AGENTS.md`.
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
