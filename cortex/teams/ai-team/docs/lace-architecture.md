# Neural Lace Architecture

Neural Lace is the typed declaration language for Cortex context files: agent
instructions, skills, and practices that agents read as text. Its
[core model](../../../lace/src/ts/lace.ts) defines jobs and two task kinds:
instructions and shell commands. Agents read receipt files as text. TypeScript
checks their structure and imports without executing their commands.

Lace belongs to context authoring through Context Engineering. It defines the
format of Cortex context, not an API for coding agents or application workflows.
This initial architecture adds a parallel foundation.
Lace describes itself in [AGENTS.ts](../../../lace/AGENTS.ts), replacing its own
Markdown entry point. Other Markdown instructions, skills, practices, and YAML
catalogs keep their current roles. Agents learn the vocabulary by reading the
core's TypeScript definitions as text, then read its entry point for instructions.

## Jobs and tasks

### Job construction

Every context receipt, including `AGENTS.ts`, default-exports a `new Job(...)`
instance. Pass tasks and imported jobs directly to its constructor.
Use another `new Job(...)` for
a nested group, such as `new Job(context, new Job(compile, verify))`.
The constructor checks that each entry is a task or another Job.
Its readonly `entries` preserve their source order.
The declaration grammar requires at least one entry in each receipt job.
The constructor checks the contents directly; no assertion clause is needed.

- **Prohibited:** export `[context, compile]` and treat that array as a job.

- **Preferred:** export `new Job(context, compile)`. The constructor checks
  the entries and creates the Job instance.

### Tasks

Jobs represent directories; tasks represent files. `Task` is the discriminated
union of instructions and shell commands. An instruction has
`kind: TaskKind.Instruction` and literal `text`. A shell command has
`kind: TaskKind.ShellCommand`, literal `script`, and `cwd`. The working directory
selects the consuming project root or Cortex library root. The agent resolves
both roots from the session before using commands.

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

The [core ownership rules](../../../lace/AGENTS.ts) protect the vocabulary and
checks. An assignment to author receipts authorizes receipt changes and running
existing verification. It does not authorize editing Lace, tests, package scripts,
compiler settings, or lint rules. Core changes require explicit user authorization
for core work. Correct an invalid receipt using the existing vocabulary or report
the capability it cannot express.

These are agent assignment rules. TypeScript enforces readonly declarations;
it does not enforce filesystem write permissions. The core lives under `lace/`
and contains the model and validation code. Those implementation files contain
no instantiated context jobs or tasks. Its `AGENTS.ts` entry point describes
Lace with the same declaration language used by subject receipts. Subject
receipts belong beside their Markdown context, outside the core. The initial
examples live with Context Engineering. Only Lace's own Markdown entry point
has migrated.

- **Prohibited:** put a subject instruction job in the core implementation,
  or weaken the type model to make a context receipt pass.

- **Preferred:** write the receipt beside its owning context and keep the core
  unchanged during authoring.

## Validation project

The [TypeScript project](../../../tsconfig.json) includes every `*.lace.ts`
receipt and `AGENTS.ts` entry point in the library, the model, and its contract
tests. Both context filenames use the same declaration grammar.
The compiler uses strict types, exact optional properties, checked indexed access, unused-code checks, and
`noEmit`. The shared Bun workspace owns all dependencies and its lockfile.

The grammar allows imports, Job construction, literal task objects, enum members,
and references to imported jobs. It requires a default nonempty Job instance and
literal prose and scripts. Only `new Job(...)` construction is permitted.
It rejects other constructors, function calls, loops, conditionals, assignments,
spreads, interpolation, type assertions, and arbitrary implementation imports.
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
Compilation verifies declaration types and resolvable imports. It does not
detect circular context imports, establish that prose is correct, or prove that
a declared command succeeds in a consuming project.

- **Prohibited:** use `text: Promise.name` because it compiles as a string.
  It reads a runtime value instead of declaring literal context.

- **Preferred:** declare `text: "Read the assigned context."`, then pass both
  the compiler and declaration grammar checks before using the receipt.
