# Neural Lace Architecture

Lace is the typed declaration language for future Cortex instructions. Its
[core model](../../../lace/src/ts/lace.ts) defines jobs and two task kinds:
instructions and shell commands. Agents read receipt files as text. TypeScript
checks their structure and imports without executing their commands.

This initial architecture adds a parallel foundation. Existing Markdown
instructions, skills, practices, and YAML catalogs keep their current roles.
The [core job](../../../lace/core.lace.ts) describes the vocabulary for agents.

## Jobs and tasks

Every `*.lace.ts` receipt default-exports a literal job with `as const satisfies
Job`. A job is a directory; each named child is another job or a task, like a
directory or file. A job has at least one child. Property names identify its
children, and source order is reading order.

An instruction has `kind: NodeKind.Instruction` and literal `text`. A shell
command has `kind: NodeKind.ShellCommand`, literal `script`, and `cwd`. The
working directory selects the consuming project root or the Cortex library
root. The agent resolves both roots from the session before using commands.

The agent reads the root job, follows its prose, and descends into the selected
children. Conditions and context selection remain instructions for the agent.
Lace supplies declarations; the host supplies execution tools. A command runs
only when the agent invokes the host's shell tool under the current assignment.

- **Prohibited:** treat compiling a receipt as executing its shell commands.

- **Preferred:** read the declaration, apply the session instructions, and use the
  host tool for an instructed command.

## Composition

Import another receipt's default job to reuse the whole job or a named child.
The [common receipt](../agents/typescript-dev/receipts/common.lace.ts) declares
shared context and check commands. The
[development receipt](../agents/typescript-dev/receipts/development.lace.ts)
imports its context and commands into a nested job. TypeScript retains the
literal child names, rejecting missing imports and nonexistent child references.

Read imported sources before applying their instructions. Reuse their canonical
declarations instead of copying command text. Relative imports resolve from the
receipt file. Paths in prose resolve from the stated root or source document.

- **Prohibited:** copy a shared command into several receipts and update only one.

- **Preferred:** import its named child from the owning receipt.

## Core and receipt ownership

The [core ownership rules](../../../lace/AGENTS.md) protect the vocabulary and
checks. An assignment to author receipts authorizes receipt changes and running
existing verification. It does not authorize editing Lace, tests, package scripts,
compiler settings, or lint rules. Core changes require explicit user authorization
for core work. Correct an invalid receipt using the existing vocabulary or report
the capability it cannot express.

These are agent assignment rules. TypeScript enforces readonly declarations;
it does not enforce filesystem write permissions. The core lives under `lace/`,
and the example receipts live under their owning agent outside that directory.

- **Prohibited:** weaken the type model to make a receipt pass.

- **Preferred:** fix the receipt and keep the core unchanged during authoring.

## Validation project

The [TypeScript project](../../../tsconfig.json) includes every `*.lace.ts`
receipt in the library, the model, and its contract tests. It uses strict types,
exact optional properties, checked indexed access, unused-code checks, and
`noEmit`. The shared Bun workspace owns all dependencies and its lockfile.

The grammar allows imports, literal job/task objects, enum members, and references
to imported children. It requires a default job, nonempty children, and literal
prose and scripts. It rejects functions, calls, loops, conditionals, assignments,
spreads, interpolation, type casts, and imports of arbitrary implementation code.
TypeScript validates task fields, discriminants, working directories, and the
actual imported child types. No interpreter or command runner is introduced.

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

- **Prohibited:** bypass grammar checks because arbitrary TypeScript compiles.

- **Preferred:** pass both the compiler and the declaration grammar before using
  a receipt.
