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

### Job builder

- Start a Job with `Job.statement(prompt)`, `Job.shellCommand(command)`, or
  `Job.job(child)`.
- Extend it with `.statement(prompt)`, `.shellCommand(command)`, or `.job(child)`.
- Default-export the resulting builder chain from `AGENTS.ts` or `*.lace.ts`.
- Name reusable child Jobs with top-level `const` bindings, or import another
  receipt's default Job.
- Nest a child builder chain or a named Job with `.job(child)`.

The constructor is private. Each builder requires one input and adds one entry;
a publicly constructed Job is always nonempty. `Entry = Job | Task` remains the
internal content union. Methods preserve source order and supply the task kind.

The TypeScript fragments below assume `Job`, `PromptKind`, and
`WorkingDirectory` are imported from the model. `context`, `compile`, and `verify` are default Jobs
imported from the linked Context Engineering examples.
Each fragment is a separate receipt body.

**Prohibited:** export an array as the root. It compiles, but the declaration
grammar rejects it because every receipt must start with a Job builder chain.

```typescript
export default [context, compile, verify];
```

**Preferred:** name a child group and attach it through the builder.
Each method checks its input without type assertions.

```typescript
const checks = Job.job(compile).job(verify);
export default Job.job(context).job(checks);
```

### Immutable Job operations

Job owns an immutable Effect `Chunk` in a TypeScript `private readonly` field.
Builders copy and freeze prompts, commands, lists, and labelled groups without
freezing the caller's objects. Nested Jobs are already immutable. No operation returns the entry
collection or task references. TypeScript checks private access.
`Chunk.append` creates the next collection without rebuilding existing task values.

- `size()` returns the number of immediate entries.
- `statement`, `shellCommand`, and `job` return new Jobs. The original remains
  unchanged, so several branches can reuse it.

The fragments below belong inside a core operation and use the imported Jobs
described above. Receipt grammar allows the three builder methods; `size()`
belongs to ordinary core TypeScript.

**Prohibited:** access storage and mutate an existing Job.
The compiler rejects the nonexistent `entries` property.

```typescript
context.entries.push(compile);
```

**Preferred:** ask the owner to produce a new Job.
The original context retains its size and contents.

```typescript
const extended = context.job(compile);
extended.size();
context.size();
```

### Task declarations

Jobs represent directories; tasks represent files.
`Task = Statement | ShellCommand` is the stored discriminated union.
Authors select the variant through the builder:

- **Statement:** pass a structured `Prompt` directly to `statement(prompt)`.
  Job creates the Statement with `TaskKind.Statement` and its `prompt`.
- **Shell command:** pass literal `script` and `cwd` to `shellCommand(command)`.
  Job creates the ShellCommand with `TaskKind.ShellCommand`.
  Choose `WorkingDirectory.ProjectRoot` or `WorkingDirectory.LibraryRoot`.

**Prohibited:** mix shell-command fields into a statement.
The compiler rejects `script` on a Prompt.

```typescript
export default Job.statement({
  script: "bun run --filter @meta-cortex/lace check",
});
```

**Preferred:** declare explanatory text as a Statement and command text as a
ShellCommand. The builder supplies each task discriminator.

```typescript
export default Job.statement({
  kind: PromptKind.Paragraph,
  content: "A Job groups Cortex context in source order.",
}).shellCommand({
  cwd: WorkingDirectory.LibraryRoot,
  script: "bun run --filter @meta-cortex/lace check",
});
```

### Prompt structure

`Prompt = Paragraph | BulletList | EnclosedList` is a discriminated union.
Each shape declares its `PromptKind`:

- **Paragraph:** one `content` string for connected prose.
- **Bullet list:** an `items` array of strings for parallel facts or actions.
- **Enclosed list:** an `items` array of labelled groups. Each group has a
  `label` and its own string `items` array.

Use one bullet per independent fact or action. Use labelled groups when their
relationship matters, such as required/prohibited actions or prohibited/preferred
examples. Each enclosed group contains bullets; this shape does not introduce
arbitrary recursive document elements.

**Prohibited:** pass a raw string to `statement`. The compiler requires one of
its declared shapes.

```typescript
export default Job.statement("Read context. Compile the receipt.");
```

**Preferred:** declare independent actions as separate bullet items.

```typescript
export default Job.statement({
  kind: PromptKind.BulletList,
  items: ["Read the assigned context.", "Compile the receipt."],
});
```

**Prohibited:** hide opposing examples in one paragraph. This compiles and
passes the grammar, but leaves their relationship inside an unstructured string.

```typescript
export default Job.statement({
  kind: PromptKind.Paragraph,
  content:
    "Prohibited: change Lace while authoring a receipt. Preferred: use existing Lace declarations.",
});
```

**Preferred:** declare the example labels and their bullets explicitly.

```typescript
export default Job.statement({
  kind: PromptKind.EnclosedList,
  items: [
    {
      label: "Prohibited",
      items: ["Change Lace while authoring a receipt."],
    },
    {
      label: "Preferred",
      items: ["Use the existing Lace declarations."],
    },
  ],
});
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
an action. Both sentences are declared with `statement(prompt)`.

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
export default Job.shellCommand({
  cwd: WorkingDirectory.LibraryRoot,
  script: "bun run --filter @meta-cortex/lace check",
});
```

**Preferred:** use the imported default Job that owns the command.
Changes to that canonical receipt then reach its callers.

```typescript
export default Job.job(compile);
```

### Agent execution

1. Read the root Job and the imported context sources it selects.
2. Interpret conditions and context selection from statement prompts.
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
the three Job builder methods, literal prompts and commands, and Job references.
Top-level `const` bindings may name builder chains for reuse.
Enum access is limited to `PromptKind` for `kind` and `WorkingDirectory` for `cwd`.
Prompt content, labels, list items, and scripts must be nonblank literals without
interpolation. Prompt lists must use nonempty literal arrays.
TypeScript checks the union shapes; the grammar checks literals and nonempty lists.

The grammar rejects implementation imports, constructors, arbitrary calls,
mutable bindings, non-builder initializers, loops, conditionals, assignments,
spreads, type assertions, and check-suppression attempts. Express context decisions as statement prose.

**Prohibited:** read a runtime string instead of declaring literal context.
This compiles because `Promise.name` is a string, but fails the grammar.

```typescript
export default Job.statement({
  kind: PromptKind.Paragraph,
  content: Promise.name,
});
```

**Preferred:** declare the statement literally.
The compiler checks the prompt type; the grammar checks its declaration form.

```typescript
export default Job.statement({
  kind: PromptKind.Paragraph,
  content: "Read the assigned context.",
});
```
