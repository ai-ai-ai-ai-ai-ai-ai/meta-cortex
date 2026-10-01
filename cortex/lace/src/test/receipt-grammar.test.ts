import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

class GrammarCases {
  static readonly imports =
    'import { type Job, type Stage, type Statement, WorkingDirectory } from "@meta-cortex/lace";';
  static readonly empty =
    "{ spec: {}, Required: { statements: {} }, Prohibited: { statements: {} } }";
  static receipt(stage: string): string {
    return `${GrammarCases.imports} const receipt: Job = { stages: { context: ${stage} } }; export default receipt;`;
  }
  static statement(statement: string): string {
    return GrammarCases.receipt(
      `{ spec: { context: ${statement} }, Required: { statements: {} }, Prohibited: { statements: {} } }`,
    );
  }
}
for (const source of [
  GrammarCases.imports +
    "const receipt: Job = { stages: {} }; export default receipt;",
  GrammarCases.receipt(GrammarCases.empty),
  GrammarCases.statement('"Read context."'),
  GrammarCases.statement("`Read context.`"),
  GrammarCases.statement(
    '{ content: "Compile context.", ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99" } }',
  ),
  GrammarCases.imports +
    `const read: Statement = "Read."; const context: Stage = { spec: { read: read }, Required: { statements: {} }, Prohibited: { statements: { skip: "Do not skip." } } }; const receipt: Job = { stages: { context: context } }; export default receipt;`,
  GrammarCases.imports +
    'import { context, readContext } from "./imported-context.lace.ts"; const receipt: Job = { stages: { imported: context, local: { spec: { read: readContext }, Required: { statements: {} }, Prohibited: { statements: {} } } } }; export default receipt;',
]) {
  test(`fixed literal context and static composition passes: ${source}`, () => {
    expect(new ReceiptCompilation(source).messages()).toEqual([]);
    expect(new ReceiptSyntax(source).messages()).toEqual([]);
  });
}
for (const name of [
  "stages",
  "spec",
  "Required",
  "Prohibited",
  "statements",
  "content",
  "ShellCommand",
  "cwd",
  "script",
  "Statement",
  "Stage",
  "Job",
  "WorkingDirectory",
  "receipt",
]) {
  test(`arbitrary schema-named keys work at every map position: ${name}`, () => {
    const source =
      GrammarCases.imports +
      `const statement: Statement = { content: "Run.", ShellCommand: { cwd: WorkingDirectory.ProjectRoot, script: "exit 99" } }; const receipt: Job = { stages: { '${name}': { spec: { '${name}': statement }, Required: { statements: { '${name}': "Read." } }, Prohibited: { statements: { '${name}': "Do not skip." } } } } }; export default receipt;`;
    expect(new ReceiptCompilation(source).messages()).toEqual([]);
    expect(new ReceiptSyntax(source).messages()).toEqual([]);
  });
}
for (const statement of [
  '""',
  '" "',
  "` `",
  "42",
  "true",
  "null",
  "[]",
  "`Read ${WorkingDirectory.LibraryRoot}`",
  "Promise.name",
  'Unsupported.make("Read.")',
  '{ content: "Read." }',
  '{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99" } }',
  '{ content: "Run.", ShellCommand: { cwd: "library-root", script: "exit 99" } }',
  '{ content: "Run.", ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: " " } }',
  '{ content: Promise.name, ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99" } }',
  '{ content: "Run.", ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: Promise.name } }',
  '{ content: "Run.", ShellCommand: { cwd: WorkingDirectory["LibraryRoot"], script: "exit 99" } }',
  '{ content: "Run.", ShellCommand: { cwd: WorkingDirectory.Other, script: "exit 99" } }',
  '{ content: "Run.", ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99", extra: "x" } }',
  '{ UnsupportedText: { content: "Read." } }',
  "{ UnsupportedGroup: { statements: {} } }",
  '{ Statement: { prompt: "Read." } }',
  "{ stages: {} }",
  '{ content: "Run.", ShellCommand: Promise.name }',
]) {
  test(`grammar rejects invalid statement syntax: ${statement}`, () => {
    expect(
      new ReceiptSyntax(GrammarCases.statement(statement)).messages().length,
    ).toBeGreaterThan(0);
  });
}
for (const stage of [
  "{}",
  "{ stages: {} }",
  "{ spec: {} }",
  "{ spec: [], Required: { statements: {} }, Prohibited: { statements: {} } }",
  "{ spec: {}, Required: { items: {} }, Prohibited: { statements: {} } }",
  "{ spec: {}, Required: { statements: [] }, Prohibited: { statements: {} } }",
  '{ spec: {}, Required: { statements: {}, label: "Required" }, Prohibited: { statements: {} } }',
  "{ spec: {}, Required: { statements: {} }, Prohibited: { statements: {} }, extra: {} }",
  '{ spec: { read: "Read.", read: "Again." }, Required: { statements: {} }, Prohibited: { statements: {} } }',
  '{ spec: { "": "Read." }, Required: { statements: {} }, Prohibited: { statements: {} } }',
  '{ spec: { 1: "Read." }, Required: { statements: {} }, Prohibited: { statements: {} } }',
  '{ spec: { [WorkingDirectory.LibraryRoot]: "Read." }, Required: { statements: {} }, Prohibited: { statements: {} } }',
  "{ spec: { ...Promise }, Required: { statements: {} }, Prohibited: { statements: {} } }",
  "{ spec: { read() {} }, Required: { statements: {} }, Prohibited: { statements: {} } }",
  "{ spec: Promise.name, Required: { statements: {} }, Prohibited: { statements: {} } }",
]) {
  test(`grammar rejects malformed fixed stage: ${stage}`, () => {
    expect(
      new ReceiptSyntax(GrammarCases.receipt(stage)).messages().length,
    ).toBeGreaterThan(0);
  });
}
for (const source of [
  GrammarCases.imports +
    "const receipt: Job = { stages: [] }; export default receipt;",
  GrammarCases.imports +
    "const receipt: Job = { stages: { ...Promise } }; export default receipt;",
  GrammarCases.imports + "const receipt: Job = { stages: {} };",
  GrammarCases.imports +
    "let receipt: Job = { stages: {} }; export default receipt;",
  GrammarCases.imports +
    "const receipt: Stage = " +
    GrammarCases.empty +
    "; export default receipt;",
  GrammarCases.imports +
    "export const extra: Job = { stages: {} }; const receipt: Job = { stages: {} }; export default receipt;",
  GrammarCases.imports +
    "const receipt: Job = { stages: {} }; export { receipt }; export default receipt;",
]) {
  test(`declaration boundary rejects malformed root: ${source}`, () => {
    expect(new ReceiptSyntax(source).messages().length).toBeGreaterThan(0);
  });
}
