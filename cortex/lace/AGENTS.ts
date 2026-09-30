import { Job, TaskKind, WorkingDirectory } from "./src/ts/lace.ts";

export default new Job(
  {
    kind: TaskKind.Instruction,
    text: "Neural Lace defines the typed declaration language for Cortex context: agent instructions, skills, and practices. Agents read these declarations as text, just as they read Markdown. Read this entry point as context; do not import it to execute code. Context Engineering owns receipt authoring. Other existing Cortex Markdown instructions remain authoritative.",
  },
  new Job(
    {
      kind: TaskKind.Instruction,
      text: "Required actions: follow the core ownership, receipt contract, and validation instructions below. Resolve paths in this entry point from the Cortex library root: cortex/ in this repository or .meta-cortex/ in an installed project.",
    },
    new Job(
      {
        kind: TaskKind.Instruction,
        text: "Core ownership: read lace/src/ts/lace.ts before authoring receipts. It defines Job, Entry, Instruction, ShellCommand, Task, TaskKind, and WorkingDirectory. Jobs group other jobs and tasks. Jobs represent directories; tasks represent files. Entry is the union of Job and Task. Task is the union of instruction and shell-command declarations.",
      },
      {
        kind: TaskKind.Instruction,
        text: "Keep receipt edits within the assigned Cortex context scope. Write subject receipts beside their owning context, outside lace/. This lace/AGENTS.ts entry point describes Lace using its own vocabulary. The model and validation implementation remain ordinary code without context jobs or tasks.",
      },
      {
        kind: TaskKind.Instruction,
        text: "Use the existing core vocabulary and run the existing checks. Change the core only under an explicit user assignment to change it. A receipt that fails validation does not grant that assignment. Correct the receipt using the existing vocabulary. Report a missing capability when that vocabulary cannot express the assigned context.",
      },
      {
        kind: TaskKind.Instruction,
        text: "Prohibited: while assigned to write a context receipt, add a task kind because the receipt fails compilation. Preferred: read the model, write the assigned receipt beside its context using existing declarations, and run the unchanged checks. Report an unsupported capability for a separate core assignment.",
      },
    ),
    new Job(
      {
        kind: TaskKind.Instruction,
        text: "Receipt contract: import Job and the required task enums from lace/src/ts/lace.ts. Default-export a new Job(...) instance with at least one task or job. Pass literal tasks and imported jobs directly to the constructor. Construct nested groups with new Job(...). The constructor checks entry types without assertions.",
      },
      {
        kind: TaskKind.Instruction,
        text: "An instruction declares kind: TaskKind.Instruction and literal text. A shell command declares kind: TaskKind.ShellCommand, literal script, and cwd: WorkingDirectory.ProjectRoot or WorkingDirectory.LibraryRoot. Resolve both roots before running commands through the host's shell tool. Compilation never executes declared commands.",
      },
      {
        kind: TaskKind.Instruction,
        text: "Limit receipts to static imports, Job construction, literal tasks, and imported job references. Import another receipt's default Job to reuse its context. Read the imported source before applying its instructions. Relative imports resolve from the receipt file. Express conditions and context selection as instruction text.",
      },
      {
        kind: TaskKind.Instruction,
        text: "Prohibited: default-export a raw array or task, or call an implementation helper to construct the receipt. Preferred: export new Job(context, new Job(compile, verify)) using statically imported jobs. See teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/authoring.lace.ts for an authoring example. See teams/ai-team/docs/lace-architecture.md for the declaration grammar and validation limits.",
      },
    ),
    new Job(
      {
        kind: TaskKind.Instruction,
        text: "Validation: use the compiler check while editing receipts. Run complete verification before reporting that the receipt passes all Lace checks. These commands run from the Cortex library root.",
      },
      {
        kind: TaskKind.ShellCommand,
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run --filter @meta-cortex/lace check",
      },
      {
        kind: TaskKind.ShellCommand,
        cwd: WorkingDirectory.LibraryRoot,
        script: "bun run --filter @meta-cortex/lace verify",
      },
      {
        kind: TaskKind.Instruction,
        text: "Prohibited: report that all Lace checks pass after running only check. Preferred: use check for compilation without emitting files, then verify for formatting, declaration grammar, types, and contract tests. Neither check executes the declared commands or proves their success in a consuming project.",
      },
    ),
  ),
  new Job(
    {
      kind: TaskKind.Instruction,
      text: "Prohibited actions: do not use Lace as a coding-agent API or an application workflow. Do not put subject receipts or instantiated context jobs and tasks in the model or validation code. Lace's own context entry point is lace/AGENTS.ts; subject receipts belong with their owning context outside lace/.",
    },
    {
      kind: TaskKind.Instruction,
      text: "Do not change core types, grammar, tests, package scripts, compiler configuration, lint configuration, or this core entry point during receipt authoring. Core changes require an explicit user assignment to change the core.",
    },
    {
      kind: TaskKind.Instruction,
      text: "Prohibited: add an application callback to the model or weaken lint to make a context receipt pass. Preferred: keep receipt work within the assigned Cortex context files. When explicitly assigned to change Lace, edit the relevant core files and verify the project.",
    },
  ),
);
