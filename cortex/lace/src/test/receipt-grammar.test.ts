import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

interface RejectedSyntax {
  readonly scenario: string;
  readonly source: string;
  readonly diagnostic: string;
}

class GrammarCases {
  static readonly imports = `import { type Job, TaskKind, PromptKind, WorkingDirectory } from "../../src/ts/lace.ts";`;
  static readonly object = `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }] }`;
  static readonly rejected: readonly RejectedSyntax[] = [
    {
      scenario: "a root array",
      source: `export default [];`,
      diagnostic: "Default-export the typed receipt binding",
    },
    {
      scenario: "an untyped root object",
      source: `const receipt = ${GrammarCases.object}; export default receipt;`,
      diagnostic: "Declare each local Job",
    },
    {
      scenario: "a raw exported object",
      source: `export default ${GrammarCases.object};`,
      diagnostic: "Default-export the typed receipt binding",
    },
    {
      scenario: "no default export",
      source: `const receipt: Job = ${GrammarCases.object};`,
      diagnostic: "must default-export receipt",
    },
    {
      scenario: "an undeclared root",
      source: `export default receipt;`,
      diagnostic: "Declare const receipt: Job",
    },
    {
      scenario: "exporting a different binding",
      source: `const receipt: Job = ${GrammarCases.object}; export default Job;`,
      diagnostic: "Default-export the typed receipt binding",
    },
    {
      scenario: "a mutable binding",
      source: `let receipt: Job = ${GrammarCases.object}; export default receipt;`,
      diagnostic: "top-level const",
    },
    {
      scenario: "an alias instead of a literal root",
      source: `const other: Job = ${GrammarCases.object}; const receipt: Job = other; export default receipt;`,
      diagnostic: "Declare each local Job",
    },
    {
      scenario: "a constructor",
      source: `const receipt: Job = new Job(); export default receipt;`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "a builder call",
      source: `const receipt: Job = Job.statement({}); export default receipt;`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "an arbitrary function call",
      source: `const receipt: Job = buildJob(); export default receipt;`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "a runtime side effect",
      source: `console.log("run"); ${GrammarCases.root()}`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "a type assertion",
      source: `const receipt: Job = {} as Job; export default receipt;`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "a computed field",
      source: `const receipt: Job = { ["entries"]: [] }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "shorthand fields",
      source: `const receipt: Job = { entries }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "a method",
      source: `const receipt: Job = { entries() {} }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "an empty Job",
      source: `const receipt: Job = { entries: [] }; export default receipt;`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "an empty nested Job",
      source: `const receipt: Job = { entries: [{ entries: [] }] }; export default receipt;`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "a dynamic entries array",
      source: `const receipt: Job = { entries: Promise.name }; export default receipt;`,
      diagnostic: "literal arrays",
    },
    {
      scenario: "spreading a Job",
      source: `const receipt: Job = { ...other }; export default receipt;`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "spreading entries",
      source: `const receipt: Job = { entries: [...other] }; export default receipt;`,
      diagnostic: "literal objects or static Job references",
    },
    {
      scenario: "an array entry",
      source: `const receipt: Job = { entries: [[]] }; export default receipt;`,
      diagnostic: "literal objects or static Job references",
    },
    {
      scenario: "an ambient entry",
      source: `const receipt: Job = { entries: [Function.prototype] }; export default receipt;`,
      diagnostic: "literal objects or static Job references",
    },
    {
      scenario: "an arbitrary implementation import",
      source: `import runner from "./runner.ts"; ${GrammarCases.root()}`,
      diagnostic: "Import only the Lace model or another receipt",
    },
    {
      scenario: "the removed builder import",
      source: `import { Job } from "../../src/ts/job.ts"; ${GrammarCases.root()}`,
      diagnostic: "Import only the Lace model or another receipt",
    },
    {
      scenario: "a named receipt import",
      source: `import { context } from "./common.lace.ts"; ${GrammarCases.root()}`,
      diagnostic: "Import a receipt's default Job",
    },
    {
      scenario: "a named AGENTS.ts import",
      source: `import { context } from "./AGENTS.ts"; ${GrammarCases.root()}`,
      diagnostic: "Import a receipt's default Job",
    },
    {
      scenario: "a non-Job local binding",
      source: `const prompt: Prompt = {}; ${GrammarCases.root()}`,
      diagnostic: "Declare each local Job",
    },
    {
      scenario: "Job type arguments",
      source: `const receipt: Job<string> = ${GrammarCases.object}; export default receipt;`,
      diagnostic: "without type arguments",
    },
  ];
  static readonly rejectedPrompts: readonly RejectedSyntax[] = [
    {
      scenario: "blank statement content",
      source: `{ kind: PromptKind.Statement, content: "   " }`,
      diagnostic: "nonblank",
    },
    {
      scenario: "a blank standalone label",
      source: `{ kind: PromptKind.BulletList, label: " ", items: ["Read context."] }`,
      diagnostic: "nonblank",
    },
    {
      scenario: "empty bullets",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [] }`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "an empty enclosed list",
      source: `{ kind: PromptKind.EnclosedList, items: [] }`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "empty enclosed bullets",
      source: `{ kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.BulletList, label: "Required", items: [] }] }`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "a blank enclosed label",
      source: `{ kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.BulletList, label: " ", items: ["Read context."] }] }`,
      diagnostic: "nonblank",
    },
    {
      scenario: "a blank bullet",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [" "] }`,
      diagnostic: "nonblank",
    },
    {
      scenario: "template interpolation",
      source: "{ kind: PromptKind.Statement, content: `Read ${context}.` }",
      diagnostic: "without interpolation",
    },
    {
      scenario: "a blank template",
      source: "{ kind: PromptKind.Statement, content: ` ` }",
      diagnostic: "nonblank",
    },
    {
      scenario: "ambient statement content",
      source: `{ kind: PromptKind.Statement, content: Promise.name }`,
      diagnostic: "prompt content, labels, and commands as literals",
    },
    {
      scenario: "dynamic quoted items",
      source: `{ kind: PromptKind.BulletList, label: "Required", "items": Promise.name }`,
      diagnostic: "literal arrays",
    },
    {
      scenario: "a runtime bullet",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [Promise.name] }`,
      diagnostic: "literal prose or labelled groups",
    },
    {
      scenario: "an enum as prose",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [TaskKind.Statement] }`,
      diagnostic: "literal prose or labelled groups",
    },
    {
      scenario: "sparse bullets",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [, "Read context."] }`,
      diagnostic: "Unexpected comma",
    },
    {
      scenario: "spread bullets",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [..."Read context."] }`,
      diagnostic: "literal prose or labelled groups",
    },
    {
      scenario: "computed enum access",
      source: `{ kind: PromptKind["Statement"], content: "Read context." }`,
      diagnostic: "Member access is limited to enum fields",
    },
    {
      scenario: "an ambient enum field",
      source: `{ kind: Function.prototype, content: "Read context." }`,
      diagnostic: "Use TaskKind or PromptKind for kind",
    },
    {
      scenario: "duplicate content fields",
      source: `{ kind: PromptKind.Statement, content: "Read.", content: "Write." }`,
      diagnostic: "Duplicate key",
    },
  ];

  static root(object = GrammarCases.object): string {
    return `const receipt: Job = ${object}; export default receipt;`;
  }
}

test("literal nested objects and imported Job references pass the grammar", () => {
  const source = `${GrammarCases.imports}
