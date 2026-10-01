import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";
class ImportCases {
  static readonly receipt =
    'import { type Job } from "@meta-cortex/lace"; const receipt: Job = { stages: {} }; export default receipt;';
}
test("actual public package root compiles without import rewriting", () => {
  expect(new ReceiptCompilation(ImportCases.receipt).messages()).toEqual([]);
  expect(new ReceiptSyntax(ImportCases.receipt).messages()).toEqual([]);
});
for (const source of [
  "@meta-cortex/lace/src/ts/lace.ts",
  "@meta-cortex/lace/private",
  "@meta-cortex/other",
  "../../src/ts/lace.ts",
  "./implementation.ts",
]) {
  test(`nonpublic authoring imports remain rejected: ${source}`, () => {
    expect(
      new ReceiptSyntax(
        ImportCases.receipt.replace("@meta-cortex/lace", source),
      )
        .messages()
        .join("\n"),
    ).toContain("Import only the Lace model or another receipt");
  });
}
