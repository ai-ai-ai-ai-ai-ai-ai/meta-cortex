import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

class ShellCases {
  static readonly imports = `import { type Job, WorkingDirectory, PromptStatement } from "../../src/ts/lace.ts";`;
  static readonly shell = `{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } }`;
  static receipt(task: string): string {
    return `${ShellCases.imports} const receipt: Job = { stages: { check: ${task} } }; export default receipt;`;
  }
  static readonly invalid = [
    `{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" }, prompt: PromptStatement.content("Read.") }`,
    `{ kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: "bun run check" }`,
    `{ kind: "shell-command", cwd: WorkingDirectory.LibraryRoot, script: "bun run check" }`,
    `{ ShellCommand: {} }`,
    `{ ShellCommand: { script: "bun run check" } }`,
    `{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot } }`,
    `{ ShellCommand: { cwd: "/tmp", script: "bun run check" } }`,
    `{ ShellCommand: Promise.name }`,
    `{ ShellCommand: [] }`,
    `{ ["ShellCommand"]: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } }`,
    `{ ShellCommand() {} }`,
    `{ ShellCommand: { ...{} } }`,
    `{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "" } }`,
    `{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: Promise.name } }`,
    `{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: PromptStatement.content("Run.") } }`,
    "{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: `Run ${Promise.name}` } }",
  ];
}
for (const task of [
  ShellCases.shell,
  "{ ShellCommand: { cwd: WorkingDirectory.ProjectRoot, script: `bun run check` } }",
  `{ Statement: { prompt: PromptStatement.content("Read.") } }`,
  `{ stages: { ShellCommand: ${ShellCases.shell} } }`,
]) {
  test(`valid shell wrapper and unchanged statement contract: ${task}`, () => {
    const source = ShellCases.receipt(task);
    expect(new ReceiptCompilation(source).messages()).toEqual([]);
    expect(new ReceiptSyntax(source).messages()).toEqual([]);
  });
}
for (const task of ShellCases.invalid) {
  test(`reject malformed shell declaration: ${task}`, () => {
    const source = ShellCases.receipt(task);
    expect(
      [
        ...new ReceiptCompilation(source).messages(),
        ...new ReceiptSyntax(source).messages(),
      ].length,
    ).toBeGreaterThan(0);
  });
}
test("ShellCommand remains an arbitrary stage name at repeated nesting depths", () => {
  const source = `${ShellCases.imports} import shared from "./imported-job.lace.ts";
const receipt: Job = { stages: { ShellCommand: { stages: { ShellCommand: shared, nested: ${ShellCases.shell} } } } }; export default receipt;`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});
for (const source of [
  `const receipt: Job = ${ShellCases.shell};`,
  `const receipt: Job = { stages: { read: { Statement: { prompt: ${ShellCases.shell} } } } };`,
  `const receipt: Job = { stages: { read: { Statement: { prompt: { BulletList: { items: {command: ${ShellCases.shell}} } } } } } };`,
]) {
  test(`grammar rejects wrapper outside task positions: ${source}`, () => {
    expect(
      new ReceiptSyntax(
        `${ShellCases.imports} ${source} export default receipt;`,
      )
        .messages()
        .join("\n"),
    ).toContain("literal payload in their task or prompt position");
  });
}
for (const mutation of [
  `command.ShellCommand = command.ShellCommand;`,
  `command.ShellCommand.cwd = WorkingDirectory.ProjectRoot;`,
  `command.ShellCommand.script = "changed";`,
]) {
  test(`shell wrapper and payload are readonly: ${mutation}`, () => {
    const source = `${ShellCases.imports} import { type Task } from "../../src/ts/lace.ts"; const command: Task = ${ShellCases.shell}; ${mutation}`;
    expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
      "read-only property",
    );
  });
}
test("removed shell task enum has no compatibility alias", () => {
  expect(
    new ReceiptCompilation(
      `${ShellCases.imports} const removed = TaskKind.ShellCommand;`,
    )
      .messages()
      .join("\n"),
  ).toContain("Cannot find name 'TaskKind'");
});
