import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
class ImportCases {
  static readonly receipt =
    'import { type Job } from "@meta-cortex/lace"; const receipt: Job = { stages: {} }; export default receipt;';
}
test("actual public package root compiles without import rewriting", () => {
  expect(new ReceiptCompilation(ImportCases.receipt).messages()).toEqual([]);
});
