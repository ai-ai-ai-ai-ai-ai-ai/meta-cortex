import { expect, test } from "bun:test";

import { ReceiptCompilation } from "./receipt-compilation.ts";

interface RejectedDeclaration {
  readonly scenario: string;
  readonly source: string;
  readonly diagnostic: string;
}
type RejectedDeclarations = readonly RejectedDeclaration[];

class DeclarationCases {
  static readonly imports = `
import { type Job, NodeKind, WorkingDirectory } from "../ts/lace.ts";
`;

  static readonly rejected: RejectedDeclarations = [
    {
      scenario: "a task at the file root",
      source: `export default { kind: NodeKind.Instruction, text: "Read context." } as const satisfies Job;`,
      diagnostic: "NodeKind.Job",
    },
    {
      scenario: "an unsupported task kind",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: "callback", text: "Read context." } } } as const satisfies Job;`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an instruction without text",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.Instruction } } } as const satisfies Job;`,
      diagnostic: "text",
    },
    {
      scenario: "a command without an explicit directory",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.ShellCommand, script: "bun run check" } } } as const satisfies Job;`,
      diagnostic: "cwd",
    },
    {
      scenario: "a command without script text",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot } } } as const satisfies Job;`,
      diagnostic: "script",
    },
    {
      scenario: "an unsupported working directory",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.ShellCommand, cwd: "/tmp", script: "bun run check" } } } as const satisfies Job;`,
      diagnostic: "WorkingDirectory",
    },
    {
      scenario: "non-node children",
      source: `export default { kind: NodeKind.Job, children: { task: "Read context." } } as const satisfies Job;`,
      diagnostic: "LaceNode",
    },
    {
      scenario: "fields belonging to the other task kind",
      source: `export default { kind: NodeKind.Job, children: { task: { kind: NodeKind.Instruction, script: "bun run check" } } } as const satisfies Job;`,
      diagnostic: "script",
    },
    {
      scenario: "an unresolvable receipt import",
      source: `import missing from "./missing.lace.ts"; export default { kind: NodeKind.Job, children: { missing } } as const satisfies Job;`,
      diagnostic: "Cannot find module",
    },
    {
      scenario: "a nonexistent imported child",
      source: `import common from "../../../teams/dev-team/agents/typescript-dev/receipts/common.lace.ts"; export default { kind: NodeKind.Job, children: { task: common.children.missing } } as const satisfies Job;`,
      diagnostic: "Property 'missing' does not exist",
    },
    {
      scenario: "a circular job import",
      source: `import self from "./compiler-case.lace.ts"; export default { kind: NodeKind.Job, children: { self: self } } as const satisfies Job;`,
      diagnostic: "referenced directly or indirectly in its own initializer",
    },
  ];
}

test("nested jobs compose an imported job and command without executing them", () => {
  const source = `${DeclarationCases.imports}
import common from "../../../teams/dev-team/agents/typescript-dev/receipts/common.lace.ts";
export default {
  kind: NodeKind.Job,
  children: {
    common: common,
    checks: {
      kind: NodeKind.Job,
      children: { compile: common.children.compile_receipts },
    },
    project_status: {
      kind: NodeKind.ShellCommand,
      cwd: WorkingDirectory.ProjectRoot,
      script: "git status --short",
    },
  },
} as const satisfies Job;
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});

test.each(DeclarationCases.rejected.slice())("rejects $scenario", (example) => {
  const source = DeclarationCases.imports + example.source;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("an imported receipt's commands are readonly", () => {
  const source = `
import common from "../../../teams/dev-team/agents/typescript-dev/receipts/common.lace.ts";
common.children.compile_receipts.script = "other command";
`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "read-only property",
  );
});
