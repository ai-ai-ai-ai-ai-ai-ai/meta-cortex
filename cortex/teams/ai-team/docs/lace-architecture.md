# Neural Lace Architecture

Neural Lace declares Cortex context as YAML data. Agents read receipts as text,
like Markdown. The readonly Job, Stage, Statement, Required, Prohibited, and
ShellCommand contracts remain in the TypeScript model. The authoritative YAML
schema checks structure; the loader resolves static references without executing
commands.

## Required actions

### Context ownership

Keep the [model](../../../lace/src/ts/lace.ts),
[YAML schema](../../../lace/src/ts/context-schema.ts),
[loader](../../../lace/src/ts/context-loader.ts), and their tests in `lace/`.
Its [entry point](../../../lace/AGENTS.yaml) describes Lace using the same
Stage declarations as other receipts. Subject receipts belong beside their
owning context, outside `lace/`. Context Engineering owns receipt authoring;
other existing Markdown instructions remain authoritative.

**Prohibited:** modify the schema while assigned only to author a context receipt.

**Required:** use the existing declarations and checks. Report a missing
capability for a separate core assignment.

### YAML document root

Name receipts `*.lace.yaml` and context entry points `AGENTS.yaml`. Declare a
root `stages` map. Optional `exports` contains both `stages` and `statements`
maps; empty maps are valid. YAML authors use this schema vocabulary directly.
The private package root `@meta-cortex/lace` continues to expose the readonly
model to TypeScript tooling; context receipts do not import code.

**Prohibited:** use a Stage or sequence as the document root. Validation rejects it.

```yaml
spec: {}
Required: { statements: {} }
Prohibited: { statements: {} }
```

**Required:** place Stage values in the root map.

```yaml
stages:
  context:
    spec: {}
    Required: { statements: {} }
    Prohibited: { statements: {} }
```

### Fixed Stage sections

Each Stage has three mandatory fields: `spec`, `Required`, and `Prohibited`.
The `spec` map contains named statements. Required and Prohibited each contain
one named `statements` map. All three maps may be empty. A statement is a
nonblank YAML string or an object with both `content` and `ShellCommand`.

**Prohibited:** omit a normative section even when it has no statements.
Validation rejects this incomplete Stage.

```yaml
stages:
  context:
    spec: {}
```

**Required:** declare every fixed section and use empty maps where appropriate.

```yaml
stages:
  context:
    spec: { contextLanguage: "Cortex context is read as text." }
    Required:
      statements: { readContext: "Read the assigned context." }
    Prohibited: { statements: {} }
```

### Inline local stages

Write local Stage contents directly in the receipt's stages map. Extract a
Stage into exports only when another receipt reuses it. Reference reusable
Stages through `$ref` values in Stage positions.

**Prohibited:** export a Stage used only by this receipt. It validates but adds
an unnecessary lookup for readers.

```yaml
stages:
  context: { $ref: "./context.lace.yaml#/exports/stages/context" }
exports:
  stages:
    context:
      spec: {}
      Required: { statements: {} }
      Prohibited: { statements: {} }
  statements: {}
```

**Required:** keep the same local section inline.

```yaml
stages:
  context:
    spec: {}
    Required: { statements: {} }
    Prohibited: { statements: {} }
```

### Stage names

Every key in stages, spec, and normative statements maps must describe its
purpose. Give each Stage a name for its context section; give each statement a
short name for its fact, action, or restriction. Never use generic positional or
placeholder names such as `step3`, `stage1`, `entry2`, or `item1`.
Preserve source mapping order; names do not encode ordering. Prefer nonnumeric
names because the loaded JavaScript model enumerates integer-like keys in
numeric order before other strings.

This is a semantic authoring rule. Validation checks nonblank unique keys and
structure; it does not infer purpose. Independent YAML catalog entries retain
their own vocabulary.

**Prohibited:** use a placeholder name. This validates but violates the naming rule.

```yaml
stages:
  stage1:
    spec: {}
    Required: { statements: {} }
    Prohibited: { statements: {} }
```

**Required:** name the same section for its purpose.

```yaml
stages:
  receiptOrientation:
    spec: {}
    Required: { statements: {} }
    Prohibited: { statements: {} }
```

### Readonly declarations

The loader returns a Job with readonly model types. Those types reject mutation
through typed access; they do not freeze objects at runtime or establish prose
correctness. Keep context as literal YAML data and read maps in source order.

**Prohibited:** mutate loaded receipt sections or hide context behind runtime calls.

**Required:** compose literal declarations and static Stage or Statement references.

