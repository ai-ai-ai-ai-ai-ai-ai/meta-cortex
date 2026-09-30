import { expect, test } from "bun:test";
import { ReceiptCompilation } from "./receipt.ts";
import { ReceiptSyntax } from "./receipt-syntax.ts";
import { Job } from "../ts/job.ts";
import {
  PromptKind,
  WorkingDirectory,
  type Prompt,
  type Command,
  type BulletList,
} from "../ts/lace.ts";
interface RejectedDeclaration {
  readonly scenario: string;
  readonly source: string;
  readonly diagnostic: string;
}
type RejectedDeclarations = readonly RejectedDeclaration[];
class DeclarationCases {
  static readonly imports = `
import { Job } from "../../src/ts/job.ts";
import { TaskKind, PromptKind, WorkingDirectory } from "../../src/ts/lace.ts";
`;
  static readonly rejected: RejectedDeclarations = [
    {
      scenario: "a standalone bullet list without a label",
      source: `export default Job.statement({ kind: PromptKind.BulletList, items: ["Read context."] });`,
      diagnostic: "label",
    },
    {
      scenario: "a non-bullet prompt inside an enclosed list",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.Statement, content: "Read context." }] });`,
      diagnostic: "not assignable",
    },
    {
      scenario: "direct construction instead of the builder",
      source: `export default new Job([]);`,
      diagnostic: "private",
    },
    {
      scenario: "a task at the file root",
      source: `const receipt: Job = { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }; export default receipt;`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an arbitrary name-keyed job",
      source: `export default Job.job({ invented: { kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } } });
`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "an array instead of a Job instance",
      source: `export default Job.job([{ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } }]);
`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a plain object imitating a Job instance",
      source: `export default Job.job({});`,
      diagnostic: "content",
    },
    {
      scenario: "a task instead of a nested Job",
      source: `export default Job.job({ kind: TaskKind.Statement, prompt: { kind: PromptKind.Statement, content: "Read context." } });
`,
      diagnostic: "does not exist in type",
    },
    {
      scenario: "the replaced instruction kind",
      source: `export default Job.job({ kind: TaskKind.Instruction, prompt: { kind: PromptKind.Statement, content: "Read context." } });
`,
      diagnostic: "Property 'Instruction' does not exist",
    },
    {
      scenario: "a statement without a prompt",
      source: `export default Job.statement();`,
      diagnostic: "Expected 1 arguments",
    },
    {
      scenario: "the obsolete statement text field",
      source: `export default Job.statement({
    text: "Read context."
});
`,
      diagnostic: "text",
    },
    {
      scenario: "a raw string prompt",
      source: `export default Job.statement("Read context.");
`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a prompt statement without content",
      source: `export default Job.statement({ kind: PromptKind.Statement });
`,
      diagnostic: "content",
    },
    {
      scenario: "bullet items on a prompt statement",
      source: `export default Job.statement({ kind: PromptKind.Statement, items: ["Read context."] });
`,
      diagnostic: "items",
    },
    {
      scenario: "a string instead of bullet items",
      source: `export default Job.statement({ kind: PromptKind.BulletList, label: "Required actions", items: "Read context." });
`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a numbered bullet item",
      source: `export default Job.statement({ kind: PromptKind.BulletList, label: "Required actions", items: [42] });
`,
      diagnostic: "not assignable",
    },
    {
      scenario: "an enclosed group without a label",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.BulletList, items: ["Read context."] }] });
`,
      diagnostic: "label",
    },
    {
      scenario: "an enclosed group without items",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: [{ kind: PromptKind.BulletList, label: "Required actions" }] });
`,
      diagnostic: "items",
    },
    {
      scenario: "unlabelled prose in an enclosed list",
      source: `export default Job.statement({ kind: PromptKind.EnclosedList, items: ["Read context."] });
`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a task kind used as a prompt kind",
      source: `export default Job.statement({ kind: TaskKind.Statement, content: "Read context." });
