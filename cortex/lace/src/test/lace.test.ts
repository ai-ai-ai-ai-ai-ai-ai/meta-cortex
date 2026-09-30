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
import { type Job, TaskKind, WorkingDirectory } from "../ts/lace.ts";
`;

  static readonly rejected: RejectedDeclarations = [
    {
      scenario: "a task at the file root",
      source: `export default { kind: TaskKind.Instruction, text: "Read context." } as const satisfies Job;`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an empty job",
      source: `export default [] as const satisfies Job;`,
      diagnostic: "requires 1",
    },
    {
      scenario: "an arbitrary name-keyed job",
      source: `export default { invented: { kind: TaskKind.Instruction, text: "Read context." } } as const satisfies Job;`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an unsupported task kind",
      source: `export default [{ kind: "callback", text: "Read context." }] as const satisfies Job;`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an instruction without text",
      source: `export default [{ kind: TaskKind.Instruction }] as const satisfies Job;`,
      diagnostic: "text",
    },
    {
      scenario: "a command without an explicit directory",
      source: `export default [{ kind: TaskKind.ShellCommand, script: "bun run check" }] as const satisfies Job;`,
      diagnostic: "cwd",
    },
    {
      scenario: "a command without script text",
      source: `export default [{ kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot }] as const satisfies Job;`,
      diagnostic: "script",
    },
    {
      scenario: "an unsupported working directory",
      source: `export default [{ kind: TaskKind.ShellCommand, cwd: "/tmp", script: "bun run check" }] as const satisfies Job;`,
      diagnostic: "WorkingDirectory",
    },
    {
      scenario: "a string job name instead of a declared job",
      source: `export default ["compile"] as const satisfies Job;`,
      diagnostic: "not assignable",
    },
    {
      scenario: "fields belonging to the other task kind",
      source: `export default [{ kind: TaskKind.Instruction, script: "bun run check" }] as const satisfies Job;`,
      diagnostic: "script",
    },
    {
      scenario: "an unresolvable job import",
      source: `import missing from "./missing.lace.ts"; export default [missing] as const satisfies Job;`,
      diagnostic: "Cannot find module",
    },
    {
      scenario: "a nonexistent imported task",
      source: `import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts"; export default [compile[1]] as const satisfies Job;`,
      diagnostic: "has no element at index",
    },
    {
      scenario: "a circular job import",
      source: `import self from "./compiler-case.lace.ts"; export default [self] as const satisfies Job;`,
      diagnostic: "referenced directly or indirectly in its own initializer",
    },
  ];
}

test("a Job directly groups static jobs and tasks without executing them", () => {
  const source = `${DeclarationCases.imports}
import common from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/common.lace.ts";
import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
export default [
  common,
  [compile],
  {
    kind: TaskKind.ShellCommand,
    cwd: WorkingDirectory.LibraryRoot,
    script: "bun run --filter @meta-cortex/lace check",
  },
] as const satisfies Job;
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
compile[0].script = "other command";
`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "read-only property",
  );
});