import common from "./common.lace.ts";
const checks: Job = { entries: [common] };
const receipt: Job = { entries: [
  common,
  { "entries": [checks] },
  { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: \`Read the context.
Then apply its instructions.\` } },
  { kind: TaskKind.ShellCommand, "cwd": WorkingDirectory.LibraryRoot, "script": "bun run check" },
] }; export default receipt;`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("Lace's own typed entry point passes the grammar and compiler", () => {
  const source = readFileSync(
    new URL("../../AGENTS.ts", import.meta.url),
    "utf8",
  );
  expect(new ReceiptSyntax(source).messages("lace/AGENTS.ts")).toEqual([]);
  expect(
    new ReceiptCompilation(
      source.replaceAll('"./src/ts/lace.ts"', '"../../src/ts/lace.ts"'),
    ).messages(),
  ).toEqual([]);
});

test("a receipt can reuse an AGENTS.ts default Job", () => {
  const source = `${GrammarCases.imports} import lace from "../../lace/AGENTS.ts";
${GrammarCases.root("{ entries: [lace] }")}`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("AGENTS.ts cannot bypass the grammar", () => {
  const source = `${GrammarCases.imports} export default [];`;
  expect(
    new ReceiptSyntax(source).messages("lace/AGENTS.ts").join("\n"),
  ).toContain("Default-export the typed receipt binding");
});

test.each(GrammarCases.rejected.slice())("rejects $scenario", (example) => {
  const source = GrammarCases.imports + example.source;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test.each(GrammarCases.rejectedPrompts.slice())(
  "rejects $scenario",
  (example) => {
    const object = `{ entries: [{ kind: TaskKind.Statement, prompt: ${example.source} }] }`;
    const source = GrammarCases.imports + GrammarCases.root(object);
    expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
      example.diagnostic,
    );
  },
);

test("the grammar rejects ambient strings that the compiler accepts", () => {
  const object = `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: Promise.name } }] }`;
  const source = GrammarCases.imports + GrammarCases.root(object);
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "prompt content, labels, and commands as literals",
  );
});

test.each([
  { scenario: "blank command scripts", script: '""', diagnostic: "nonblank" },
  {
    scenario: "runtime command scripts",
    script: "String.name",
    diagnostic: "prompt content, labels, and commands as literals",
  },
])("rejects $scenario", (example) => {
  const object = `{ entries: [{ kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: ${example.script} }] }`;
  const source = GrammarCases.imports + GrammarCases.root(object);
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("prompt objects cannot be hidden behind identifiers", () => {
  const source = `${GrammarCases.imports}${GrammarCases.root("{ entries: [{ kind: TaskKind.Statement, prompt: context }] }")}`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "Nest literal context objects",
  );
});

test("compiler suppression comments cannot disable receipt checking", () => {
  const source = `// @ts-nocheck\n${GrammarCases.imports}${GrammarCases.root()}`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "Do not use",
  );
});

test("receipt-local lint directives cannot bypass the grammar", () => {
  const source = `/* eslint-disable */\n${GrammarCases.imports}const receipt: Job = buildJob(); export default receipt;`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "only imports, typed Job objects",
  );
});
