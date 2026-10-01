# Neural Lace Architecture

Neural Lace declares Cortex context as plain readonly data. Agents read receipts
as text, like Markdown. The model contains one WorkingDirectory enum and the
Job, Stage, Statement, Required, Prohibited, and ShellCommand contracts.
Compilation checks their shape and imports without executing declared commands.

## Required actions

### Context ownership

Keep the [model](../../../lace/src/ts/lace.ts),
[declaration grammar](../../../lace/receipt-grammar.js), and their tests in
`lace/`. Its [entry point](../../../lace/AGENTS.ts) describes Lace through the
same declarations used by other receipts. Subject receipts belong beside their
owning context, outside `lace/`. Context Engineering owns receipt authoring;
other existing Markdown instructions remain authoritative.

**Prohibited:** modify the model while assigned only to author a context receipt.

**Required:** use the existing declarations and checks. Report a missing
capability for a separate core assignment.

### Public authoring imports

Import model vocabulary from the private workspace package root
`@meta-cortex/lace`. Its package exports only `.` to `./src/ts/lace.ts`;
workspace resolution supplies the actual types and enum without a custom resolver.
Import other receipts through static relative `*.lace.ts` or `AGENTS.ts` paths.
Source-reading links continue to name the model file.

**Prohibited:** import an implementation file or a private package subpath.
The grammar rejects this import source.

```typescript
import { type Job } from "@meta-cortex/lace/src/ts/lace.ts";
const receipt: Job = { stages: {} };
export default receipt;
```

**Required:** import the public root.

```typescript
import { type Job } from "@meta-cortex/lace";
const receipt: Job = { stages: {} };
export default receipt;
```

### Fixed Stage sections

Declare `const receipt: Job` and default-export `receipt`. Job has
`readonly stages: Readonly<Record<string, Stage>>`. Each Stage has three mandatory
fields: `spec: Readonly<Record<string, Statement>>`, `Required: Required`, and
`Prohibited: Prohibited`. Required and Prohibited each have
`readonly statements: Readonly<Record<string, Statement>>`.
All fields are readonly; all three kinds of named map may be empty.

A Statement is a string or a readonly object with both `content: string` and
`ShellCommand: ShellCommand`. ShellCommand has readonly `cwd: WorkingDirectory`
and `script: string`. Use literal strings or noninterpolated templates for text,
content, and scripts. A structured statement always describes its command in
content. Jobs contain only Stage values; each Stage contains the fixed
statement sections.

**Prohibited:** omit a normative section even when it has no statements.
The compiler and grammar reject the incomplete Stage.

```typescript
import { type Job } from "@meta-cortex/lace";
const receipt: Job = { stages: { context: { spec: {} } } };
export default receipt;
```

**Required:** declare every fixed section and use empty maps where appropriate.

```typescript
import { type Job } from "@meta-cortex/lace";
const receipt: Job = {
  stages: {
    context: {
      spec: { contextLanguage: "Cortex context is read as text." },
      Required: { statements: { readContext: "Read the assigned context." } },
      Prohibited: { statements: {} },
    },
  },
};
export default receipt;
```

### Inline local stages

Write local Stage contents directly in the receipt's stages map. Extract a typed
Stage only when another receipt reuses its named export. Static references to
imported reusable Stages remain valid.

**Prohibited:** extract a Stage used only by this receipt. This compiles and
passes grammar but adds an unnecessary lookup for readers.

```typescript
import { type Job, type Stage } from "@meta-cortex/lace";
const context: Stage = {
  spec: {}, Required: { statements: {} }, Prohibited: { statements: {} },
};
const receipt: Job = { stages: { context: context } };
export default receipt;
```

**Required:** keep the same local section inline.

```typescript
import { type Job } from "@meta-cortex/lace";
const receipt: Job = {
  stages: {
    context: {
      spec: {}, Required: { statements: {} }, Prohibited: { statements: {} },
    },
  },
};
export default receipt;
```

### Stage names

Every key in Job.stages, Stage.spec, and Required or Prohibited statements must
describe its purpose. Give each Stage a name for its context section; give each
statement a short name for its fact, action, or restriction. Never use generic
positional or placeholder names such as `step3`, `stage1`, `entry2`, or `item1`.
Preserve source declaration order; names do not encode ordering. Prefer
nonnumeric names because JavaScript enumerates integer-like object keys in
numeric order before other strings.

This is a semantic authoring rule. Grammar accepts arbitrary explicit unique
identifier or quoted string names, including schema names such as `spec`,
`Required`, `statements`, `ShellCommand`, and `stages`. It does not infer purpose.
Independent YAML catalog entries retain their own vocabulary.

**Prohibited:** use a placeholder name. This compiles and passes grammar but
violates the naming rule.

