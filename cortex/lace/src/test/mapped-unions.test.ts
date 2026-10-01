import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

class MappedCases {
  static readonly imports = `import { type Job, type Task, type Prompt, type Statement, type ShellCommand, type BulletList, PromptStatement, WorkingDirectory } from "../../src/ts/lace.ts";`;
  static readonly statement = `{ Statement: { prompt: PromptStatement.content("Read.") } }`;
  static readonly shell = `{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } }`;
  static readonly text = `{ PromptStatement: { content: "Read." } }`;
  static readonly bullets = `{ BulletList: { items: [PromptStatement.content("Read.")] } }`;
  static receipt(stage: string): string {
    return `${MappedCases.imports} const receipt: Job = { stages: { read: ${stage} } }; export default receipt;`;
  }
}

test("concrete payloads remain plain readonly values outside mapped unions", () => {
  const source = `${MappedCases.imports}
const text: PromptStatement = { content: "Read." };
const bullets: BulletList = { items: [{ PromptStatement: text }] };
const statement: Statement = { prompt: { BulletList: bullets } };
const shell: ShellCommand = { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" };
const tasks: readonly Task[] = [{ Statement: statement }, { ShellCommand: shell }];`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  for (const mutation of [
    `text.content = "Changed.";`,
    `bullets.items = [];`,
    `statement.prompt = PromptStatement.content("Changed.");`,
    `shell.cwd = WorkingDirectory.ProjectRoot;`,
    `shell.script = "changed";`,
  ]) {
    expect(
      new ReceiptCompilation(`${source} ${mutation}`).messages().join("\n"),
    ).toContain("read-only property");
  }
});

for (const example of [
  {
    type: "Task",
    value: `{ Statement: ${MappedCases.statement}.Statement, ShellCommand: ${MappedCases.shell}.ShellCommand }`,
  },
  {
    type: "Prompt",
    value: `{ PromptStatement: ${MappedCases.text}.PromptStatement, BulletList: ${MappedCases.bullets}.BulletList }`,
  },
]) {
  test(`closed ${example.type} rejects structural hybrid variables`, () => {
    const source = `${MappedCases.imports} const hybrid = ${example.value}; const value: ${example.type} = hybrid;`;
    expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
      "not assignable",
    );
  });
}

for (const stage of [
  `{ Statement: { prompt: ${MappedCases.text} }, ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } }`,
  `{ Statement: { prompt: { PromptStatement: { content: "Read." }, BulletList: { items: [${MappedCases.text}] } } } }`,
  `{ Statement: { prompt: { BulletList: { items: [{ PromptStatement: { content: "Read." }, BulletList: { items: [${MappedCases.text}] } }] } } } }`,
  `{ Statement: { prompt: { PromptStatement: Promise.name } } }`,
  `{ Statement: { prompt: { BulletList: Promise.name } } }`,
  `{ Statement: { prompt: { kind: "statement", content: "Read." } } }`,
  `{ kind: "statement", prompt: ${MappedCases.text} }`,
]) {
  test(`compiler and grammar reject nonliteral, old or hybrid mapped shape: ${stage}`, () => {
    const receipt = MappedCases.receipt(stage);
    expect(new ReceiptCompilation(receipt).messages().length).toBeGreaterThan(
      0,
    );
    expect(new ReceiptSyntax(receipt).messages().length).toBeGreaterThan(0);
  });
}

for (const name of [
  "Statement",
  "ShellCommand",
  "PromptStatement",
  "BulletList",
  "stages",
  "entries",
  "prompt",
  "content",
  "label",
  "items",
  "cwd",
  "script",
  "kind",
]) {
  test(`mapped schema name ${name} remains legal at repeated stage depths`, () => {
    const receipt = MappedCases.receipt(
      `{ stages: { ${name}: { stages: { ${name}: ${MappedCases.statement} } } } }`,
    );
    expect(new ReceiptCompilation(receipt).messages()).toEqual([]);
    expect(new ReceiptSyntax(receipt).messages()).toEqual([]);
  });
}
for (const name of ["TaskKind", "PromptKind"]) {
  test(`removed ${name} enum has no alias`, () => {
    expect(
      new ReceiptCompilation(`import { ${name} } from "../../src/ts/lace.ts";`)
        .messages()
        .join("\n"),
    ).toContain(`has no exported member '${name}'`);
  });
}
