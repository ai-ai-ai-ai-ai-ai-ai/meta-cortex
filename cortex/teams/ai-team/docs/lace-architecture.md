# Neural Lace Architecture

Neural Lace is the typed declaration language for Cortex context files: agent
instructions, skills, and practices that agents read as text. Its
[core model](../../../lace/src/ts/lace.ts) defines jobs and two task kinds:
instructions and shell commands. Agents read receipt files as text. TypeScript
checks their structure and imports without executing their commands.

Lace belongs to context authoring through Context Engineering. It defines the
format of Cortex context, not an API for coding agents or application workflows.
This initial architecture adds a parallel foundation. Existing Markdown
instructions, skills, practices, and YAML catalogs keep their current roles.
Agents learn the vocabulary by reading the core's TypeScript definitions as text.

## Jobs and tasks

Every `*.lace.ts` receipt default-exports a literal job with `as const satisfies
Job`. `Job` is the nonempty readonly group itself. Its entries are tasks or
other jobs, like files or directories. Jobs are statically declared in receipt
files and referenced through imports. There is no `children` wrapper or
string-keyed job lookup. The compiler preserves the exact group and its order.

An instruction has `kind: TaskKind.Instruction` and literal `text`. A shell
command has `kind: TaskKind.ShellCommand`, literal `script`, and `cwd`. The
working directory selects the consuming project root or the Cortex library
root. The agent resolves both roots from the session before using commands.

The agent reads the root job, follows its prose, and descends into the selected
jobs. Conditions and context selection remain instructions for the agent.
Lace supplies declarations; the host supplies execution tools. A command runs
only when the agent invokes the host's shell tool under the current assignment.

- **Prohibited:** treat compiling a receipt as executing its shell commands.

- **Preferred:** read the declaration, apply the session instructions, and use the
  host tool for an instructed command.

## Composition

Import another receipt's default job as a typed reference to its static
declaration. The [common receipt](../agents/tech-writer/skills/context-engineering/examples/lace/common.lace.ts)
groups the shared [context](../agents/tech-writer/skills/context-engineering/examples/lace/context.lace.ts),
[compile](../agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts), and
[verify](../agents/tech-writer/skills/context-engineering/examples/lace/verify.lace.ts) jobs. The
[authoring receipt](../agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts)
reuses those same declarations around its own instruction. TypeScript checks
the imported jobs and rejects missing references and invalid task positions.

Read imported sources before applying their instructions. Reuse their canonical
declarations instead of copying command text. Relative imports resolve from the
receipt file. Paths in prose resolve from the stated root or source document.

- **Prohibited:** copy a shared command into several receipts and update only one.

- **Preferred:** import the job containing that command from its owning receipt.

## Core and receipt ownership

The [core ownership rules](../../../lace/AGENTS.md) protect the vocabulary and
checks. An assignment to author receipts authorizes receipt changes and running
existing verification. It does not authorize editing Lace, tests, package scripts,
compiler settings, or lint rules. Core changes require explicit user authorization
for core work. Correct an invalid receipt using the existing vocabulary or report
the capability it cannot express.

These are agent assignment rules. TypeScript enforces readonly declarations;
it does not enforce filesystem write permissions. The core lives under `lace/`
and contains only type definitions and validation code. It contains no context
receipts or declared jobs and tasks. Context receipts belong in the same subject
locations as their Markdown context, outside the core. The initial examples live
with Context Engineering; this foundation does not migrate existing Markdown.

- **Prohibited:** put an instruction job inside `lace/`, or weaken the
  type model to make a context receipt pass.

- **Preferred:** write the receipt beside its owning context and keep the core
  unchanged during authoring.

## Validation project

The [TypeScript project](../../../tsconfig.json) includes every `*.lace.ts`
receipt in the library, the model, and its contract tests. It uses strict types,
exact optional properties, checked indexed access, unused-code checks, and
`noEmit`. The shared Bun workspace owns all dependencies and its lockfile.

The grammar allows imports, literal job groups and task objects, enum members,
and references to statically declared jobs. It requires a default nonempty job and literal
prose and scripts. It rejects functions, calls, loops, conditionals, assignments,
spreads, interpolation, type casts, and imports of arbitrary implementation code.
TypeScript validates task fields, discriminants, working directories, and the
actual imported job and task types. ESLint's built-in declaration rules require
literal prose and commands. Member access is limited to `TaskKind` in `kind`
and `WorkingDirectory` in `cwd`. No custom import-binding tracker is needed.
No interpreter or command runner is introduced.

From the library root:

```sh
bun run --filter @meta-cortex/lace check
bun run --filter @meta-cortex/lace verify
```

`check` compiles without emitting files. `verify` also checks formatting,
declaration grammar, and compiler contract tests. The existing `bun run verify`
includes Lace through the workspace, so the existing CI gate validates it.
Compilation verifies declarations; it cannot establish that prose is correct or
that a declared command succeeds in a consuming project.

- **Prohibited:** use `text: Promise.name` because it compiles as a string.
  It reads a runtime value instead of declaring literal context.

- **Preferred:** declare `text: "Read the assigned context."`, then pass both
  the compiler and declaration grammar checks before using the receipt.
