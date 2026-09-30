import { type Job, TaskKind } from "./src/ts/lace.ts";

export default [
  {
    kind: TaskKind.Instruction,
    text: "Neural Lace defines the format of Cortex context files. Read lace/src/ts/lace.ts from the library root to learn its vocabulary. Read Cortex context receipts as text, just as you read Markdown instructions. Context Engineering owns their authoring; Lace is not a coding-agent API.",
  },
  [
    {
      kind: TaskKind.Instruction,
      text: "Start each receipt at its default-exported job. A job is a nonempty ordered group of tasks and other jobs, like a directory of files and directories. Read the group in source order, descending into selected jobs. Imports reference statically declared jobs; there is no string-name lookup. Read imported sources before applying them; imports do not execute agent work.",
    },
    {
      kind: TaskKind.Instruction,
      text: "An instruction contains prose for the agent to follow. A shell command contains script text and an explicit working directory. Resolve project-root to the consuming repository and library-root to Cortex. Use the host's shell tool when the instructions call for that command; reading and checking receipts never runs commands.",
    },
  ],
  {
    kind: TaskKind.Instruction,
    text: "When authoring receipts, use the existing Lace vocabulary. Do not edit the Lace core, its grammar, tests, compiler settings, or verification commands to make a receipt pass. Explicit user authorization for a core change is required. Run the existing checks and fix the receipt or report the missing capability.",
  },
  {
    kind: TaskKind.Instruction,
    text: "This foundation supplies the declaration model and a checked receipt project. Existing AGENTS.md, SKILL.md, practices, catalogs, and circuit breakers remain authoritative. The example receipts demonstrate composition; no existing Markdown context is migrated in this foundation.",
  },
] as const satisfies Job;