```typescript
import { type Job } from "@meta-cortex/lace";
const receipt: Job = {
  stages: {
    stage1: {
      spec: {},
      Required: { statements: {} },
      Prohibited: { statements: {} },
    },
  },
};
export default receipt;
```

**Required:** name the same section for its purpose.

```typescript
import { type Job } from "@meta-cortex/lace";
const receipt: Job = {
  stages: {
    receiptOrientation: {
      spec: {},
      Required: { statements: {} },
      Prohibited: { statements: {} },
    },
  },
};
export default receipt;
```

### Readonly declarations

Readonly declarations reject mutation through model types. They do not freeze
objects at runtime or establish prose correctness. Keep context as literal data;
use source order when reading its maps.

**Prohibited:** mutate receipt sections or hide context behind runtime calls.

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

A prose statement is a literal string. A command statement has both descriptive
content and a literal ShellCommand payload. `WorkingDirectory.ProjectRoot` and
`WorkingDirectory.LibraryRoot` resolve against the consuming session's two roots.
No declared shell command runs during compilation or receipt import.

**Prohibited:** declare a command without its descriptive content.
The compiler and grammar reject the missing field.

```typescript
import { type Job, WorkingDirectory } from "@meta-cortex/lace";
const receipt: Job = {
  stages: {
    compilation: {
      spec: {},
      Required: {
        statements: {
          compile: {
            ShellCommand: {
              cwd: WorkingDirectory.LibraryRoot,
              script: "bun run check",
            },
          },
        },
      },
      Prohibited: { statements: {} },
    },
  },
};
export default receipt;
```

**Required:** pair the command with a concise description.

```typescript
import { type Job, WorkingDirectory } from "@meta-cortex/lace";
const receipt: Job = {
  stages: {
    compilation: {
      spec: {},
      Required: {
        statements: {
          compile: {
            content: "Compile the receipt declarations.",
            ShellCommand: {
              cwd: WorkingDirectory.LibraryRoot,
              script: "bun run check",
            },
          },
        },
      },
      Prohibited: { statements: {} },
    },
  },
};
export default receipt;
```

### Composition and execution

1. Read the receipt and its imported declarations as text in source order.
2. Resolve relative receipt imports from the containing file.
3. Establish the consuming project's root and the Cortex library root.
4. Interpret statement wording within the active assignment.
5. Run an instructed command through the host's shell tool with its declared cwd.

Reuse typed const Stage and Statement declarations through named receipt exports.
A receipt still default-exports its Job; only Stage and Statement bindings may be
named exports. Static references belong in stages or statement maps respectively.
The compiler checks their types. Grammar checks declaration positions without
tracking imports or evaluating bindings. Commands remain inert data.

**Prohibited:** copy canonical commands into several maintenance locations.

**Required:** reuse the owning Stage export, as in the
[authoring receipt](../agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts).

```typescript
import { type Job } from "@meta-cortex/lace";
import { compileReceipt } from "./compile.lace.ts";
const receipt: Job = { stages: { compileReceipt: compileReceipt } };
export default receipt;
```

### Validation project

The [TypeScript project](../../../tsconfig.json) includes receipts, entry points,
the model, and contract tests. It enables strict types, checked indexed access,
unused-code checks, and noEmit. The existing Bun workspace owns dependencies.

1. From the Cortex library root, run `bun run --filter @meta-cortex/lace check`
   to compile declarations and resolve imports.
2. Before claiming full Lace verification, run
   `bun run --filter @meta-cortex/lace verify` for formatting, grammar, types,
   and contract tests.
3. Review prose meaning separately and report executed commands only from actual
   host-tool results. Workspace `bun run verify` includes Lace in the CI gate.

**Prohibited:** report full verification after running only check.

**Required:** report the verify result and its practical limits. Checks do not
prove prose correctness, detect circular context imports, or establish command success.

## Prohibited actions

### Core and receipt ownership

Follow the [core ownership rules](../../../lace/AGENTS.ts). Receipt authoring
uses existing declarations and checks. Core model, grammar, tests, and
configuration changes require a separate explicit assignment.

**Prohibited:** weaken checking because a receipt fails.

**Required:** correct the receipt and report an unsupported capability to its owner.

### Runtime logic in receipts

The grammar permits public-root and static relative receipt imports, top-level
typed const Job, Stage, and Statement bindings, literal fixed fields and named
maps, and static Stage or Statement references in their positions. Every receipt
has a typed Job root named receipt and its default export. Names are explicit
unique identifiers or string literals; blank names and text are invalid.
Arrays, computed fields, spreads, methods, interpolated text, arbitrary imports,
calls, constructors, casts, mutable declarations, and nested Jobs are invalid.
Empty maps are valid. WorkingDirectory enum members occur only as command cwd.

**Prohibited:** derive a statement with a function or implementation import.

**Required:** express context selection in literal prose and compose static data.
