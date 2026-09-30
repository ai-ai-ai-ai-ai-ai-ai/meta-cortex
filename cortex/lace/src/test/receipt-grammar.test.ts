import { expect, test } from "bun:test";

import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

interface RejectedSyntax {
  readonly scenario: string;
  readonly source: string;
  readonly diagnostic: string;
}
type RejectedSyntaxCases = readonly RejectedSyntax[];

class GrammarCases {
  static readonly imports = `
import { type Job, TaskKind, WorkingDirectory } from "./src/ts/lace.ts";
`;
  static readonly root = `
export default [
  { kind: TaskKind.Instruction, text: "Read the assigned context." },
] as const satisfies Job;
`;
  static readonly rejected: RejectedSyntaxCases = [
    {
      scenario: "missing default job",
      source: "",
      diagnostic: "default-export a job",
    },
    {
      scenario: "a root satisfying Task",
      source: `export default { kind: TaskKind.Instruction, text: "Read context." } as const satisfies Task;`,
      diagnostic: "default export must satisfy Job",
    },
    {
      scenario: "an empty job",
      source: `export default [] as const satisfies Job;`,
      diagnostic: "at least one task or job",
    },
    {
      scenario: "the name-keyed job wrapper",
      source: `export default { kind: "job", children: { task: { kind: TaskKind.Instruction, text: "Read context." } } } as const satisfies Job;`,
      diagnostic: "literal root job",
    },
    {
      scenario: "blank instruction text",
      source: `export default [{ kind: TaskKind.Instruction, text: "   " }] as const satisfies Job;`,
      diagnostic: "nonblank",
    },
    {
      scenario: "arbitrary function calls",
      source: `export default buildJob() satisfies Job;`,
      diagnostic: "only imports, literal jobs/tasks",
    },
    {
      scenario: "a type cast bypass",
      source: `export default [] as Job;`,
      diagnostic: "do not cast a receipt",
    },
    {
      scenario: "a runtime side effect",
      source: `console.log("run"); ${GrammarCases.root}`,
      diagnostic: "only imports, literal jobs/tasks",
    },
    {
      scenario: "an arbitrary implementation import",
      source: `import runner from "./runner.ts"; ${GrammarCases.root}`,
      diagnostic: "Import only the Lace model or another receipt",
    },
    {
      scenario: "a dynamic job spread",
      source: `import common from "./common.lace.ts"; export default [...common] as const satisfies Job;`,
      diagnostic: "only imports, literal jobs/tasks",
    },
    {
      scenario: "template interpolation",
      source:
        "export default [{ kind: TaskKind.Instruction, text: `Read ${context}.` }] as const satisfies Job;",
      diagnostic: "without interpolation",
    },
    {
      scenario: "ambient runtime values",
      source: `export default [{ kind: TaskKind.Instruction, text: Promise.name }] as const satisfies Job;`,
      diagnostic: "text and commands as literals",
    },
    {
      scenario: "an ambient value in a quoted command field",
      source: `export default [{ kind: TaskKind.ShellCommand, "cwd": WorkingDirectory.LibraryRoot, "script": String.name }] as const satisfies Job;`,
      diagnostic: "text and commands as literals",
    },
    {
      scenario: "an ambient prototype instead of a static job",
      source: `export default [Function.prototype] as const satisfies Job;`,
      diagnostic: "Member access is limited",
    },
    {
      scenario: "an ambient value in an enum field",
      source: `export default [{ kind: Function.prototype, text: "Read context." }] as const satisfies Job;`,
      diagnostic: "Use TaskKind for kind",
    },
    {
      scenario: "computed enum access",
      source: `export default [{ kind: TaskKind["Instruction"], text: "Read context." }] as const satisfies Job;`,
      diagnostic: "Member access is limited",
    },
  ];
}

test("literal instructions, nested Jobs, and static imports pass the grammar", () => {
  const source = `${GrammarCases.imports}
import common from "./common.lace.ts";
export default [
  common,
  [common],
  { kind: TaskKind.Instruction, text: \`Read the context.
Then apply its instructions.\` },
  {
    "kind": TaskKind.ShellCommand,
    "cwd": WorkingDirectory.LibraryRoot,
    "script": "bun run --filter @meta-cortex/lace check",
  },
] as const satisfies Job;
`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("the grammar rejects ambient strings that the compiler accepts", () => {
  const source = `
import { type Job, TaskKind } from "../../src/ts/lace.ts";
export default [
  { kind: TaskKind.Instruction, text: Promise.name },
] as const satisfies Job;
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "text and commands as literals",
  );
});

test.each(GrammarCases.rejected.slice())("rejects $scenario", (example) => {
  const source = GrammarCases.imports + example.source;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("compiler suppression comments cannot disable receipt checking", () => {
  const source = `// @ts-nocheck\n${GrammarCases.imports}${GrammarCases.root}`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "Do not use",
  );
});

test("receipt-local lint directives cannot bypass the grammar", () => {
  const source = `/* eslint-disable */\n${GrammarCases.imports}
export default buildJob() satisfies Job;`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "only imports, literal jobs/tasks",
  );
});
