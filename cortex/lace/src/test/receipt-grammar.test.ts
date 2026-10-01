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
  static readonly object = `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } } } }`;
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
      source: `const receipt: Job = { ["stages"]: [] }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "shorthand fields",
      source: `const receipt: Job = { stages }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "a method",
      source: `const receipt: Job = { stages() {} }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "an empty Job",
      source: `const receipt: Job = { stages: {  } }; export default receipt;`,
      diagnostic: "at least one named stage",
    },
    {
      scenario: "an empty nested Job",
      source: `const receipt: Job = { stages: { stage1: { stages: {  } } } }; export default receipt;`,
      diagnostic: "at least one named stage",
    },
    {
      scenario: "the removed entries field",
      source: `const receipt: Job = { entries: { read: ${GrammarCases.object} } }; export default receipt;`,
      diagnostic: "entries field is not supported",
    },
    {
      scenario: "a dynamic stages object",
      source: `const receipt: Job = { stages: Promise.name }; export default receipt;`,
      diagnostic: "literal named object",
    },
    {
      scenario: "spreading a Job",
      source: `const receipt: Job = { ...other }; export default receipt;`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "spreading stages",
      source: `const receipt: Job = { stages: { ...other } }; export default receipt;`,
      diagnostic: "only imports, typed Job objects",
    },
    {
      scenario: "an array entry",
      source: `const receipt: Job = { stages: { stage1: [] } }; export default receipt;`,
      diagnostic: "literal objects or static Job references",
    },
    {
      scenario: "an ambient entry",
      source: `const receipt: Job = { stages: { stage1: Function.prototype } }; export default receipt;`,
      diagnostic: "literal objects or static Job references",
    },
    {
      scenario: "the old stages array",
      source: `const receipt: Job = { stages: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }] }; export default receipt;`,
      diagnostic: "literal named object",
    },
    {
      scenario: "duplicate stage names",
      source: `const receipt: Job = { stages: { read: ${GrammarCases.object}, "read": ${GrammarCases.object} } }; export default receipt;`,
      diagnostic: "Duplicate key",
    },
    {
      scenario: "a computed stage name",
      source: `const receipt: Job = { stages: { ["read"]: ${GrammarCases.object} } }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "a numeric stage name",
      source: `const receipt: Job = { stages: { 42: ${GrammarCases.object} } }; export default receipt;`,
      diagnostic: "identifiers or string literals",
    },
    {
      scenario: "a shorthand Job reference",
      source: `const read: Job = ${GrammarCases.object}; const receipt: Job = { stages: { read } }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "a stage method",
      source: `const receipt: Job = { stages: { read() {} } }; export default receipt;`,
      diagnostic: "explicit literal name",
    },
    {
      scenario: "a runtime entry call",
      source: `const receipt: Job = { stages: { read: buildJob() } }; export default receipt;`,
      diagnostic: "literal objects or static Job references",
    },
    {
      scenario: "a referenced entire stage map",
      source: `const other: Job = ${GrammarCases.object}; const receipt: Job = { stages: other }; export default receipt;`,
      diagnostic: "literal named object",
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
      source: `{ kind: PromptKind.BulletList, label: " ", items: [{ kind: PromptKind.Statement, content: "Read context." }] }`,
      diagnostic: "nonblank",
    },
    {
      scenario: "empty bullets",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [] }`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "an empty unlabelled list",
      source: `{ kind: PromptKind.BulletList, items: [] }`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "empty nested bullets",
      source: `{ kind: PromptKind.BulletList, items: [{ kind: PromptKind.BulletList, label: "Required", items: [] }] }`,
      diagnostic: "at least one entry or item",
    },
    {
      scenario: "a blank nested label",
      source: `{ kind: PromptKind.BulletList, items: [{ kind: PromptKind.BulletList, label: " ", items: [{ kind: PromptKind.Statement, content: "Read context." }] }] }`,
      diagnostic: "nonblank",
    },
    {
      scenario: "a blank bullet",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [{ kind: PromptKind.Statement, content: " " }] }`,
      diagnostic: "nonblank",
    },
    {
      scenario: "a raw string bullet",
      source: `{ kind: PromptKind.BulletList, items: ["Read context."] }`,
      diagnostic: "literal prompt statement or bullet list objects",
    },
    {
      scenario: "a raw template bullet",
      source: "{ kind: PromptKind.BulletList, items: [`Read context.`] }",
      diagnostic: "literal prompt statement or bullet list objects",
    },
    {
      scenario: "a nested raw string bullet",
      source: `{ kind: PromptKind.BulletList, items: [{ kind: PromptKind.BulletList, items: ["Read context."] }] }`,
      diagnostic: "literal prompt statement or bullet list objects",
    },
    {
      scenario: "the removed enclosed-list kind",
      source: `{ kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.Statement, content: "Read context." }] }`,
      diagnostic: "Use PromptKind.Statement or PromptKind.BulletList",
    },
    {
      scenario: "a dynamic label",
      source: `{ kind: PromptKind.BulletList, label: Promise.name, items: [{ kind: PromptKind.Statement, content: "Read context." }] }`,
      diagnostic: "prompt content, labels, and commands as literals",
    },
    {
      scenario: "dynamic nested statement content",
      source: `{ kind: PromptKind.BulletList, items: [{ kind: PromptKind.Statement, content: Promise.name }] }`,
      diagnostic: "prompt content, labels, and commands as literals",
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
      diagnostic: "literal prompt statement or bullet list objects",
    },
    {
      scenario: "an enum as prose",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [TaskKind.Statement] }`,
      diagnostic: "literal prompt statement or bullet list objects",
    },
    {
      scenario: "sparse bullets",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [, "Read context."] }`,
      diagnostic: "Unexpected comma",
    },
    {
      scenario: "spread bullets",
      source: `{ kind: PromptKind.BulletList, label: "Required", items: [..."Read context."] }`,
      diagnostic: "literal prompt statement or bullet list objects",
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
const checks: Job = { stages: { common: common } };
const receipt: Job = { stages: { stage1: common, stage2: { "stages": { stage1: checks } }, stage3: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: \`Read the context.
Then apply its instructions.\` } }, entry4: { kind: TaskKind.ShellCommand, "cwd": WorkingDirectory.LibraryRoot, "script": "bun run check" } } }; export default receipt;`;
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
${GrammarCases.root("{ stages: { stage1: lace } }")}`;
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
    const object = `{ stages: { stage1: { kind: TaskKind.Statement, prompt: ${example.source} } } }`;
    const source = GrammarCases.imports + GrammarCases.root(object);
    expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
      example.diagnostic,
    );
  },
);

test("the grammar rejects ambient strings that the compiler accepts", () => {
  const object = `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: Promise.name } } } }`;
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
  const object = `{ stages: { stage1: { kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: ${example.script} } } }`;
  const source = GrammarCases.imports + GrammarCases.root(object);
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("prompt objects cannot be hidden behind identifiers", () => {
  const source = `${GrammarCases.imports}${GrammarCases.root("{ stages: { stage1: { kind: TaskKind.Statement, prompt: context } } }")}`;
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

test.each([
  "label",
  "items",
  "stages",
  "entries",
  "script",
  "content",
  "prompt",
  "kind",
  "cwd",
])("stage name %s remains valid at multiple declaration depths", (name) => {
  const source = `${GrammarCases.imports}
