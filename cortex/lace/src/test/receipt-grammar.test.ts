import { expect, test } from "bun:test";

import { ReceiptSyntax } from "./receipt-syntax.ts";

interface RejectedSyntax {
  readonly scenario: string;
  readonly source: string;
  readonly diagnostic: string;
}
type RejectedSyntaxCases = readonly RejectedSyntax[];

class GrammarCases {
  static readonly imports = `
import { type Job, NodeKind } from "./src/ts/lace.ts";
`;
  static readonly root = `
export default { kind: NodeKind.Job, children: {
  task: { kind: NodeKind.Instruction, text: "Read the assigned context." },
} } as const satisfies Job;
`;
  static readonly rejected: RejectedSyntaxCases = [
    {
      scenario: "missing default job",
      source: "",
      diagnostic: "default-export a job",
    },
    {
      scenario: "a root satisfying Task",
      source: `export default { kind: NodeKind.Instruction, text: "Read context." } as const satisfies Task;`,
      diagnostic: "default export must satisfy Job",
    },
    {
      scenario: "an empty job",
      source: `export default { kind: NodeKind.Job, children: {} } as const satisfies Job;`,
      diagnostic: "at least one named child",
    },
    {
      scenario: "blank instruction text",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.Instruction, text: "   " } } } as const satisfies Job;`,
      diagnostic: "nonblank",
    },
    {
      scenario: "arbitrary function calls",
      source: `export default buildJob() satisfies Job;`,
      diagnostic: "only imports, literal jobs/tasks",
    },
    {
      scenario: "a type cast bypass",
      source: `export default { kind: "fake" } as Job;`,
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
      scenario: "a child object spread",
      source: `import common from "./common.lace.ts"; export default { kind: NodeKind.Job, children: { ...common.children } } as const satisfies Job;`,
      diagnostic: "only imports, literal jobs/tasks",
    },
    {
      scenario: "template interpolation",
      source:
        "export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.Instruction, text: `Read ${context}.` } } } as const satisfies Job;",
      diagnostic: "without interpolation",
    },
    {
      scenario: "ambient runtime values",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.Instruction, text: Promise.name } } } as const satisfies Job;`,
      diagnostic: "literals or Lace imports",
    },
  ];
}

test("literal prose, nested jobs, and imported references pass the grammar", () => {
  const source = `${GrammarCases.imports}
import common from "./common.lace.ts";
export default {
  kind: NodeKind.Job,
  children: {
    common: common,
    instructions: {
      kind: NodeKind.Job,
      children: { context: common.children.context },
    },
    explanation: { kind: NodeKind.Instruction, text: \`Read the context.
Then apply its instructions.\` },
  },
} as const satisfies Job;
`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
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