`,
      diagnostic: "not assignable",
    },
    {
      scenario: "a command without an explicit directory",
      source: `export default Job.shellCommand({
    script: "bun run check"
});
`,
      diagnostic: "cwd",
    },
    {
      scenario: "a command without script text",
      source: `export default Job.shellCommand({
    cwd: WorkingDirectory.LibraryRoot
});
`,
      diagnostic: "script",
    },
    {
      scenario: "an unsupported working directory",
      source: `export default Job.shellCommand({
    cwd: "/tmp", script: "bun run check"
});
`,
      diagnostic: "WorkingDirectory",
    },
    {
      scenario: "a string job name instead of a declared job",
      source: `export default Job.job("compile");
`,
      diagnostic: "not assignable",
    },
    {
      scenario: "fields belonging to the other task kind",
      source: `export default Job.statement({
    script: "bun run check"
});
`,
      diagnostic: "script",
    },
    {
      scenario: "an unresolvable job import",
      source: `import missing from "./missing.lace.ts";
export default Job.job(missing);
`,
      diagnostic: "Cannot find module",
    },
    {
      scenario: "access to an imported job's internal entries",
      source: `import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
export default Job.job(compile.entries[1]);
`,
      diagnostic: "Property 'entries' does not exist",
    },
  ];
}
test("Job builders check static jobs and tasks without executing them", () => {
  const source = `${DeclarationCases.imports}import common from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/common.lace.ts";
import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
export default Job.job(common).job(Job.job(compile)).shellCommand({
    cwd: WorkingDirectory.LibraryRoot,
    script: "bun run --filter @meta-cortex/lace check"
});
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});
test("structured prompts support prompt statements, bullets, and labelled groups", () => {
  const source = `import { Job } from "../../src/ts/job.ts";
import { TaskKind, PromptKind } from "../../src/ts/lace.ts";
export default Job.statement({
    kind: PromptKind.Statement,
    content: "Jobs group Cortex context in source order.",
}).statement({
    kind: PromptKind.BulletList,
    label: "Required actions",
    items: [
        "Every context receipt exports one Job.",
        "Keep Lace unchanged during receipt authoring.",
        "Read the assigned context before editing.",
    ],
}).statement({
    kind: PromptKind.EnclosedList,
    "items": [
        { kind: PromptKind.BulletList, "label": "Prohibited", "items": ["Change the core while writing a receipt."] },
        { kind: PromptKind.BulletList, label: "Preferred", items: ["Use existing Lace declarations."] },
    ],
});
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});
test.each(DeclarationCases.rejected.slice())("rejects $scenario", (example) => {
  const source = DeclarationCases.imports + example.source;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    example.diagnostic,
  );
});
test("an imported job does not expose its storage", () => {
  const source = `
import compile from "../../../teams/ai-team/agents/tech-writer/skills/context-engineering/examples/lace/compile.lace.ts";
compile.content;
`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "Property 'content' is private",
  );
});
test("Job owns immutable state without changing supplied prompts", () => {
  const prompt: Prompt = {
    kind: PromptKind.Statement,
    content: "Read the assigned context.",
  };
  const job = Job.statement(prompt);
  expect(job.size()).toBe(1);
  expect(Object.isFrozen(job)).toBe(true);
  expect(Object.isFrozen(prompt)).toBe(false);
  expect(Reflect.set(job, "entries", [])).toBe(false);
  expect(job.size()).toBe(1);
});
test("nesting returns a new Job and preserves the original", () => {
  const prompt: Prompt = {
    kind: PromptKind.Statement,
    content: "Read the assigned context.",
  };
  const original = Job.statement(prompt);
  const appended = original.job(Job.statement(prompt));
  expect(appended).not.toBe(original);
  expect(original.size()).toBe(1);
  expect(appended.size()).toBe(2);
  expect(Object.isFrozen(appended)).toBe(true);
});
test("shell command declarations are readonly", () => {
  const source = `
import { type ShellCommand, TaskKind, WorkingDirectory } from "../ts/lace.ts";
const command: ShellCommand = {
  kind: TaskKind.ShellCommand,
  cwd: WorkingDirectory.LibraryRoot,
  script: "bun run --filter @meta-cortex/lace check",
};
command.script = "other command";
`;
  expect(new ReceiptCompilation(source).messages().join("\n")).toContain(
    "read-only property",
  );
});
test("nested prompt snapshots leave caller-owned lists mutable", () => {
  const bullets = ["Read the assigned context."];
  const group: BulletList = {
    kind: PromptKind.BulletList,
    label: "Required actions",
    items: bullets,
  };
  const groups = [group];
  const prompt: Prompt = { kind: PromptKind.EnclosedList, items: groups };
  const job = Job.statement(prompt);
  expect(Object.isFrozen(prompt)).toBe(false);
  expect(Object.isFrozen(groups)).toBe(false);
  expect(Object.isFrozen(group)).toBe(false);
  expect(Object.isFrozen(bullets)).toBe(false);
  bullets.push("Compile the receipt.");
  expect(Reflect.set(group, "label", "Updated actions")).toBe(true);
  groups.pop();
  expect(job.size()).toBe(1);
  expect(Object.isFrozen(job)).toBe(true);
});
test("prompt fields and enclosed bullet lists are readonly", () => {
  const source = `
import { type EnclosedList, PromptKind } from "../ts/lace.ts";
const prompt: EnclosedList = {
  kind: PromptKind.EnclosedList,
  items: [{ kind: PromptKind.BulletList, label: "Required actions", items: ["Read context."] }],
};
prompt.items[0]!.label = "Changed label";
prompt.items[0]!.items.push("Changed rules.");
`;
  const messages = new ReceiptCompilation(source).messages().join("\n");
  expect(messages).toContain("read-only property");
  expect(messages).toContain("Property 'push' does not exist");
});

test("local child Jobs compose with chained statements and commands", () => {
  const source = `
import { Job } from "../../src/ts/job.ts";
import { PromptKind, WorkingDirectory } from "../../src/ts/lace.ts";
const childJob = Job.statement({
  kind: PromptKind.BulletList,
  label: "Required actions",
  items: ["Read the assigned context."],
});
export default Job.statement({
  kind: PromptKind.Statement,
  content: "Receipt authoring uses the existing Lace vocabulary.",
}).statement({
  kind: PromptKind.BulletList,
  label: "Required actions",
  items: ["Keep the core unchanged."],
}).job(childJob).shellCommand({
  cwd: WorkingDirectory.LibraryRoot,
  script: "bun run --filter @meta-cortex/lace check",
});
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
  expect(new ReceiptSyntax(source).messages()).toEqual([]);
});