import imported from "./imported-job.lace.ts";
const local: Job = ${GrammarCases.object};
const receipt: Job = { stages: {
  ${name}: imported,
  nested: { stages: {
    "${name}": local,
    deep: { stages: { stages: { stages: { ${name}: ${GrammarCases.object}, imported: imported } } } },
  } },
} }; export default receipt;`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});

test.each([
  {
    scenario: "an empty map below a stage named stages",
    source: `{ stages: { stages: { stages: {} } } }`,
    diagnostic: "at least one named stage",
  },
  {
    scenario: "an old array below a stage named stages",
    source: `{ stages: { stages: { stages: [${GrammarCases.object}] } } }`,
    diagnostic: "literal named object",
  },
  {
    scenario: "the removed entries field below a stage named entries",
    source: `{ stages: { entries: { entries: { read: ${GrammarCases.object} } } } }`,
    diagnostic: "entries field is not supported",
  },
  {
    scenario: "runtime prompt below a stage named stages",
    source: `{ stages: { stages: { kind: TaskKind.Statement, prompt: context } } }`,
    diagnostic: "Nest literal context objects",
  },
  {
    scenario: "runtime content below a stage named content",
    source: `{ stages: { content: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: Promise.name } } } }`,
    diagnostic: "prompt content, labels, and commands as literals",
  },
  {
    scenario: "runtime label below a stage named label",
    source: `{ stages: { label: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: Promise.name, items: [{ kind: PromptKind.Statement, content: "Read." }] } } } }`,
    diagnostic: "prompt content, labels, and commands as literals",
  },
  {
    scenario: "runtime items below a stage named items",
    source: `{ stages: { items: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: context } } } }`,
    diagnostic: "literal arrays",
  },
  {
    scenario: "runtime command below a stage named script",
    source: `{ stages: { script: { kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: Promise.name } } }`,
    diagnostic: "prompt content, labels, and commands as literals",
  },
])("rejects $scenario", (example) => {
  const source = GrammarCases.imports + GrammarCases.root(example.source);
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("quoted integer-like names remain literal stage names", () => {
  const source =
    GrammarCases.imports +
    GrammarCases.root(`{ stages: { "1": ${GrammarCases.object} } }`);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});
