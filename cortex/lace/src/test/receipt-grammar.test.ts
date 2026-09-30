import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

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
import { Job, TaskKind, WorkingDirectory } from "./src/ts/lace.ts";
`;
  static readonly root = `
export default new Job(
  { kind: TaskKind.Statement, text: "Read the assigned context." },
);
`;
  static readonly rejected: RejectedSyntaxCases = [
    {
      scenario: "missing default job",
      source: "",
      diagnostic: "default-export a job",
    },
    {
      scenario: "a task at the root",
      source: `export default { kind: TaskKind.Statement, text: "Read context." };`,
      diagnostic: "default-export a Job instance",
    },
    {
      scenario: "an empty job",
      source: `export default new Job();`,
      diagnostic: "at least one task or job",
    },
    {
      scenario: "a plain object instead of a Job instance",
      source: `export default { entries: [{ kind: TaskKind.Statement, text: "Read context." }] };`,
      diagnostic: "default-export a Job instance",
    },
    {
      scenario: "an array instead of a Job instance",
      source: `export default [{ kind: TaskKind.Statement, text: "Read context." }];`,
      diagnostic: "default-export a Job instance",
    },
    {
      scenario: "an unrelated constructor",
      source: `export default new Job(new Date());`,
      diagnostic: "Construct only Job instances",
    },
    {
      scenario: "blank statement text",
      source: `export default new Job({ kind: TaskKind.Statement, text: "   " });`,
      diagnostic: "nonblank",
    },
    {
      scenario: "arbitrary function calls",
      source: `export default buildJob();`,
      diagnostic: "only imports, Job construction",
    },
    {
      scenario: "a type cast bypass",
      source: `export default new Job() as Job;`,
      diagnostic: "only imports, Job construction",
    },
    {
      scenario: "a runtime side effect",
      source: `console.log("run"); ${GrammarCases.root}`,
      diagnostic: "only imports, Job construction",
    },
    {
      scenario: "an arbitrary implementation import",
      source: `import runner from "./runner.ts"; ${GrammarCases.root}`,
      diagnostic: "Import only the Lace model or another receipt",
    },
    {
      scenario: "a dynamic job spread",
      source: `import common from "./common.lace.ts"; export default new Job(...common);`,
      diagnostic: "only imports, Job construction",
    },
    {
      scenario: "template interpolation",
      source:
        "export default new Job({ kind: TaskKind.Statement, text: `Read ${context}.` });",
      diagnostic: "without interpolation",
    },
    {
      scenario: "ambient runtime values",
      source: `export default new Job({ kind: TaskKind.Statement, text: Promise.name });`,
      diagnostic: "text and commands as literals",
    },
    {
      scenario: "an ambient value in a quoted command field",
      source: `export default new Job({ kind: TaskKind.ShellCommand, "cwd": WorkingDirectory.LibraryRoot, "script": String.name });`,
      diagnostic: "text and commands as literals",
    },
    {
      scenario: "an ambient prototype instead of a static job",
      source: `export default new Job(Function.prototype);`,
      diagnostic: "Member access is limited",
    },
    {
      scenario: "an ambient value in an enum field",
      source: `export default new Job({ kind: Function.prototype, text: "Read context." });`,
      diagnostic: "Use TaskKind for kind",
    },
    {
      scenario: "computed enum access",
      source: `export default new Job({ kind: TaskKind["Statement"], text: "Read context." });`,
      diagnostic: "Member access is limited",
    },
  ];
}

test("literal statements, nested Jobs, and static imports pass the grammar", () => {
  const source = `${GrammarCases.imports}
import common from "./common.lace.ts";
export default new Job(
  common,
  new Job(common),
  { kind: TaskKind.Statement, text: \`Read the context.
Then apply its instructions.\` },
  {
    "kind": TaskKind.ShellCommand,
    "cwd": WorkingDirectory.LibraryRoot,
    "script": "bun run --filter @meta-cortex/lace check",
  },
);
`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("Lace's own AGENTS.ts entry point passes the receipt grammar", () => {
  const source = readFileSync(
    new URL("../../AGENTS.ts", import.meta.url),
    "utf8",
  );
  expect(new ReceiptSyntax(source).messages("lace/AGENTS.ts")).toEqual([]);
});

test("AGENTS.ts cannot bypass the receipt grammar", () => {
  const source = `${GrammarCases.imports} export default [];`;
  expect(
    new ReceiptSyntax(source).messages("lace/AGENTS.ts").join("\n"),
  ).toContain("default-export a Job instance");
});

test("a receipt can reuse an AGENTS.ts default job", () => {
  const source = `${GrammarCases.imports}
import lace from "../../lace/AGENTS.ts";
export default new Job(lace);
`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("AGENTS.ts imports must select the default job", () => {
  const source = `${GrammarCases.imports}
import { context } from "../../lace/AGENTS.ts";
export default new Job(context);
`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "Import a receipt's default job",
  );
});

test("the grammar rejects ambient strings that the compiler accepts", () => {
  const source = `
import { Job, TaskKind } from "../../src/ts/lace.ts";
export default new Job(
  { kind: TaskKind.Statement, text: Promise.name },
);
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
export default buildJob();`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "only imports, Job construction",
  );
});
