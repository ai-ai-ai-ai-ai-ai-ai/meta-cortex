# YAML Context Authoring

Cortex context declarations are YAML data that agents read as text, like
Markdown. The [shared Effect schema](../../../scripts/src/ts/context-schema.ts)
is the authoritative structure contract. The existing developer checker validates
that schema and static references without executing declared commands.

## Required actions

### Context ownership

Keep shared schema and checking code in the existing developer tooling under
`scripts/`. Keep subject declarations beside their owning context. The
[authoring entry point](../agents/tech-writer/skills/context-engineering/AGENTS.yaml)
belongs to Context Engineering; other existing Markdown instructions remain
authoritative. Read the schema for exact admitted fields and use the examples
below to apply it.

**Prohibited:** modify the schema while assigned only to author a context receipt.

**Required:** use the existing declarations and checks. Report a missing
capability for a separate schema or checker assignment.

### YAML document root

Name receipts `*.context.yaml` and context entry points `AGENTS.yaml`. Declare a
root `stages` map. Optional `exports` contains both `stages` and `statements`
maps; empty maps are valid. YAML authors use this schema vocabulary directly.
Context declarations contain no code imports.

**Prohibited:** use a stage or sequence as the document root. Validation rejects it.

```yaml
spec: {}
Required: { statements: {} }
Prohibited: { statements: {} }
```

**Required:** place stage values in the root map.

```yaml
stages:
  context:
    spec: {}
    Required: { statements: {} }
    Prohibited: { statements: {} }
```

### Fixed stage sections

Each stage has three mandatory fields: `spec`, `Required`, and `Prohibited`.
The `spec` map contains named statements. Required and Prohibited each contain
one named `statements` map. All three maps may be empty. A statement is a
nonblank YAML string or an object with both `content` and `ShellCommand`.

**Prohibited:** omit a normative section even when it has no statements.
Validation rejects this incomplete stage.

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

Write local stage contents directly in the receipt's stages map. Extract a
stage into exports only when another receipt reuses it. Reference reusable
stages through `$ref` values in stage positions.

**Prohibited:** export a stage used only by this receipt. It validates but adds
an unnecessary lookup for readers.

```yaml
stages:
  context: { $ref: "./context.context.yaml#/exports/stages/context" }
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
purpose. Give each stage a name for its context section; give each statement a
short name for its fact, action, or restriction. Never use generic positional or
placeholder names such as `step3`, `stage1`, `entry2`, or `item1`.
Preserve source mapping order; names do not encode ordering. Prefer nonnumeric
names so context readers preserve the intended ordering.

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

### Static declarations

Keep context as literal YAML data and read maps in source order. Schema checking
does not establish prose correctness or runtime immutability.

**Prohibited:** hide context behind runtime calls or mutate it during validation.

**Required:** compose literal declarations and static stage or statement references.

### Normative categories

Put explanatory facts in spec, mandatory actions in Required.statements, and
forbidden actions in Prohibited.statements. Cortex instructions use the
prohibited/required format; a Preferred category is not supported. These fields
are fixed stage sections, without category labels.

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
          ShellCommand: { cwd: library-root, script: "bun run context:check" }
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
          ShellCommand: { cwd: library-root, script: "bun run context:check" }
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
name a relative YAML path with a fragment of the form
`#/exports/stages/name` or `#/exports/statements/name`. Escape `/` and `~` in
export names as `~1` and `~0`. Stage references belong in stages maps; statement
references belong in spec or normative statement maps. A local exported stage
can be reused through a reference to the same file. The checker checks target
existence, target kind, and reference cycles. Commands remain inert data.

**Prohibited:** copy canonical commands into several maintenance locations.

**Required:** reuse the owning stage export, as in the
[authoring receipt](../agents/tech-writer/skills/context-engineering/examples/context/authoring.context.yaml).

```yaml
stages:
  compileReceipt:
    $ref: "./compile.context.yaml#/exports/stages/compileReceipt"
```

For a statement export, use the statements namespace in its statement position:

```yaml
stages:
  context:
    spec:
      contextRoots:
        $ref: "./shared.context.yaml#/exports/statements/contextRoots"
    Required: { statements: {} }
    Prohibited: { statements: {} }
```

The latter is illustrative syntax and assumes a neighboring `shared.context.yaml`
with that export. The checked authoring receipt uses actual neighboring files.

### Validation commands

The existing Bun workspace owns dependencies and tooling. The context checker
uses the shared schema and validates relative references, including exported
references that are not used by the document's stages. Default discovery covers
`AGENTS.yaml` and `*.context.yaml`; an empty discovery is an error.

1. From the Cortex library root, run `bun run context:check` to validate all
   discovered context declarations and their reference graphs.
2. For selected files, run `bun run context:check path/to/example.context.yaml`.
3. Before claiming full workspace verification, run `bun run verify` for
   formatting, lint, tooling types, context validation, and contract tests.
4. Run `bun run docs:check` for Markdown and catalog checks. Review prose meaning
   separately and report executed commands only from actual host-tool results.

**Prohibited:** report full verification after running only context:check.

**Required:** report the verify result and its practical limits. Checks do not
prove prose correctness or establish command success in a consuming project.

## Prohibited actions

### Schema and context ownership

Follow the [authoring scope rules](../agents/tech-writer/skills/context-engineering/AGENTS.yaml).
Context authoring uses existing declarations and checks. Shared schema, checker,
tests, and configuration changes require a separate explicit assignment.

**Prohibited:** weaken checking because a receipt fails.

**Required:** correct the receipt and report an unsupported capability to its owner.

### Runtime logic in receipts

Receipts contain literal YAML maps and strings with optional static references.
The schema rejects unknown fields and incomplete shapes; parsing rejects duplicate
keys and unsupported YAML features. Empty maps are valid. Sequences,
nested context documents, executable expressions, calls, constructors, and code imports are outside the
context format.

**Prohibited:** derive a statement with a function or implementation import.

**Required:** express context selection in literal prose and compose static data.
