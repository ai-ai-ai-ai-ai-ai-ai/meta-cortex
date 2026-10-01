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
    { scenario: "an array at the root", source: `[]`, diagnostic: "entries" },
    {
      scenario: "an arbitrary name-keyed Job",
      source: `{ invented: { entries: [] } }`,
      diagnostic: "invented",
    },
    { scenario: "a Job without entries", source: `{}`, diagnostic: "entries" },
    {
      scenario: "a string instead of entries",
      source: `{ entries: "Read context." }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an array instead of a nested Job",
      source: `{ entries: [[]] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a string instead of a nested Job",
      source: `{ entries: ["compile"] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an empty object as an entry",
      source: `{ entries: [{}] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a task without its kind",
      source: `{ entries: [{ prompt: { kind: PromptKind.Statement, content: "Read context." } }] }`,
      diagnostic: "kind",
    },
    {
      scenario: "the replaced instruction kind",
      source: `{ entries: [{ kind: TaskKind.Instruction, prompt: { kind: PromptKind.Statement, content: "Read context." } }] }`,
      diagnostic: "Property 'Instruction' does not exist",
    },
    {
      scenario: "a statement without a prompt",
      source: `{ entries: [{ kind: TaskKind.Statement }] }`,
      diagnostic: "prompt",
    },
    {
      scenario: "the obsolete statement text field",
      source: `{ entries: [{ kind: TaskKind.Statement, text: "Read context." }] }`,
      diagnostic: "text",
    },
    {
      scenario: "a raw string prompt",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: "Read context." }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a prompt statement without content",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement } }] }`,
      diagnostic: "content",
    },
    {
      scenario: "bullet items on a prompt statement",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, items: ["Read context."] } }] }`,
      diagnostic: "items",
    },
    {
      scenario: "a raw string bullet",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: ["Read context."] } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a bullet list without items",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required" } }] }`,
      diagnostic: "items",
    },
    {
      scenario: "a string instead of bullet items",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required", items: "Read context." } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a numbered bullet item",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required", items: [42] } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a numeric bullet label",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: 42, items: [{ kind: PromptKind.Statement, content: "Read context." }] } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a nested raw string bullet",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: [{ kind: PromptKind.BulletList, items: ["Read context."] }] } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a nested statement without content",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: [{ kind: PromptKind.Statement }] } }] }`,
      diagnostic: "content",
    },
    {
      scenario: "a shell command as a bullet",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, items: [{ kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: "bun run check" }] } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "the removed enclosed-list enum member",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.Statement, content: "Read context." }] } }] }`,
      diagnostic: "Property 'EnclosedList' does not exist",
    },
    {
      scenario: "the removed enclosed-list discriminator",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: "enclosed-list", items: [{ kind: PromptKind.Statement, content: "Read context." }] } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a task kind used as a prompt kind",
      source: `{ entries: [{ kind: TaskKind.Statement, prompt: { kind: TaskKind.Statement, content: "Read context." } }] }`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a command without an explicit directory",
      source: `{ entries: [{ kind: TaskKind.ShellCommand, script: "bun run check" }] }`,
      diagnostic: "cwd",
    },
    {
      scenario: "a command without script text",
      source: `{ entries: [{ kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot }] }`,
      diagnostic: "script",
    },
    {
      scenario: "an unsupported working directory",
      source: `{ entries: [{ kind: TaskKind.ShellCommand, cwd: "/tmp", script: "bun run check" }] }`,
      diagnostic: "WorkingDirectory",
    },
    {
      scenario: "command fields on a statement",
      source: `{ entries: [{ kind: TaskKind.Statement, script: "bun run check", prompt: { kind: PromptKind.Statement, content: "Read context." } }] }`,
      diagnostic: "script",
    },
    {
      scenario: "a prompt on a shell command",
      source: `{ entries: [{ kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: "bun run check", prompt: { kind: PromptKind.Statement, content: "Read context." } }] }`,
      diagnostic: "prompt",
    },
  ];

  static receipt(object: string): string {
    return `${DeclarationCases.imports}\nconst receipt: Job = ${object};\nexport default receipt;`;
  }
}

test("plain objects preserve nesting, static imports, task kinds, and source order", () => {
  const source = `${DeclarationCases.imports}
import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
const checks: Job = { entries: [compile] };
const receipt: Job = {
  entries: [
    { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } },
    { entries: [checks, { kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: "bun run check" }] },
  ],
};
export default receipt;`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("structured bullets permit optional labels, mixed items, and recursive nesting", () => {
  const source = DeclarationCases.receipt(`{ entries: [
    { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } },
    { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, label: "Required", items: [{ kind: PromptKind.Statement, content: "Read context." }] } },
    { kind: TaskKind.Statement, prompt: { kind: PromptKind.BulletList, "items": [
      { kind: PromptKind.Statement, content: "Use the existing model." },
      { kind: PromptKind.BulletList, "label": "Prohibited", "items": [{ kind: PromptKind.Statement, content: "Change core during receipt authoring." }] },
      { kind: PromptKind.BulletList, items: [
        { kind: PromptKind.BulletList, label: "Preferred", items: [{ kind: PromptKind.Statement, content: "Read the model first." }] },
      ] },
    ] } },
  ] }`);
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
    scenario: "replacing entries",
    mutation: `receipt.entries = [];`,
    diagnostic: "read-only property",
  },
  {
    scenario: "appending entries",
    mutation: `receipt.entries.push(receipt);`,
    diagnostic: "Property 'push' does not exist",
  },
  {
    scenario: "replacing a nested Job's entries",
    mutation: `child.entries = [];`,
    diagnostic: "read-only property",
  },
  {
    scenario: "changing command text",
    mutation: `command.script = "changed";`,
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
const child: Job = { entries: [] };
const command: ShellCommand = { kind: TaskKind.ShellCommand, cwd: WorkingDirectory.LibraryRoot, script: "bun run check" };
const prompt: PromptStatement = { kind: PromptKind.Statement, content: "Read context." };
const bullets: BulletList = { kind: PromptKind.BulletList, label: "Required", items: [prompt] };
const nested: BulletList = { kind: PromptKind.BulletList, items: [bullets] };
const receipt: Job = { entries: [child, command] };
${example.mutation}`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});

test("the same BulletList type works standalone and recursively nested", () => {
  const source = `${DeclarationCases.imports}
const bullets: BulletList = { kind: PromptKind.BulletList, label: "Required", items: [{ kind: PromptKind.Statement, content: "Read context." }] };
const nested: BulletList = { kind: PromptKind.BulletList, items: [bullets] };
const receipt: Job = { entries: [
  { kind: TaskKind.Statement, prompt: bullets },
  { kind: TaskKind.Statement, prompt: nested },
] };`;
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
const receipt: Job = { entries: [missing] }; export default receipt;`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "Cannot find module",
  );
});
