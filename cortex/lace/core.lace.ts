import { type Job, TaskKind } from "./src/ts/lace.ts";

export default [
  {
    kind: TaskKind.Instruction,
    text: "Read lace/src/ts/lace.ts from the library root to learn the complete Lace vocabulary. Read receipt files as text, just as you read Markdown instructions.",
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
    text: "This foundation supplies the declaration model and a checked receipt project. Existing AGENTS.md, SKILL.md, practices, catalogs, and circuit breakers remain authoritative. The example receipts demonstrate composition; they do not replace the current development workflow.",
  },
] as const satisfies Job;
