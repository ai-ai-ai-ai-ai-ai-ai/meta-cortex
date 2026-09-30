import { expect, test } from "bun:test";

import { ReceiptCompilation } from "./receipt.ts";

interface RejectedDeclaration {
  readonly scenario: string;
  readonly source: string;
  readonly diagnostic: string;
}
type RejectedDeclarations = readonly RejectedDeclaration[];

class DeclarationCases {
  static readonly imports = `
import { Job, TaskKind, WorkingDirectory } from "../ts/lace.ts";
`;

  static readonly rejected: RejectedDeclarations = [
    {
      scenario: "a task at the file root",
      source: `const receipt: Job = { kind: TaskKind.Instruction, text: "Read context." }; export default receipt;`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an empty job",
      source: `export default new Job();`,
      diagnostic: "Expected at least 1 arguments",
    },
    {
      scenario: "an arbitrary name-keyed job",
      source: `export default new Job({ invented: { kind: TaskKind.Instruction, text: "Read context." } });`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an array instead of a Job instance",
      source: `export default new Job([{ kind: TaskKind.Instruction, text: "Read context." }]);`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a plain object imitating a Job instance",
      source: `export default new Job({ entries: [{ kind: TaskKind.Instruction, text: "Read context." }] });`,
      diagnostic: "content",
    },
    {
      scenario: "an unsupported task kind",
      source: `export default new Job({ kind: "callback", text: "Read context." });`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an instruction without text",
      source: `export default new Job({ kind: TaskKind.Instruction });`,
      diagnostic: "text",
    },
    {
      scenario: "a command without an explicit directory",
      source: `export default new Job({ kind: TaskKind.ShellCommand, script: "bun run check" });`,
      diagnostic: "cwd",
    },
    {
      scenario: "a command without script text",
      source: `export default new Job({ kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot });`,
      diagnostic: "script",
    },
    {
      scenario: "an unsupported working directory",
      source: `export default new Job({ kind: TaskKind.ShellCommand, cwd: "/tmp", script: "bun run check" });`,
      diagnostic: "WorkingDirectory",
    },
    {
      scenario: "a string job name instead of a declared job",
      source: `export default new Job("compile");`,
      diagnostic: "not assignable",
    },
    {
      scenario: "fields belonging to the other task kind",
      source: `export default new Job({ kind: TaskKind.Instruction, script: "bun run check" });`,
      diagnostic: "script",
    },
    {
      scenario: "an unresolvable job import",
      source: `import missing from "./missing.lace.ts"; export default new Job(missing);`,
      diagnostic: "Cannot find module",
    },
    {
      scenario: "a nonexistent imported task",
      source: `import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts"; export default new Job(compile.entries[1]);`,
      diagnostic: "has no element at index",
    },
    {
      scenario: "a circular job import",
      source: `import self from "./compiler-case.lace.ts"; export default new Job(self);`,
      diagnostic: "referenced directly or indirectly in its own initializer",
    },
  ];
}

test("Job construction checks static jobs and tasks without executing them", () => {
  const source = `${DeclarationCases.imports}
import common from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/common.lace.ts";
import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
export default new Job(
  common,
  new Job(compile),
  {
    kind: TaskKind.ShellCommand,
    cwd: WorkingDirectory.LibraryRoot,
    script: "bun run --filter @meta-cortex/lace check",
  },
);
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});

test.each(DeclarationCases.rejected.slice())("rejects $scenario", (example) => {
  const source = DeclarationCases.imports + example.source;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("an imported job's commands are readonly", () => {
  const source = `
import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
compile.entries[0].script = "other command";
`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "read-only property",
  );
});
