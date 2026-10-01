import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

class BulletCases {
  static readonly imports = `import { type Job, type BulletList, PromptStatement, WorkingDirectory } from "@meta-cortex/lace";`;
  static receipt(items: string): string {
    return `${BulletCases.imports} const receipt: Job = { stages: { read: { Statement: { prompt: { BulletList: { items: ${items} } } } } } }; export default receipt;`;
  }
}
for (const items of [
  `{ read: "Read context.", 'compile receipt': \`Compile the receipt.\` }`,
  `{ required: { BulletList: { label: "Checks", items: { read: "Read.", checks: { BulletList: { items: { compile: "Compile." } } } } } } }`,
]) {
  test(`named literal bullet maps compile and pass grammar: ${items}`, () => {
    const source = BulletCases.receipt(items);
    expect(new ReceiptCompilation(source).messages()).toEqual([]);
    expect(new ReceiptSyntax(source).messages()).toEqual([]);
  });
}
for (const items of [
  `[]`,
  `["Read."]`,
  `{ read: 42 }`,
  `{ read: { content: "Read." } }`,
  `{ read: { PromptStatement: { content: "Read." } } }`,
  `{ read: PromptStatement.content("Read.") }`,
  `{ read: { BulletList: { items: { read: PromptStatement.content("Read.") } } } }`,
  `{ read: { BulletList: "Read." } }`,
  `{ read: { BulletList: { items: { read: "Read." } }, PromptStatement: { content: "Read." } } }`,
  `{ read: { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } } }`,
]) {
  test(`compiler and grammar reject old or malformed named bullet values: ${items}`, () => {
    const source = BulletCases.receipt(items);
    expect(new ReceiptCompilation(source).messages().length).toBeGreaterThan(0);
    expect(new ReceiptSyntax(source).messages().length).toBeGreaterThan(0);
  });
}
for (const items of [
  `{}`,
  `{ '': "Read." }`,
  `{ ' ': "Read." }`,
  `{ read: "" }`,
  `{ read: " " }`,
  `{ read: \`   \` }`,
  `{ read: \`Read \${Promise.name}\` }`,
  `{ read: Promise.name }`,
  `{ read: "Read." + "Compile." }`,
  `{ ...{} }`,
  `{ ["read"]: "Read." }`,
  `{ read() {} }`,
  `{ read: "Read.", read: "Compile." }`,
  `{ 1: "Read." }`,
  `{ group: { BulletList: { items: {} } } }`,
]) {
  test(`grammar rejects nonliteral malformed or empty named maps: ${items}`, () => {
    expect(
      new ReceiptSyntax(BulletCases.receipt(items)).messages().length,
    ).toBeGreaterThan(0);
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
  test(`arbitrary item and stage name ${name} stays legal at repeated depths`, () => {
    const source = `${BulletCases.imports} const receipt: Job = { stages: { ${name}: { stages: { ${name}: { Statement: { prompt: { BulletList: { items: { ${name}: { BulletList: { items: { ${name}: "Read." } } } } } } } } } } } }; export default receipt;`;
    expect(new ReceiptCompilation(source).messages()).toEqual([]);
    expect(new ReceiptSyntax(source).messages()).toEqual([]);
  });
}
for (const mutation of [
  `list.items.read = "Changed.";`,
  `delete list.items.read;`,
  `list.items.group = { BulletList: nested };`,
  `nested.items.read = "Changed.";`,
  `list.items = {};`,
]) {
  test(`named bullet maps remain readonly: ${mutation}`, () => {
    const source = `${BulletCases.imports} const nested: BulletList = { items: { read: "Read." } }; const list: BulletList = { items: { read: "Read.", group: { BulletList: nested } } }; ${mutation}`;
    expect(new ReceiptCompilation(source).messages().join("\n")).toMatch(
      /only permits reading|read-only property/,
    );
  });
}
test("literal content helper remains allowed only as standalone Statement prompt", () => {
  const source = `${BulletCases.imports} const receipt: Job = { stages: { read: { Statement: { prompt: PromptStatement.content("Read.") } } } }; export default receipt;`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
  expect(
    new ReceiptSyntax(
      source.replace('PromptStatement.content("Read.")', '"Read."'),
    )
      .messages()
      .join("\n"),
  ).toContain("Standalone prompts are mapped");
});
