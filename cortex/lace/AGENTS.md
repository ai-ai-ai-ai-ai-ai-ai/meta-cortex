# Lace Core

Neural Lace defines the types and validation rules for Cortex context files.
Agents read these `*.lace.ts` receipts as text, just as they read Markdown.
Context Engineering owns their authoring. Existing Cortex Markdown instructions
remain authoritative.

## Required actions

### Core ownership

- Read [the model](src/ts/lace.ts) and [the core job](core.lace.ts) before authoring receipts.
- Keep receipt edits outside this directory, within the assigned context scope.
- Use the core's existing jobs, instructions, and shell commands.
- Run the existing checks when validating receipts.
- Change the core only under an explicit user assignment to change it.
  A receipt that fails validation does not grant that assignment.
- Correct an invalid receipt using the existing vocabulary.
  Report a missing capability when that vocabulary cannot express the assigned context.

**Prohibited:** while assigned to write a context receipt, add a task kind to
the model because the receipt fails compilation.

**Preferred:** read the model and core job, then write the assigned receipt
outside `lace/` using existing declarations. Run the unchanged checks. Report
an unsupported capability for a separate core assignment.

### Receipt contract

- Import the core types in each `*.lace.ts` file.
- Default-export one literal, nonempty job using `as const satisfies Job`.
- Limit receipt content to imports, literal declarations, and static references to imported jobs.
- Follow the limited declaration grammar in the
  [architecture](../teams/ai-team/docs/lace-architecture.md#validation-project).

The model and check implementation are ordinary TypeScript owned by `lace/`.
Receipt files use the limited context language they define.

**Prohibited:** default-export an instruction task directly, or call an
implementation helper to construct the receipt at runtime.

**Preferred:** follow the
[authoring receipt](../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts).
It imports `Job` and the instruction kind, then exports a literal job containing
an instruction and statically imported jobs.

### Validation

Run checks from the Cortex library root: `cortex/` in this repository or
`.meta-cortex/` in an installed project.

- Compile the receipt project without emitting files or executing commands:

  ```sh
  bun run --filter @meta-cortex/lace check
  ```

- Check formatting, declaration grammar, types, and contract tests:

  ```sh
  bun run --filter @meta-cortex/lace verify
  ```

**Prohibited:** report that a receipt passes all Lace checks after running only
`check`; that command does not validate the declaration grammar.

**Preferred:** use `check` while editing, then run `verify` to validate the
receipt against both the compiler and the declaration grammar.

## Prohibited actions

- Do not use Lace as a coding-agent API or an application workflow.
- Do not change core types, grammar, tests, package scripts, or compiler and lint
  configuration during receipt authoring.

**Prohibited:** fix an application feature by changing Lace's types, or weaken
a lint rule to make an assigned context receipt pass.

**Preferred:** keep receipt work within the assigned Cortex context files.
Make core changes only when the user explicitly assigns core work.
