# Neural Lace Architecture

Neural Lace defines typed Cortex context: architecture, specifications, rules,
instructions, skills, and practices that agents read as text.
Its [model](../../../lace/src/ts/lace.ts) supplies Jobs, literal statements, and
shell commands. TypeScript checks declarations and imports;
the agent interprets the context and runs instructed commands through host tools.
Read [Lace's entry point](../../../lace/AGENTS.ts) for its ownership rules.

## Required actions

### Context ownership

- Use Lace only for Cortex context. Keep consuming application workflows with
  their application code.
- Keep subject receipts beside the context they describe, outside `lace/`.
- Use Context Engineering for authoring. Its
  [examples](../agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts)
  demonstrate the declaration language.
- Keep the model and validation implementation in `lace/` free of context jobs
  and tasks. Those files implement the language.
- Read `lace/AGENTS.ts` as context. It describes Lace using the same Job and
  task declarations available to receipt authors.

Only Lace's own Markdown entry point has migrated to TypeScript.
Other Markdown instructions, skills, and practices retain their current roles.
YAML catalogs continue to provide navigation.

**Prohibited:** put an application workflow or a subject instruction job into
Lace's model while assigned to write Cortex context.

**Preferred:** keep a subject receipt with its owning context. Lace's own
`AGENTS.ts` belongs in `lace/` because it describes that core; this exception
does not move subject receipts into the implementation.

### Job construction

- Default-export one `new Job(...)` instance from each context receipt.
  Both `AGENTS.ts` and `*.lace.ts` use this contract.
- Pass entries directly to the constructor. `Entry = Job | Task` accepts a
  nested Job or a task. Job keeps their source order in private storage.
- Construct nested groups with another `new Job(...)`.
- Include at least one entry in each Job. The declaration grammar enforces
  this requirement; the constructor alone permits an empty Job.

The TypeScript fragments below assume `Job`, `TaskKind`, and `WorkingDirectory`
are imported from the model. `context`, `compile`, and `verify` are default Jobs
imported from the linked Context Engineering examples.
Each fragment is a separate receipt body.

**Prohibited:** export an array as the root. It compiles, but the declaration
grammar rejects it because every receipt must start with a Job instance.

```typescript
export default [context, compile, verify];
```

**Preferred:** construct the root Job and its nested group directly.
The constructor checks the entries without type assertions.

```typescript
export default new Job(context, new Job(compile, verify));
```

### Immutable Job operations

Job owns its contents in runtime-private storage. Construction copies and
freezes task values without freezing the caller's objects. Nested Jobs are
already immutable. No operation returns the entry collection or task references.

- `size()` returns the number of immediate entries.
- `append(entry)` returns a new Job. The original Job remains unchanged.

These operations belong to ordinary core TypeScript. The fragments below belong
inside a core operation and use the imported Jobs described above.
Context receipts still compose Jobs through imports and `new Job(...)`;
their grammar does not permit method calls.

**Prohibited:** access storage and mutate an existing Job.
The compiler rejects the nonexistent `entries` property.

```typescript
context.entries.push(compile);
```

**Preferred:** ask the owner to produce a new Job.
The original context retains its size and contents.

```typescript
const extended = context.append(compile);
extended.size();
context.size();
```

### Task declarations

Jobs represent directories; tasks represent files.
`Task = Statement | ShellCommand` is a discriminated union:

- **Statement:** `kind: TaskKind.Statement` and literal `text`.
- **Shell command:** `kind: TaskKind.ShellCommand`, literal `script`, and `cwd`.
  Choose `WorkingDirectory.ProjectRoot` or `WorkingDirectory.LibraryRoot`.

**Prohibited:** mix shell-command fields into a statement.
The compiler rejects `script` on this statement.

```typescript
export default new Job({
  kind: TaskKind.Statement,
  script: "bun run --filter @meta-cortex/lace check",
});
```

**Preferred:** declare explanatory text as a Statement and command text as a
ShellCommand. Give each variant its own fields.

```typescript
export default new Job(
  { kind: TaskKind.Statement, text: "A Job groups Cortex context in source order." },
  {
    kind: TaskKind.ShellCommand,
    cwd: WorkingDirectory.LibraryRoot,
    script: "bun run --filter @meta-cortex/lace check",
  },
);
```

### Statement meaning

A Statement can explain architecture, describe a specification, state a rule,
or give an instruction. Its wording carries that purpose. A descriptive
statement supplies context; an imperative statement tells the agent what to do.
Architecture and specification documents can group these statements in Jobs.
The kind identifies prose without requiring a separate document category.

**Prohibited:** treat "A Job groups Cortex context in source order" as a command
to create or execute Jobs because it appears as a task.

**Preferred:** read that sentence as an architectural fact. Follow "Read the
assigned context before editing" as an instruction because its wording requires
an action. Both sentences use `TaskKind.Statement`.

### Composition

Import another receipt's default Job to reuse its canonical declaration.
Read the imported source before applying its context.
Relative imports resolve from the receipt file.
Paths in prose resolve from the stated root or source document.

The [common receipt](../agents/tech-writer/skills/context-engineering/examples/lace/common.lace.ts)
groups the [context](../agents/tech-writer/skills/context-engineering/examples/lace/context.lace.ts),
[compile](../agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts),
and [verify](../agents/tech-writer/skills/context-engineering/examples/lace/verify.lace.ts)
Jobs. The context Job imports `lace/AGENTS.ts`.
The authoring example reuses these Jobs around its own authoring statement.
TypeScript rejects missing imports and entries with incompatible types.

**Prohibited:** copy the shared compile command into another receipt.
This compiles and passes the grammar, but creates a second declaration to maintain.

```typescript
export default new Job({
  kind: TaskKind.ShellCommand,
  cwd: WorkingDirectory.LibraryRoot,
  script: "bun run --filter @meta-cortex/lace check",
});
```

**Preferred:** use the imported default Job that owns the command.
Changes to that canonical receipt then reach its callers.

```typescript
export default new Job(compile);
```

### Agent execution

1. Read the root Job and the imported context sources it selects.
2. Interpret conditions and context selection from statement text.
3. Resolve the project and library roots from the session.
4. Use the host's shell tool when the context instructs a command within the
   current assignment. Apply the declared working directory.

Compilation never runs a declared shell command.
The declaration format supplies context; the host supplies execution tools.

**Prohibited:** after compiling a receipt containing a shell command, report
that the command ran successfully.

**Preferred:** report that compilation checked the declaration.
Report command execution separately, using the result from the host's shell tool.

### Validation project

The [TypeScript project](../../../tsconfig.json) includes library receipts,
`AGENTS.ts` entry points, the model, and contract tests.
It enables strict types, exact optional properties, checked indexed access,
unused-code checks, and `noEmit`.
The shared Bun workspace owns dependencies and the lockfile.
Both context filenames use the same declaration grammar.

Run from the Cortex library root: `cortex/` in this repository or `.meta-cortex/`
in an installed project.

1. During editing, compile declarations and resolve imports without emitting files:

   ```sh
   bun run --filter @meta-cortex/lace check
   ```

2. Before reporting all Lace checks passed, check formatting, declaration grammar,
   types, and contract tests:

   ```sh
   bun run --filter @meta-cortex/lace verify
   ```

Workspace `bun run verify` includes Lace, so the existing CI gate checks it.
These checks do not detect circular context imports, establish that prose is
correct, or prove that declared commands succeed in a consuming project.

**Prohibited:** run only `check` and report that all Lace checks passed.

**Preferred:** run `verify` and report its result. Review prose meaning separately;
use actual execution results for claims about declared commands.

## Prohibited actions

### Core and receipt ownership

Follow the [core ownership rules](../../../lace/AGENTS.ts) during authoring.
An assignment to write a receipt permits using the vocabulary and existing checks.
Changes to the model, core entry point, grammar, tests, scripts, or configuration
require an explicit user assignment for core work.
These rules govern agent assignments. TypeScript's readonly declarations do
not enforce filesystem write permissions.

**Prohibited:** add a task kind or weaken validation because an assigned context
receipt fails its checks.

**Preferred:** correct the receipt using the existing vocabulary.
If the language cannot express the assigned context, report the missing capability.
An explicit assignment to extend Lace permits the corresponding core change;
a failed receipt alone does not.

### Runtime logic in receipts

The [declaration grammar](../../../lace/receipt-grammar.js) permits static imports,
Job construction, literal task objects, and imported Job references.
Enum access is limited to `TaskKind` for `kind` and `WorkingDirectory` for `cwd`.
Statement text and scripts must be nonblank literals without interpolation.

The grammar rejects arbitrary implementation imports, other constructors,
function calls, loops, conditionals, assignments, spreads, type assertions,
and check-suppression attempts. Express context decisions as statement prose.

**Prohibited:** read a runtime string instead of declaring literal context.
This compiles because `Promise.name` is a string, but fails the grammar.

```typescript
export default new Job({
  kind: TaskKind.Statement,
  text: Promise.name,
});
```

**Preferred:** declare the statement literally.
The compiler checks its task type; the grammar checks its declaration form.

```typescript
export default new Job({
  kind: TaskKind.Statement,
  text: "Read the assigned context.",
});
```
