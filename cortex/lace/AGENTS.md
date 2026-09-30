# Lace Core

Neural Lace contains the model and validation code for Cortex context files.
This directory contains no context receipts or instantiated context jobs and tasks.
Agents read these `*.lace.ts` receipts as text, just as they read Markdown.
Context Engineering owns their authoring. Existing Cortex Markdown instructions
remain authoritative.

## Required actions

### Core ownership

- Read [the model](src/ts/lace.ts) before authoring receipts.
- Keep context receipts beside the context they describe, outside this directory.
- Keep receipt edits within the assigned context scope.
- Use only the job and task types defined by the core.
- Run the existing checks when validating receipts.
- Change the core only under an explicit user assignment to change it.
  A receipt that fails validation does not grant that assignment.
- Correct an invalid receipt using the existing vocabulary.
  Report a missing capability when that vocabulary cannot express the assigned context.

**Prohibited:** while assigned to write a context receipt, add a task kind to
the model because the receipt fails compilation.

**Preferred:** read the model, then write the assigned receipt beside its owning
context outside `lace/`, using existing declarations. Run the unchanged checks. Report
an unsupported capability for a separate core assignment.

### Receipt contract

- Import `Job` and the required task types and enums from the core.
- Default-export a `new Job(...)` instance with at least one task or job.
- Pass tasks and imported jobs directly to the constructor.
- Construct nested groups with `new Job(...)`.
- Limit receipts to imports, Job construction, literal tasks, and static job references.
- Follow the limited declaration grammar in the
  [architecture](../teams/ai-team/docs/lace-architecture.md#validation-project).

The model and check implementation are ordinary TypeScript owned by `lace/`.
Receipt files use the limited context language they define.

**Prohibited:** default-export a raw array or a task, or call an arbitrary
implementation helper to construct the receipt.

**Preferred:** follow the
[authoring receipt](../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts).
It imports `Job` and the instruction kind, then exports a `new Job(...)`
instance containing an instruction, imported jobs, and a nested Job instance.
The constructor checks their types without requiring assertions.

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

- Do not put context receipts or instantiated context jobs and tasks in `lace/`.
- Do not use Lace as a coding-agent API or an application workflow.
- Do not change core types, grammar, tests, package scripts, or compiler and lint
  configuration during receipt authoring.

**Prohibited:** put an instruction job inside `lace/`, add an application
callback to the model, or weaken lint to make a context receipt pass.

**Preferred:** keep receipt work within the assigned Cortex context files.
Make core changes only when the user explicitly assigns core work.
