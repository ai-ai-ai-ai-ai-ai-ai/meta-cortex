import { expect, test } from "bun:test";

import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";
import { Job, TaskKind, type Statement } from "../ts/lace.ts";

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
      source: `const receipt: Job = { kind: TaskKind.Statement, text: "Read context." }; export default receipt;`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an arbitrary name-keyed job",
      source: `export default new Job({ invented: { kind: TaskKind.Statement, text: "Read context." } });`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an array instead of a Job instance",
      source: `export default new Job([{ kind: TaskKind.Statement, text: "Read context." }]);`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a plain object imitating a Job instance",
      source: `export default new Job({ size: () => 1, append: () => new Job() });`,
      diagnostic: "#content",
    },
    {
      scenario: "an unsupported task kind",
      source: `export default new Job({ kind: "callback", text: "Read context." });`,
      diagnostic: "not assignable",
    },
    {
      scenario: "the replaced instruction kind",
      source: `export default new Job({ kind: TaskKind.Instruction, text: "Read context." });`,
      diagnostic: "Property 'Instruction' does not exist",
    },
    {
      scenario: "a statement without text",
      source: `export default new Job({ kind: TaskKind.Statement });`,
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
      source: `export default new Job({ kind: TaskKind.Statement, script: "bun run check" });`,
      diagnostic: "script",
    },
    {
      scenario: "an unresolvable job import",
      source: `import missing from "./missing.lace.ts"; export default new Job(missing);`,
      diagnostic: "Cannot find module",
    },
    {
      scenario: "access to an imported job's internal entries",
      source: `import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts"; export default new Job(compile.entries[1]);`,
      diagnostic: "Property 'entries' does not exist",
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

test("statements support explanations, specifications, rules, and instructions", () => {
  const source = `
import { Job, TaskKind } from "../../src/ts/lace.ts";
export default new Job(
  { kind: TaskKind.Statement, text: "Jobs group Cortex context in source order." },
  { kind: TaskKind.Statement, text: "Every context receipt exports one Job." },
  { kind: TaskKind.Statement, text: "Keep Lace unchanged during receipt authoring." },
  { kind: TaskKind.Statement, text: "Read the assigned context before editing." },
);
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test.each(DeclarationCases.rejected.slice())("rejects $scenario", (example) => {
  const source = DeclarationCases.imports + example.source;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("an imported job does not expose its storage", () => {
  const source = `
import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
compile.content;
`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "Property 'content' does not exist",
  );
});

test("Job owns immutable state without changing supplied task objects", () => {
  const statement: Statement = {
    kind: TaskKind.Statement,
    text: "Read the assigned context.",
  };
  const job = new Job(statement);
  expect(job.size()).toBe(1);
  expect(Object.isFrozen(job)).toBe(true);
  expect(Object.isFrozen(statement)).toBe(false);
  expect(Object.getOwnPropertyNames(job)).toEqual([]);
  expect(Reflect.set(job, "entries", [])).toBe(false);
  expect(job.size()).toBe(1);
});

test("appending returns a new Job and preserves the original", () => {
  const statement: Statement = {
    kind: TaskKind.Statement,
    text: "Read the assigned context.",
  };
  const original = new Job(statement);
  const appended = original.append(new Job(statement));
  expect(appended).not.toBe(original);
  expect(original.size()).toBe(1);
  expect(appended.size()).toBe(2);
  expect(Object.isFrozen(appended)).toBe(true);
});

test("shell command declarations are readonly", () => {
  const source = `
import { type ShellCommand, TaskKind, WorkingDirectory } from "../ts/lace.ts";
const command: ShellCommand = {
  kind: TaskKind.ShellCommand,
  cwd: WorkingDirectory.LibraryRoot,
  script: "bun run --filter @meta-cortex/lace check",
};
command.script = "other command";
`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "read-only property",
  );
});
