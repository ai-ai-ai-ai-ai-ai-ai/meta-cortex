import { expect, test } from "bun:test";
import {
  type Job,
  type Task,
  type PromptStatementVariant,
  PromptStatement,
  WorkingDirectory,
} from "@meta-cortex/lace";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

class PublicImportCases {
  static readonly imports = `import { type Job, PromptStatement, WorkingDirectory } from "@meta-cortex/lace";`;
  static readonly receipt = `const receipt: Job = { stages: {
    read: { Statement: { prompt: PromptStatement.content("Read context.") } },
    compile: { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } }
  } }; export default receipt;`;
}

test("public package root provides actual readonly types and inert helper values", () => {
  const prompt: PromptStatementVariant =
    PromptStatement.content("Read context.");
  const receipt: Job = {
    stages: {
      read: { Statement: { prompt: prompt } },
      compile: {
        ShellCommand: {
          cwd: WorkingDirectory.LibraryRoot,
          script: "bun run check",
        },
      },
    },
  };
  const expectedPrompt: PromptStatementVariant = {
    PromptStatement: { content: "Read context." },
  };
  const expectedCommand: Task = {
    ShellCommand: {
      cwd: WorkingDirectory.LibraryRoot,
      script: "bun run check",
    },
  };
  expect(prompt).toEqual(expectedPrompt);
  expect(receipt.stages.compile).toEqual(expectedCommand);
});

test("virtual receipts compile the real public package without import rewriting", () => {
  const source = PublicImportCases.imports + PublicImportCases.receipt;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

for (const source of [
  "@meta-cortex/lace/src/ts/lace.ts",
  "@meta-cortex/lace/private",
  "@meta-cortex/other",
  "../../src/ts/lace.ts",
  "./src/ts/lace.ts",
  "../../lace/src/ts/lace.ts",
  "./implementation.ts",
]) {
  test(`authoring grammar rejects nonpublic model import ${source}`, () => {
    const receipt =
      PublicImportCases.imports.replace("@meta-cortex/lace", source) +
      PublicImportCases.receipt;
    expect(new ReceiptSyntax(receipt).messages().join("\n")).toContain(
      "Import only the Lace model or another receipt",
    );
  });
}
