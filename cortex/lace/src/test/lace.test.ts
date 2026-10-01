import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  type Job,
  type Stage,
  type Statement,
  WorkingDirectory,
} from "@meta-cortex/lace";
import receipt, { context, compileContext } from "./imported-context.lace.ts";
import { ReceiptCompilation } from "./receipt.ts";

class ModelCases {
  static readonly imports =
    'import { type Job, type Stage, type Statement, WorkingDirectory } from "@meta-cortex/lace";';
  static readonly declarations = `${ModelCases.imports} const statement: Statement = { content: "Compile.", ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99" } }; const stage: Stage = { spec: { read: "Read." }, Required: { statements: { compile: statement } }, Prohibited: { statements: {} } }; const receipt: Job = { stages: { context: stage } };`;
}

test("public model and receipt imports construct inert plain data", () => {
  const empty: Job = { stages: {} };
  const stage: Stage = {
    spec: {},
    Required: { statements: {} },
    Prohibited: { statements: {} },
  };
  const statement: Statement = {
    content: "Compile context.",
    ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99" },
  };
  const expectedEmpty: Job = { stages: {} };
  expect(empty).toEqual(expectedEmpty);
  const expectedSpec: Stage["spec"] = {};
  expect(stage.spec).toEqual(expectedSpec);
  expect(compileContext).toEqual(statement);
  expect(receipt.stages.context).toEqual(context);
  expect(Object.isFrozen(receipt)).toBe(false);
});

for (const mutation of [
  "receipt.stages = {};",
  "receipt.stages.context = stage;",
  "stage.spec = {};",
  'stage.spec.read = "Changed.";',
  "stage.Required = { statements: {} };",
  "stage.Prohibited = { statements: {} };",
  "stage.Required.statements = {};",
  'stage.Required.statements.compile = "Changed.";',
  'stage.Prohibited.statements.skip = "Changed.";',
  'statement.content = "Changed.";',
  'statement.ShellCommand = { cwd: WorkingDirectory.ProjectRoot, script: "Changed." };',
  "statement.ShellCommand.cwd = WorkingDirectory.ProjectRoot;",
  'statement.ShellCommand.script = "Changed.";',
]) {
  test(`fixed context fields and maps are readonly: ${mutation}`, () => {
    expect(
      new ReceiptCompilation(ModelCases.declarations + mutation)
        .messages()
        .join("\n"),
    ).toMatch(/read.only|only permits reading/);
  });
}
for (const value of [
  "{ stages: { nested: { stages: {} } } }",
  "{ stages: { context: { spec: {}, Required: { statements: {} } } } }",
  "{ stages: { context: { spec: {}, Required: {}, Prohibited: { statements: {} } } } }",
  '{ stages: { context: { spec: { run: { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "exit 99" } } }, Required: { statements: {} }, Prohibited: { statements: {} } } } }',
  '{ stages: { context: { spec: { read: { content: "Read." } }, Required: { statements: {} }, Prohibited: { statements: {} } } } }',
]) {
  test(`compiler rejects malformed fixed context: ${value}`, () => {
    expect(
      new ReceiptCompilation(
        ModelCases.imports + `const receipt: Job = ${value};`,
      ).messages().length,
    ).toBeGreaterThan(0);
  });
}
test("Lace's own typed entry point compiles", () => {
  const source = readFileSync(
    new URL("../../AGENTS.ts", import.meta.url),
    "utf8",
  );
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});
