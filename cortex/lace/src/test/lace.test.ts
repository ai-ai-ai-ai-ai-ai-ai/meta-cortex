import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";

interface RejectedDeclaration {
  readonly scenario: string;
  readonly source: string;
  readonly diagnostic: string;
}

class DeclarationCases {
  static readonly imports = `import { type Job, type BulletList, TaskKind, PromptKind, WorkingDirectory } from "../../src/ts/lace.ts";`;
  static readonly rejected: readonly RejectedDeclaration[] = [
    {
      scenario: "a task at the root",
      source: `{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }`,
      diagnostic: "does not exist in type 'Job'",
    },
    { scenario: "an array at the root", source: `[]`, diagnostic: "stages" },
    {
      scenario: "an arbitrary name-keyed Job",
      source: `{ invented: { stages: {  } } }`,
      diagnostic: "invented",
    },
    { scenario: "a Job without stages", source: `{}`, diagnostic: "stages" },
    {
      scenario: "the removed entries field",
      source: `{ entries: { read: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } } } }`,
      diagnostic: "entries",
    },
    {
      scenario: "a string instead of stages",
      source: `{ stages: "Read context." }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "the old stages array",
      source: `{ stages: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an array instead of a nested Job",
      source: `{ stages: { stage1: [] } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a string instead of a nested Job",
      source: `{ stages: { stage1: "compile" } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an empty object as an entry",
      source: `{ stages: { stage1: {} } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a task without its kind",
      source: `{ stages: { stage1: { prompt: { kind: PromptKind.Statement, content: "Read context." } } } }`,
      diagnostic: "kind",
    },
    {
      scenario: "the replaced instruction kind",
      source: `{ stages: { stage1: { kind: TaskKind.Instruction, prompt: { kind: PromptKind.Statement, content: "Read context." } } } }`,
      diagnostic: "Property 'Instruction' does not exist",
    },
    {
      scenario: "a statement without a prompt",
      source: `{ stages: { stage1: { kind: TaskKind.Statement } } }`,
      diagnostic: "prompt",
    },
    {
      scenario: "the obsolete statement text field",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, text: "Read context." } } }`,
      diagnostic: "text",
    },
    {
      scenario: "a raw string prompt",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: "Read context." } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a prompt statement without content",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement } } } }`,
      diagnostic: "content",
    },
    {
      scenario: "bullet items on a prompt statement",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, items: ["Read context."] } } } }`,
      diagnostic: "items",
    },
    {
      scenario: "a raw string bullet",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: ["Read context."] } } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a bullet list without items",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required" } } } }`,
      diagnostic: "items",
    },
    {
      scenario: "a string instead of bullet items",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required", items: "Read context." } } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a numbered bullet item",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required", items: [42] } } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a numeric bullet label",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: 42, items: [{ kind: PromptKind.Statement, content: "Read context." }] } } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a nested raw string bullet",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: [{ kind: PromptKind.BulletList, items: ["Read context."] }] } } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a nested statement without content",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: [{ kind: PromptKind.Statement }] } } } }`,
      diagnostic: "content",
    },
    {
      scenario: "a shell command as a bullet",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: [{ ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } }] } } } }`,
      diagnostic: "ShellCommand",
    },
    {
      scenario: "the removed enclosed-list enum member",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.Statement, content: "Read context." }] } } } }`,
      diagnostic: "Property 'EnclosedList' does not exist",
    },
    {
      scenario: "the removed enclosed-list discriminator",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: "enclosed-list", items: [{ kind: PromptKind.Statement, content: "Read context." }] } } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a task kind used as a prompt kind",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: TaskKind.Statement, content: "Read context." } } } }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a command without an explicit directory",
      source: `{ stages: { stage1: { ShellCommand: { script: "bun run check" } } } }`,
      diagnostic: "cwd",
    },
    {
      scenario: "a command without script text",
      source: `{ stages: { stage1: { ShellCommand: { cwd: WorkingDirectory.LibraryRoot } } } }`,
      diagnostic: "script",
    },
    {
      scenario: "an unsupported working directory",
      source: `{ stages: { stage1: { ShellCommand: { cwd: "/tmp", script: "bun run check" } } } }`,
      diagnostic: "WorkingDirectory",
    },
    {
      scenario: "command fields on a statement",
      source: `{ stages: { stage1: { kind: TaskKind.Statement, script: "bun run check", prompt: { kind: PromptKind.Statement, content: "Read context." } } } }`,
      diagnostic: "script",
    },
    {
      scenario: "a prompt on a shell command",
      source: `{ stages: { stage1: { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check", prompt: { kind: PromptKind.Statement, content: "Read context." } } } } }`,
      diagnostic: "prompt",
    },
  ];

  static receipt(object: string): string {
    return `${DeclarationCases.imports}\nconst receipt: Job = ${object};\nexport default receipt;`;
  }
}

