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
import { Job, TaskKind, PromptKind, WorkingDirectory } from "./src/ts/lace.ts";
`;
  static readonly root = `export default Job.statement({ kind: PromptKind.Paragraph, content: "Read the assigned context." });
`;
  static readonly rejected: RejectedSyntaxCases = [
    {
      scenario: "an unsupported builder method",
      source: `export default Job.append({});`,
      diagnostic: "Call only statement, shellCommand, or job builders",
    },
    {
      scenario: "a builder without input",
      source: `export default Job.statement();`,
      diagnostic: "exactly one",
    },
    {
      scenario: "a builder with extra inputs",
      source: `export default Job.job(child, child);`,
      diagnostic: "exactly one",
    },
    {
      scenario: "a mutable child binding",
      source: `let child = Job.statement({ kind: PromptKind.Paragraph, content: "Read context." }); export default Job.job(child);`,
      diagnostic: "top-level const",
    },
    {
      scenario: "a non-builder local initializer",
      source: `const child = []; export default Job.job(child);`,
      diagnostic: "must name a Job builder chain",
    },
    {
      scenario: "a local prompt binding",
      source: `const prompt = { kind: PromptKind.Paragraph, content: "Read context." }; export default Job.statement(prompt);`,
      diagnostic: "literal objects",
    },
    {
      scenario: "a helper call in a fluent chain",
      source: `export default buildJob().job(child);`,
      diagnostic: "Call only statement, shellCommand, or job builders",
    },
    {
      scenario: "a computed builder method",
      source: `export default Job["statement"]({ kind: PromptKind.Paragraph, content: "Read context." });`,
      diagnostic: "Call only statement, shellCommand, or job builders",
    },
    {
      scenario: "an ambient nested job reference",
      source: `export default Job.job(Function.prototype);`,
      diagnostic: "Nest a declared Job",
    },
    {
      scenario: "a builder method used as a child value",
      source: `export default Job.job(Job.statement);`,
      diagnostic: "Nest a declared Job",
    },
    {
      scenario: "a size call in a receipt",
      source: `const child = Job.statement({ kind: PromptKind.Paragraph, content: "Read context." }); export default child.size();`,
      diagnostic: "Call only statement, shellCommand, or job builders",
    },
    {
      scenario: "destructuring a local Job",
      source: `const { child } = Job.statement({ kind: PromptKind.Paragraph, content: "Read context." }); export default Job.job(child);`,
      diagnostic: "must name a Job builder chain",
    },
    {
      scenario: "missing default job",
      source: "",
      diagnostic: "default-export a job",
    },
    {
      scenario: "a task at the root",
      source: `export default { kind: TaskKind.Statement, prompt: { kind: PromptKind.Paragraph, content: "Read context." } };`,
      diagnostic: "default-export a Job builder chain",
    },
    {
      scenario: "an empty job",
      source: `export default new Job();
`,
      diagnostic: "only imports, Job builders",
    },
    {
      scenario: "a plain object instead of a Job instance",
      source: `export default { entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Paragraph, content: "Read context." } }] };`,
      diagnostic: "default-export a Job builder chain",
    },
    {
      scenario: "an array instead of a Job instance",
      source: `export default [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Paragraph, content: "Read context." } }];`,
      diagnostic: "default-export a Job builder chain",
    },
    {
      scenario: "an unrelated constructor",
      source: `export default Job.job(new Date());
`,
      diagnostic: "only imports, Job builders",
    },
    {
      scenario: "blank paragraph content",
      source: `export default Job.statement({ kind: PromptKind.Paragraph, content: "   " });
`,
      diagnostic: "nonblank",
    },
    {
      scenario: "a raw prompt string",
      source: `export default Job.statement("Read context.");
`,
      diagnostic: "literal objects",
    },
    {
      scenario: "empty bullets",
      source: `export default Job.statement({ kind: PromptKind.BulletList, items: [] });
`,
      diagnostic: "at least one item",
    },
    {
      scenario: "an empty enclosed list",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: [] });
`,
      diagnostic: "at least one item",
    },
    {
      scenario: "an empty enclosed group",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: [{ label: "Required actions", items: [] }] });
`,
      diagnostic: "at least one item",
    },
    {
      scenario: "a blank bullet",
      source: `export default Job.statement({ kind: PromptKind.BulletList, items: ["   "] });
`,
      diagnostic: "nonblank",
    },
    {
      scenario: "a blank label",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: [{ label: " ", items: ["Read context."] }] });
`,
      diagnostic: "nonblank",
    },
    {
      scenario: "a runtime label",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: [{ label: Promise.name, items: ["Read context."] }] });