### Normative categories

Put explanatory facts in spec, mandatory actions in Required.statements, and
forbidden actions in Prohibited.statements. Cortex instructions use the
prohibited/required format; a Preferred category is not supported. These fields
are fixed Stage sections, without category labels.

**Prohibited:** place a mandatory validation command only in explanatory prose.

**Required:** give the action a named statement in Required.statements and describe
its command in content.

### Statement declarations

A prose statement is a nonblank YAML string. A command statement has both
descriptive `content` and a `ShellCommand` payload containing `cwd` and `script`.
The cwd values `project-root` and `library-root` resolve against the consuming
session's two roots. Validation and reference resolution never run commands.

**Prohibited:** declare a command without its descriptive content.
Validation rejects the missing field.

```yaml
stages:
  compilation:
    spec: {}
    Required:
      statements:
        compile:
          ShellCommand: { cwd: library-root, script: "bun run check" }
    Prohibited: { statements: {} }
```

**Required:** pair the command with a concise description.

```yaml
stages:
  compilation:
    spec: {}
    Required:
      statements:
        compile:
          content: "Validate the receipt declarations."
          ShellCommand: { cwd: library-root, script: "bun run check" }
    Prohibited: { statements: {} }
```

### Composition and execution

1. Read the receipt and its referenced declarations as text in source order.
2. Resolve relative `$ref` paths from the containing file.
3. Establish the consuming project's root and the Cortex library root.
4. Interpret statement wording within the active assignment.
5. Run an instructed command through the host's shell tool with its declared cwd.

Reuse declarations from `exports.stages` or `exports.statements`. Both export
maps are mandatory when exports is supplied. References contain only `$ref` and
name a relative `*.lace.yaml` or `AGENTS.yaml` path with a fragment of the form
`#/exports/stages/name` or `#/exports/statements/name`. Escape `/` and `~` in
export names as `~1` and `~0`. Stage references belong in stages maps; Statement
references belong in spec or normative statement maps. A local exported Stage
can be reused through a reference to the same file. The loader checks target
existence, target kind, and reference cycles. Commands remain inert data.

**Prohibited:** copy canonical commands into several maintenance locations.

**Required:** reuse the owning Stage export, as in the
[authoring receipt](../agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.yaml).

```yaml
stages:
  compileReceipt:
    $ref: "./compile.lace.yaml#/exports/stages/compileReceipt"
```

For a Statement export, use the statements namespace in its statement position:

```yaml
stages:
  context:
    spec:
      contextRoots:
        $ref: "./shared.lace.yaml#/exports/statements/contextRoots"
    Required: { statements: {} }
    Prohibited: { statements: {} }
```

The latter is illustrative syntax and assumes a neighboring `shared.lace.yaml`
with that export. The checked authoring receipt uses actual neighboring files.

### Validation project

The [TypeScript project](../../../tsconfig.json) checks the model, tooling, and
contract tests. The YAML checker discovers `AGENTS.yaml` and `*.lace.yaml`
context files separately. The existing Bun workspace owns dependencies.

1. From the Cortex library root, run `bun run --filter @meta-cortex/lace check`
   for tooling type checking, YAML schema checking, and reference resolution.
2. For selected receipts, run `bun lace/src/ts/check.ts path/to/context.lace.yaml`.
3. Before claiming full Lace verification, run
   `bun run --filter @meta-cortex/lace verify` for formatting, lint, types,
   YAML validation, and contract tests.
4. Review prose meaning separately and report executed commands only from actual
   host-tool results. Workspace `bun run verify` includes Lace in the CI gate.

**Prohibited:** report full verification after running only check.

**Required:** report the verify result and its practical limits. Checks do not
prove prose correctness or establish command success in a consuming project.

## Prohibited actions

### Core and receipt ownership

Follow the [core ownership rules](../../../lace/AGENTS.yaml). Receipt authoring
uses existing declarations and checks. Core model, schema, loader, tests, and
configuration changes require a separate explicit assignment.

**Prohibited:** weaken checking because a receipt fails.

**Required:** correct the receipt and report an unsupported capability to its owner.

### Runtime logic in receipts

Receipts contain literal YAML maps and strings with optional static references.
The schema rejects unknown fields and incomplete shapes; parsing rejects duplicate
keys and unsupported YAML features. Empty maps are valid. Sequences, nested Jobs,
executable expressions, calls, constructors, and code imports are outside the
context format.

**Prohibited:** derive a statement with a function or implementation import.

**Required:** express context selection in literal prose and compose static data.