test("every builder starts a nonempty Job and preserves reusable branches", () => {
  const prompt: Prompt = {
    kind: PromptKind.BulletList,
    label: "Required actions",
    items: ["Read the assigned context."],
  };
  const command: Command = {
    cwd: WorkingDirectory.LibraryRoot,
    script: "exit 73",
  };
  const child = Job.statement(prompt);
  const commands = Job.shellCommand(command);
  const nested = Job.job(child);
  const statements = child.statement(prompt);
  const extendedCommands = child.shellCommand(command);
  const extendedChildren = child.job(nested);
  const chain = child.statement(prompt).shellCommand(command).job(nested);
  expect(child.size()).toBe(1);
  expect(commands.size()).toBe(1);
  expect(nested.size()).toBe(1);
  expect(statements.size()).toBe(2);
  expect(extendedCommands.size()).toBe(2);
  expect(extendedChildren.size()).toBe(2);
  expect(chain.size()).toBe(4);
  expect(statements).not.toBe(child);
  expect(extendedCommands).not.toBe(child);
  expect(extendedChildren).not.toBe(child);
  expect(Object.isFrozen(chain)).toBe(true);
  expect(Object.isFrozen(command)).toBe(false);
});

test("the same BulletList type is used alone and inside an EnclosedList", () => {
  const source = `
import { Job } from "../../src/ts/job.ts";
import { PromptKind, type BulletList, type EnclosedList } from "../../src/ts/lace.ts";
const bullets: BulletList = {
  kind: PromptKind.BulletList,
  label: "Required actions",
  items: ["Read the assigned context."],
};
const enclosed: EnclosedList = {
  kind: PromptKind.EnclosedList,
  items: [bullets],
};
export default Job.statement(bullets).statement(enclosed);
`;
  expect(new ReceiptCompilation(source).messages()).toEqual([]);
});