`,
      diagnostic: "labels, and commands as literals",
    },
    {
      scenario: "runtime list items",
      source: `export default Job.statement({ kind: PromptKind.BulletList, "items": Promise.name });
`,
      diagnostic: "literal array",
    },
    {
      scenario: "a runtime bullet",
      source: `export default Job.statement({ kind: PromptKind.BulletList, items: [Promise.name] });
`,
      diagnostic: "literal prose or labelled groups",
    },
    {
      scenario: "an enum value as prose",
      source: `export default Job.statement({ kind: PromptKind.BulletList, items: [TaskKind.Statement] });
`,
      diagnostic: "literal prose or labelled groups",
    },
    {
      scenario: "sparse bullet items",
      source: `export default Job.statement({ kind: PromptKind.BulletList, items: [, "Read context."] });
`,
      diagnostic: "Unexpected comma",
    },
    {
      scenario: "spread bullet items",
      source: `export default Job.statement({ kind: PromptKind.BulletList, items: [..."Read context."] });
`,
      diagnostic: "literal prose or labelled groups",
    },
    {
      scenario: "an array passed as a Job entry",
      source: `export default Job.job([new Job()]);
`,
      diagnostic: "Arrays belong only to prompt list items",
    },
    {
      scenario: "arbitrary function calls",
      source: `export default buildJob();`,
      diagnostic: "Call only statement, shellCommand, or job builders",
    },
    {
      scenario: "a type cast bypass",
      source: `export default new Job() as Job;
`,
      diagnostic: "only imports, Job builders",
    },
    {
      scenario: "a runtime side effect",
      source: `console.log("run"); ${GrammarCases.root}`,
      diagnostic: "only imports, Job builders",
    },
    {
      scenario: "an arbitrary implementation import",
      source: `import runner from "./runner.ts"; ${GrammarCases.root}`,
      diagnostic: "Import only the Lace model or another receipt",
    },
    {
      scenario: "a dynamic job spread",
      source: `import common from "./common.lace.ts";
export default Job.job(...common);
`,
      diagnostic: "only imports, Job builders",
    },
    {
      scenario: "template interpolation",
      source:
        "export default Job.statement({ kind: PromptKind.Paragraph, content: `Read ${context}.` });\n",
      diagnostic: "without interpolation",
    },
    {
      scenario: "ambient runtime values",
      source: `export default Job.statement({ kind: PromptKind.Paragraph, content: Promise.name });
`,
      diagnostic: "prompt content, labels, and commands as literals",
    },
    {
      scenario: "an ambient value in a quoted command field",
      source: `export default Job.shellCommand({
    "cwd": WorkingDirectory.LibraryRoot, "script": String.name
});
`,
      diagnostic: "prompt content, labels, and commands as literals",
    },
    {
      scenario: "an ambient prototype instead of a static job",
      source: `export default Job.job(Function.prototype);
`,
      diagnostic: "Member access is limited",
    },
    {
      scenario: "an ambient value in an enum field",
      source: `export default Job.job({ kind: Function.prototype, prompt: { kind: PromptKind.Paragraph, content: "Read context." } });
`,
      diagnostic: "Use PromptKind for kind",
    },
    {
      scenario: "computed enum access",
      source: `export default Job.job({ kind: TaskKind["Statement"], prompt: { kind: PromptKind.Paragraph, content: "Read context." } });
`,
      diagnostic: "Member access is limited",
    },
  ];
}
test("literal statements, nested Jobs, and static imports pass the grammar", () => {
  const source = `${GrammarCases.imports}import common from "./common.lace.ts";
export default Job.job(common).job(Job.job(common)).statement({ kind: PromptKind.Paragraph, content: \`Read the context.
Then apply its instructions.\` }).shellCommand({
    "cwd": WorkingDirectory.LibraryRoot,
    "script": "bun run --filter @meta-cortex/lace check"
});
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
  ).toContain("default-export a Job builder chain");
});
test("a receipt can reuse an AGENTS.ts default job", () => {
  const source = `${GrammarCases.imports}import lace from "../../lace/AGENTS.ts";
export default Job.job(lace);
`;
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});
test("AGENTS.ts imports must select the default job", () => {
  const source = `${GrammarCases.imports}import { context } from "../../lace/AGENTS.ts";
export default Job.job(context);
`;
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "Import a receipt's default job",
  );
});
test("the grammar rejects ambient strings that the compiler accepts", () => {
  const source = `import { Job, TaskKind, PromptKind } from "../../src/ts/lace.ts";
export default Job.statement({ kind: PromptKind.Paragraph, content: Promise.name });
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages().join("\n")).toContain(
    "prompt content, labels, and commands as literals",
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
    "Call only statement, shellCommand, or job builders",
  );
});
