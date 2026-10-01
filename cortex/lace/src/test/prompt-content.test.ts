import { expect, test } from "bun:test";
import { PromptKind, PromptStatement } from "../ts/lace.ts";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

class ContentCases {
  static readonly imports = `import { type Job, TaskKind, PromptKind, PromptStatement } from "../../src/ts/lace.ts";`;
  static receipt(prompt: string): string {
    return `${ContentCases.imports} const receipt: Job = { stages: { read: { kind: TaskKind.Statement, prompt: ${prompt} } } }; export default receipt;`;
  }
  static readonly allowed = [
    `PromptStatement.content("Read context.")`,
    "PromptStatement.content(`Read context.\nThen compile.`)",
    `{ kind: PromptKind.BulletList, items: [PromptStatement.content("Read."), { kind: PromptKind.BulletList, items: [PromptStatement.content("Compile.")] }] }`,
    `{ kind: PromptKind.Statement, content: "Plain objects remain supported." }`,
  ];
  static readonly rejected = [
    `PromptStatement.content()`,
    `PromptStatement.content("Read.", "Compile.")`,
    `PromptStatement.content("")`,
    `PromptStatement.content(" \\n ")`,
    "PromptStatement.content(`   `)",
    "PromptStatement.content(`\\n`)",
    "PromptStatement.content(`Read ${PromptKind.Statement}`)",
    `PromptStatement.content(PromptKind.Statement)`,
    `PromptStatement.content("Read." + "Compile.")`,
    `PromptStatement.content(...["Read."])`,
    `PromptStatement["content"]("Read.")`,
    `PromptStatement.content?.("Read.")`,
    `PromptStatement?.content("Read.")`,
    `PromptStatement.other("Read.")`,
    `Other.content("Read.")`,
    `PromptStatement.content(42)`,
    `PromptStatement.content(PromptStatement.content("Read."))`,
  ];
}

test("content helper returns the canonical plain unfrozen prompt object", () => {
  const prompt = PromptStatement.content("Read context.");
  const expected: PromptStatement = {
    kind: PromptKind.Statement,
    content: "Read context.",
  };
  expect(prompt).toEqual(expected);
  expect(Object.getPrototypeOf(prompt)).toBe(Object.prototype);
  expect(Object.isFrozen(prompt)).toBe(false);
  expect(PromptStatement.content(" ").content).toBe(" ");
});
for (const prompt of ContentCases.allowed) {
  test(`literal helper syntax compiles and passes grammar: ${prompt}`, () => {
    const receipt = ContentCases.receipt(prompt);
    expect(new ReceiptCompilation(receipt).messages()).toEqual([]);
    expect(new ReceiptSyntax(receipt).messages()).toEqual([]);
  });
}
for (const prompt of ContentCases.rejected) {
  test(`grammar rejects invalid helper syntax: ${prompt}`, () => {
    expect(
      new ReceiptSyntax(ContentCases.receipt(prompt)).messages().length,
    ).toBeGreaterThan(0);
  });
}
for (const source of [
  `const receipt: Job = PromptStatement.content("Read.");`,
  `const receipt: Job = { stages: { read: PromptStatement.content("Read.") } };`,
  `const receipt: Job = { stages: { read: { kind: TaskKind.ShellCommand, script: PromptStatement.content("Read.") } } };`,
  `const receipt: Job = { stages: { prompt: PromptStatement.content("Read.") } };`,
  `const receipt: Job = { stages: { items: { stages: { read: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: PromptStatement.content("Read.") } } } } } };`,
]) {
  test(`helper rejects a nonprompt position: ${source}`, () => {
    expect(
      new ReceiptSyntax(
        `${ContentCases.imports} ${source} export default receipt;`,
      ).messages().length,
    ).toBeGreaterThan(0);
  });
}
test("helper result retains readonly fields", () => {
  for (const field of ["content", "kind"]) {
    const source = `${ContentCases.imports} const prompt = PromptStatement.content("Read."); prompt.${field} = prompt.${field};`;
    expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
      "read-only property",
    );
  }
});
test("helper uses existing model import and compiler binding constraints", () => {
  const receipt = ContentCases.receipt(`PromptStatement.content("Read.")`);
  expect(
    new ReceiptSyntax(
      receipt.replace("../../src/ts/lace.ts", "./implementation.ts"),
    )
      .messages()
      .join("\n"),
  ).toContain("Import only the Lace model");
  expect(
    new ReceiptCompilation(receipt.replace(", PromptStatement }", " } "))
      .messages()
      .join("\n"),
  ).toContain("Cannot find name 'PromptStatement'");
  expect(
    new ReceiptCompilation(
      receipt.replace("PromptStatement }", "type PromptStatement }"),
    )
      .messages()
      .join("\n"),
  ).toContain("imported using 'import type'");
});

test("PromptStatement helper is not an instance construction API", () => {
  expect(
    new ReceiptCompilation(
      `${ContentCases.imports} const prompt = new PromptStatement();`,
    )
      .messages()
      .join("\n"),
  ).toContain("Cannot create an instance of an abstract class");
});