test("plain objects preserve nesting, static imports, task kinds, and source order", () => {
  const source = `${DeclarationCases.imports}
import compile from "./imported-job.lace.ts";
const checks: Job = { stages: { compile: compile } };
const receipt: Job = {
  stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }, stage2: { stages: { stage1: checks, stage2: { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } } } } },
};
export default receipt;`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("structured bullets permit optional labels, mixed items, and recursive nesting", () => {
  const source =
    DeclarationCases.receipt(`{ stages: { stage1: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }, stage2: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required", items: [{ kind: PromptKind.Statement, content: "Read context." }] } }, stage3: { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, "items": [
      { kind: PromptKind.Statement, content: "Use the existing model." },
      { kind: PromptKind.BulletList, "label": "Prohibited", "items": [{ kind: PromptKind.Statement, content: "Change core during receipt authoring." }] },
      { kind: PromptKind.BulletList, items: [
        { kind: PromptKind.BulletList, label: "Preferred", items: [{ kind: PromptKind.Statement, content: "Read the model first." }] },
      ] },
    ] } } } }`);
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test.each(DeclarationCases.rejected.slice())("rejects $scenario", (example) => {
  const source = DeclarationCases.receipt(example.source);
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test.each([
  {
    scenario: "replacing stages",
    mutation: `receipt.stages = {};`,
    diagnostic: "read-only property",
  },
  {
    scenario: "adding a named stage",
    mutation: `receipt.stages.extra = child;`,
    diagnostic: "only permits reading",
  },
  {
    scenario: "replacing a named stage",
    mutation: `receipt.stages.stage1 = command;`,
    diagnostic: "only permits reading",
  },
  {
    scenario: "deleting a named stage",
    mutation: `delete receipt.stages.stage1;`,
    diagnostic: "only permits reading",
  },
  {
    scenario: "replacing a nested Job's stages",
    mutation: `child.stages = {};`,
    diagnostic: "read-only property",
  },
  {
    scenario: "changing command text",
    mutation: `command.ShellCommand.script = "changed";`,
    diagnostic: "read-only property",
  },
  {
    scenario: "changing prompt content",
    mutation: `prompt.content = "changed";`,
    diagnostic: "read-only property",
  },
  {
    scenario: "changing a bullet label",
    mutation: `bullets.label = "changed";`,
    diagnostic: "read-only property",
  },
  {
    scenario: "appending bullet items",
    mutation: `bullets.items.push(prompt);`,
    diagnostic: "Property 'push' does not exist",
  },
  {
    scenario: "replacing bullet items",
    mutation: `bullets.items = [prompt];`,
    diagnostic: "read-only property",
  },
  {
    scenario: "appending nested bullets",
    mutation: `nested.items.push(bullets);`,
    diagnostic: "Property 'push' does not exist",
  },
])("readonly declarations reject $scenario", (example) => {
  const source = `${DeclarationCases.imports}
import { type ShellCommand, type PromptStatement } from "../../src/ts/lace.ts";
const child: Job = { stages: { read: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } } } };
const command: ShellCommand = { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } };
const prompt: PromptStatement = { kind: PromptKind.Statement, content: "Read context." };
const bullets: BulletList = { kind: PromptKind.BulletList, label: "Required", items: [prompt] };
const nested: BulletList = { kind: PromptKind.BulletList, items: [bullets] };
const receipt: Job = { stages: { stage1: child, stage2: command } };
${example.mutation}`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("the same BulletList type works standalone and recursively nested", () => {
  const source = `${DeclarationCases.imports}
const bullets: BulletList = { kind: PromptKind.BulletList, label: "Required", items: [{ kind: PromptKind.Statement, content: "Read context." }] };
const nested: BulletList = { kind: PromptKind.BulletList, items: [bullets] };
const receipt: Job = { stages: { stage1: { kind: TaskKind.Statement, prompt: bullets }, stage2: { kind: TaskKind.Statement, prompt: nested } } };`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});

test("the removed EnclosedList type has no compatibility alias", () => {
  const source = `import { type EnclosedList } from "../../src/ts/lace.ts";`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "has no exported member 'EnclosedList'",
  );
});

test("unresolvable context imports fail compilation", () => {
  const source = `${DeclarationCases.imports} import missing from "./missing.lace.ts";
const receipt: Job = { stages: { stage1: missing } }; export default receipt;`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "Cannot find module",
  );
});

test("the removed Entry type has no compatibility alias", () => {
  const source = `import { type Entry } from "../../src/ts/lace.ts";`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "has no exported member 'Entry'",
  );
});

test("Stage admits both Jobs and Tasks through the canonical union", () => {
  const source = `${DeclarationCases.imports}
import { type Stage } from "../../src/ts/lace.ts";
const task: Stage = { ShellCommand: { cwd: WorkingDirectory.LibraryRoot, script: "bun run check" } };
const child: Stage = { stages: { run: task } };
const receipt: Job = { stages: { child: child, run: task } };`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});
