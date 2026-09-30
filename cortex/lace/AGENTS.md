# Lace Core

Neural Lace is the core of Cortex's context format. It defines the types and
validation rules for Cortex context receipt files. Context Engineering owns
context authoring; Lace is not a coding-agent API or application workflow.
Read [the model](src/ts/lace.ts) and [the core job](core.lace.ts) before authoring
receipts. The existing Cortex Markdown instructions still govern development.

## Core ownership

Receipt authoring permits creating and editing receipt files outside this
directory and running the existing checks. It does not permit changing Lace's
types, grammar, tests, package, or compiler and lint configuration. A core change
requires an explicit user assignment to change the core; a receipt that fails
validation is not such an assignment. Correct the receipt using the existing
vocabulary or report the missing capability.

**Prohibited:** add a task kind or weaken a check to compile a new receipt.

**Preferred:** express the work with instructions, shell commands, and jobs,
then run the existing compiler and grammar checks.

## Receipt contract

Each `*.lace.ts` file imports the core types and exports one literal job using
`as const satisfies Job`. It contains only imports, literal declarations, and
references to statically imported jobs. The core API and check implementation
are ordinary TypeScript owned by this directory; receipt files are the limited
DSL described by the [architecture](../teams/ai-team/docs/lace-architecture.md).

From the library root, `bun run --filter @meta-cortex/lace verify` checks the
format, grammar, types, and contract tests. `bun run --filter @meta-cortex/lace
check` compiles the entire receipt project without emitting or executing code.
