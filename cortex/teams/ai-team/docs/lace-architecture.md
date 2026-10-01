# Neural Lace Architecture

Neural Lace defines typed Cortex context: architecture, specifications, rules,
instructions, skills, and practices that agents read as text.
Its [model](../../../lace/src/ts/lace.ts) contains the WorkingDirectory enum, types, interfaces, and the inert
`PromptStatement.content` authoring helper.
Receipts declare nested literal named maps, so indentation shows the context
hierarchy as it does in JSON or YAML. TypeScript checks the declarations and
imports; agents apply their meaning through host tools.
Read [Lace's entry point](../../../lace/AGENTS.ts) for core ownership rules.

## Required actions

### Context ownership

- Use Lace for Cortex context. Keep consuming application workflows with their
  application code.
- Keep subject receipts beside the context they describe, outside `lace/`.
- Use Context Engineering for authoring. Its
  [example](../agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts)
  demonstrates typed objects and imported Jobs.
- Keep the model and validation implementation free of context jobs and tasks.
- Read `lace/AGENTS.ts` as context. It describes Lace with the same declarations
  available to subject receipt authors.

Only Lace's own Markdown entry point has migrated to TypeScript.
Other Markdown instructions, skills, and practices remain authoritative.
YAML catalogs continue to provide navigation.

**Prohibited:** put a subject instruction Job into the model while assigned to
write Cortex context.

**Preferred:** keep the receipt with its subject. `lace/AGENTS.ts` describes
Lace itself; that entry point does not move subject receipts into the core.

### Public authoring imports

Import the model vocabulary only from the private workspace package root
`@meta-cortex/lace`. Its sole export is `.` pointing to `./src/ts/lace.ts`.
Use static relative imports for another `*.lace.ts` receipt or `AGENTS.ts`.
Other packages, private subpaths, implementation imports, and the old relative
model route are rejected by the authoring grammar. Source-reading links still
point to the model file; a link is not an import route. The package remains
private and is not published.

**Prohibited:** import through the model's private source path.
The package export and authoring grammar reject this route.

```typescript
import { type Job } from "@meta-cortex/lace/src/ts/lace.ts";
const receipt: Job = { stages: { context: context } };
export default receipt;
```

**Preferred:** import the public vocabulary and another receipt's default Job.

```typescript
import { type Job } from "@meta-cortex/lace";
import context from "./context.lace.ts";
const receipt: Job = { stages: { context: context } };
export default receipt;
```

### Object hierarchy

- Import `Job` as a type, `WorkingDirectory` when commands need it, and `PromptStatement` as a value when needed from `@meta-cortex/lace`.
- Declare `const receipt: Job = { stages: { context: context } }` and `export default receipt`.
- Declare each child Job directly as `{ stages: { context: context } }` within its parent.
- Give each task or child Job an explicit unique identifier or string literal key
  within `stages`, in source declaration order.
- Use top-level `const name: Job` objects for reusable local Jobs.
- Import another receipt's default Job to reuse canonical context.

`Job` is a readonly interface whose `stages` field is
`Readonly<Record<string, Stage>>`. Declare it as a nonempty plain literal map.
Use explicit properties such as `compile: compile` for static Job references.
Names such as `label`, `items`, `stages`, `entries`, `content`, and `script` are valid
stage keys; they do not become schema fields at that position.
`Stage = Job | Task` allows each stage to be another directory or a context task.
Jobs represent directories; tasks represent files. Job stage maps and BulletList item maps must be
nonempty under the declaration grammar. The only authoring helper is
`PromptStatement.content`; receipts have no constructors, general builders,
or runtime collection operations.

The TypeScript fragments below assume `Job`, `PromptStatement`, and
`WorkingDirectory` are imported from `@meta-cortex/lace`. `context`, `compile`, and
`verify` are default Jobs imported from the linked Context Engineering examples.
Each fragment is a separate receipt body.

**Prohibited:** export an untyped object. Its source lacks the Job contract.
The grammar requires an explicitly typed `receipt` binding.

```typescript
const receipt = { stages: { context: context } };
export default receipt;
```

**Preferred:** type the root and enclose child Jobs in place.
The compiler checks every nested stage through that annotation.

```typescript
const receipt: Job = {
  stages: {
    context: context,
    checks: {
      stages: { compile: compile, verify: verify },
    },
  },
};
export default receipt;
```

### Stage names

Every key in an authored `Job.stages` or `BulletList.items` map must describe its purpose.
Name a task for its action or a child Job for the context it groups. Give each
bullet a short name for its fact, action, or grouped subject. Never use
positional or placeholder names such as `step3`, `stage1`, `entry2`, or `item1`.
Keep source declaration order when naming stages and items; names do not encode ordering.

This is a semantic authoring requirement. The declaration grammar accepts
arbitrary explicit identifier or string literal keys and does not judge their
meaning. Compiler and lint success do not establish that stage and bullet names are useful.
Review each name against its task, text, or grouped context.

**Prohibited:** use a position as the name of the compilation stage.
This receipt compiles and passes grammar, but its name hides the action.

```typescript
const receipt: Job = { stages: { step3: compile } };
export default receipt;
```

**Preferred:** name the same stage for its compilation purpose.

```typescript
const receipt: Job = { stages: { compileReceipt: compile } };
export default receipt;
```

**Prohibited:** use a placeholder for a text bullet. This shape passes types and
grammar, but the name does not describe its instruction.

```typescript
const receipt: Job = {
  stages: {
    requiredActions: {
      Statement: {
        prompt: { BulletList: { items: { item1: "Read context." } } },
      },
    },
  },
};
export default receipt;
```

**Preferred:** give the same bullet a short purpose-based name.

```typescript
const receipt: Job = {
  stages: {
    requiredActions: {
      Statement: {
        prompt: { BulletList: { items: { readContext: "Read context." } } },
      },
    },
  },
};
export default receipt;
```

### Readonly declarations

All model fields are readonly, including Job stages, bullet item maps, and nested
BulletLists. TypeScript rejects mutation through these types. Receipts contain
literal declarations; they neither copy nor freeze JavaScript objects at runtime.
Readonly types do not prevent an external mutable alias from changing an object.
Read receipt source as context rather than importing it to run code.

**Prohibited:** mutate a typed Job. The compiler rejects assigning stages,
and the receipt grammar rejects mutation and general method calls.

```typescript
const receipt: Job = { stages: { context: context } };
receipt.stages.compile = compile;
export default receipt;
```

**Preferred:** declare the required grouping as a new object.
The existing context remains a reference in the declared tree.

```typescript
const checks: Job = { stages: { compile: compile, verify: verify } };
const receipt: Job = { stages: { context: context, checks: checks } };
export default receipt;
```

### Task declarations

`Statement` and `ShellCommand` are plain readonly payload interfaces.
`Statement` contains `prompt: Prompt`; `ShellCommand` contains `cwd` and `script`.
The closed `Task` union wraps those payloads as
`{ readonly Statement: Statement } | { readonly ShellCommand: ShellCommand }`.
Each variant excludes the opposite property with an optional `never` field.
Concrete payloads alone are not Task variants. `TaskKind` and `PromptKind` are
removed without aliases; no declaration uses a `kind` field.

- **Statement:** `{ Statement: { prompt } }` with a structured Prompt.
  Its wording can explain architecture, describe a specification, state a rule,
  or require an action.
- **Shell command:** `{ ShellCommand: { cwd, script } }` with a literal payload.
  Choose `WorkingDirectory.ProjectRoot` or `WorkingDirectory.LibraryRoot`.
  The outer property and both payload fields are readonly.

**Prohibited:** put both Task variants in one stage.
The compiler rejects the hybrid through the opposite optional `never` properties;
the grammar requires one outer variant property.

```typescript
const receipt: Job = {
  stages: {
    readContext: {
      Statement: { prompt: PromptStatement.content("Read context.") },
      ShellCommand: {
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run check",
      },
    },
  },
};
export default receipt;
```

**Preferred:** declare explanatory prose and command text as separate tasks.

```typescript
const receipt: Job = {
  stages: {
    explainHierarchy: {
      Statement: {
        prompt: PromptStatement.content(
          "A Job groups Cortex context in source order.",
        ),
      },
    },
    compileReceipt: {
      ShellCommand: {
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run --filter @meta-cortex/lace check",
      },
    },
  },
};
export default receipt;
```

### Prompt structure

`PromptStatement` and `BulletList` are plain readonly payload interfaces.
`Prompt` is the closed union of `PromptStatementVariant` and `BulletListVariant`:
`{ readonly PromptStatement: PromptStatement } | { readonly BulletList: BulletList }`.
Each variant excludes the opposite property with an optional `never` field.
A Prompt has exactly one outer variant property; hybrid objects are invalid.

- **Prompt statement:** `{ PromptStatement: { content } }` with one literal string.
- **Bullet list:** `{ BulletList: { label?, items } }` with an optional literal
  label and a nonempty literal named map. The payload types `items` as
  `Readonly<Record<string, string | BulletListVariant>>`.
- **Nested group:** a mapped BulletList variant within another payload's `items`.
  Groups use the same recursive variant and may omit their label.

Give each text bullet an explicit descriptive key and a nonblank literal string
or noninterpolated template value. Use one bullet per
independent fact or action. Nest BulletLists when their relationship matters,
such as prohibited/preferred examples. State requirements explicitly in the
wording. Arrays, raw group payloads, general Prompt values, PromptStatement
wrappers, and helper calls are invalid item values. Plain mapped PromptStatement
objects remain supported only as standalone prompts.

**Prohibited:** hide independent actions in one raw prompt string.
The compiler requires a structured Prompt.

```typescript
const receipt: Job = {
  stages: {
    readAndCompile: {
      Statement: {
        prompt: "Read context. Compile the receipt.",
      },
    },
  },
};
export default receipt;
```

**Preferred:** put each action in a structured bullet and nest related items.
The nested group below omits its optional label.

```typescript
const receipt: Job = {
  stages: {
    requiredActions: {
      Statement: {
        prompt: {
          BulletList: {
            label: "Required actions",
            items: {
              readContext: "Read the assigned context.",
              checks: {
                BulletList: {
                  items: { compileReceipt: "Compile the receipt." },
                },
              },
            },
          },
        },
      },
    },
  },
};
export default receipt;
```

**Prohibited:** put the standalone prompt helper inside an item map.
The compiler rejects its PromptStatement variant as a bullet value; the grammar
also rejects the call in that position.

```typescript
const receipt: Job = {
  stages: {
    requiredActions: {
      Statement: {
        prompt: {
          BulletList: {
            items: { readContext: PromptStatement.content("Read context.") },
          },
        },
      },
    },
  },
};
export default receipt;
```

**Preferred:** put literal text directly under the item's descriptive key.

```typescript
const receipt: Job = {
  stages: {
    requiredActions: {
      Statement: {
        prompt: { BulletList: { items: { readContext: "Read context." } } },
      },
    },
  },
};
export default receipt;
```

### Literal prompt helper

`PromptStatement` retains its readonly interface and has an abstract static class
with `content(content: string): PromptStatementVariant`. The helper returns the
precise plain `{ PromptStatement: { content } }` variant directly usable as a
standalone Statement.prompt, without freezing or runtime validation. Direct construction is not part of the authoring API.

The grammar permits only noncomputed `PromptStatement.content` calls with exactly
one nonblank string or noninterpolated template literal. Calls belong only in a
Statement's standalone `prompt`; BulletList item values cannot use the helper. Other calls and helper
calls in Job, stage, or shell-command fields remain invalid. Existing model import
restrictions and TypeScript binding checks apply; there is no import tracker.

**Prohibited:** derive a helper argument from a runtime expression.
The compiler accepts the string, but the grammar rejects this call.

```typescript
const receipt: Job = {
  stages: {
    read: {
      Statement: {
        prompt: PromptStatement.content(Promise.name),
      },
    },
  },
};
export default receipt;
```

**Preferred:** put the exact context in the literal helper argument.

```typescript
const receipt: Job = {
  stages: {
    read: {
      Statement: {
        prompt: PromptStatement.content("Read the assigned context."),
      },
    },
  },
};
export default receipt;
```

### Composition and execution

1. Read the receipt and its imported context as text in source declaration order.
   - Prefer nonnumeric entry names. JavaScript enumerates integer-like object keys
     in ascending order before other string keys, so runtime enumeration can
     differ from source order. Receipts are read as context, without execution.
2. Resolve relative imports from the containing receipt file.
3. Establish the consuming project's root and the Cortex library root.
4. Interpret statement wording within the active assignment.
5. Run an instructed command through the host's shell tool with its declared cwd.

Compilation never runs a declared command. Importing a receipt invokes its
`PromptStatement.content` calls to construct plain objects; it does not run
declared shell commands. Agents read the source rather than importing it. Express conditions and context
selection in literal prompt content. Reuse canonical commands through imported
Jobs; copying them creates another maintenance location.

**Prohibited:** copy a shared compilation command into every receipt.
This type-checks but duplicates its maintenance owner.

```typescript
const receipt: Job = {
  stages: {
    compileReceipt: {
      ShellCommand: {
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run --filter @meta-cortex/lace check",
      },
    },
  },
};
export default receipt;
```

**Preferred:** reference the imported compilation Job.

```typescript
const receipt: Job = { stages: { context: context, compile: compile } };
export default receipt;
```

### Validation project

The [TypeScript project](../../../tsconfig.json) includes receipts, `AGENTS.ts`
entry points, the model, and contract tests. It enables strict types, exact
optional properties, checked indexed access, unused-code checks, and `noEmit`.
The shared Bun workspace owns dependencies and the lockfile.

Run from the Cortex library root: `cortex/` here or `.meta-cortex/` when installed.

1. During editing, compile declarations and resolve imports:

   ```sh
   bun run --filter @meta-cortex/lace check
   ```

2. Before reporting that all Lace checks pass, run formatting, grammar, types,
   and contract tests:

   ```sh
   bun run --filter @meta-cortex/lace verify
   ```

Workspace `bun run verify` includes Lace in the existing CI gate.
Checks do not detect circular context imports, prove prose correctness, or
establish command success in a consuming project.

**Prohibited:** report full verification after running only `check`.

**Preferred:** run `verify` and report the result. Review prose meaning separately;
report command execution only from its actual host-tool result.

## Prohibited actions

### Core and receipt ownership

Follow the [core ownership rules](../../../lace/AGENTS.ts).
Receipt authoring permits using existing declarations and checks. Changing the
model, core entry point, grammar, tests, scripts, or configuration requires an
explicit user assignment for core work. This governs agent assignments;
TypeScript readonly declarations do not enforce filesystem permissions.

**Prohibited:** add a task kind or weaken checking because a receipt fails.

**Preferred:** correct the receipt with the existing vocabulary. Report a missing
capability when it needs a separate core assignment.

### Runtime logic in receipts

The [grammar](../../../lace/receipt-grammar.js) permits the exact `@meta-cortex/lace` root import and static relative receipt imports,
typed const Job objects, literal tasks and prompts, and static Job references in
named stages maps, plus the exact literal prompt helper described above.
The root binding is named `receipt` and default-exported.
Task and Prompt objects require exactly one outer variant property with a
literal payload in their task or prompt position. `WorkingDirectory` supplies
`cwd` inside the ShellCommand payload. Arbitrary stage and item keys such as `Statement`,
`ShellCommand`, `PromptStatement`, and `BulletList` remain valid at any depth. Dynamic payloads, computed fields, spreads, methods, and helper
calls used as commands are invalid. Text and labels must be nonblank literals; maps must be nonempty.
Stage maps require explicit unique identifier or string literal keys and literal
objects or static Job references as values. Stage arrays, computed keys, spreads,
methods, and nonliteral stage maps are invalid. Bullet item maps require explicit
unique identifier or string literal keys with nonblank names. Their values are
nonblank literal text or a literal mapped BulletList group. Empty maps, arrays,
dynamic values, computed keys, spreads, methods, and other Prompt variants are invalid.

The grammar combines standard ESLint restrictions and duplicate-key checks with
the local `lace/declaration-fields` rule. That rule uses declaration position to
distinguish arbitrary stage and item names from schema fields and applies structural
selectors plus the narrow helper-call predicate; it does not evaluate receipts
or track imports. TypeScript checks
entry and prompt variants through the model.

- The grammar rejects other implementation imports, arbitrary calls, constructors, methods,
  mutable bindings, loops, conditionals, assignments, spreads, computed fields,
  type assertions, and suppression attempts.
- Typed Job declarations check the whole object tree without casts or assertion
  operators.

**Prohibited:** obtain prompt content from a runtime expression.
The compiler accepts a string expression; the grammar requires literal context.

```typescript
const receipt: Job = {
  stages: {
    readContext: {
      Statement: {
        prompt: { PromptStatement: { content: Promise.name } },
      },
    },
  },
};
export default receipt;
```

**Preferred:** write the actual context as literal content.

```typescript
const receipt: Job = {
  stages: {
    readContext: {
      Statement: {
        prompt: PromptStatement.content(
          "Read the assigned context before editing.",
        ),
      },
    },
  },
};
export default receipt;
```
