import { expect, test } from "bun:test";
import { Effect } from "effect";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { RmOptions, MakeDirectoryOptions } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VFile } from "vfile";

type DocumentationFiles = readonly VFile[];
type CheckProcess = Bun.SpawnOptions.OptionsObject<"ignore", "pipe", "pipe"> & {
  cmd: string[];
};

class DocumentationFixture {
  private static readonly library = fileURLToPath(
    new URL("../../../../../../../../../", import.meta.url),
  );
  constructor(readonly root: string) {}

  private static readonly removal: RmOptions = { recursive: true, force: true };
  private static readonly parents: MakeDirectoryOptions = { recursive: true };
  static create() {
    const acquire = Effect.tryPromise(
      async () =>
        new DocumentationFixture(await mkdtemp(join(tmpdir(), "cortex-docs-"))),
    );
    return Effect.acquireRelease(acquire, (fixture) => fixture.remove());
  }

  remove() {
    return Effect.promise(() => rm(this.root, DocumentationFixture.removal));
  }

  readonly write = Effect.fnUntraced(function* (
    this: DocumentationFixture,
    file: VFile,
  ) {
    const path = join(this.root, file.path);
    yield* Effect.tryPromise(() =>
      mkdir(dirname(path), DocumentationFixture.parents),
    );
    yield* Effect.tryPromise(() => writeFile(path, String(file)));
  });

  readonly check = Effect.fnUntraced(function* (
    this: DocumentationFixture,
    files: DocumentationFiles,
  ) {
    const git: CheckProcess = {
      cmd: ["git", "init", this.root],
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    };
    const initialized = yield* Effect.tryPromise(() => Bun.spawn(git).exited);
    expect(initialized).toBe(0);
    for (const file of files) yield* this.write(file);
    const options: CheckProcess = {
      cmd: [process.execPath, "run", "docs:check", this.root],
      cwd: DocumentationFixture.library,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    };
    const child = Bun.spawn(options);
    const code = yield* Effect.tryPromise(() => child.exited);
    const stdout = yield* Effect.tryPromise(() =>
      new Response(child.stdout).text(),
    );
    const stderr = yield* Effect.tryPromise(() =>
      new Response(child.stderr).text(),
    );
    return { code, output: stdout + stderr };
  });
}

test("reads Markdown and checks duplicate-heading anchors across files", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const source = {
          path: "guide.md",
          value:
            "# Guide\n\n[Other](other.md#same-1)\n\n```md\n[Example](missing-example.md)\n```\n",
        };
        const target = {
          path: "other.md",
          value:
            "# Other\n\n## Same\n\nFirst section.\n\n## Same\n\nSecond section.\n",
        };
        const result = yield* fixture.check([
          new VFile(source),
          new VFile(target),
        ]);
        expect(result.output).not.toContain("warning");
        expect(result.code).toBe(0);
      }),
    ),
  ));

test("reports missing files, cross-file headings, undefined references, and prose findings", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const source = {
          path: "guide.md",
          value:
            "# Guide\n\nThe the Typescript guide.\n\n[Wrong](other.md#absent)\n\n[Missing](missing.md)\n\n[Undefined][absent]\n",
        };
        const target = {
          path: "other.md",
          value: "# Other\n\nAvailable content.\n",
        };
        const result = yield* fixture.check([
          new VFile(source),
          new VFile(target),
        ]);
        expect(result.code).not.toBe(0);
        expect(result.output).toContain("Cortex.Names");
        expect(result.output).toContain("Vale.Repetition");
        expect(result.output).toContain("missing-heading-in-file");
        expect(result.output).toContain("missing-file");
        expect(result.output).toContain("no-undefined-references");
      }),
    ),
  ));

test("checks actual sections and does not count quoted or fenced steps as procedure actions", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const source = {
          path: "guide.md",
          value:
            "# Guide\n\n## Empty\n\n## Steps\n\n> 1. Quoted example.\n\n```md\n1. Fenced example.\n```\n\n## Explanation\n\nOne paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\nFourth paragraph.\n\n| Name | Value |\n| --- | --- |\n| X | Y |\n",
        };
        const result = yield* fixture.check([new VFile(source)]);
        expect(result.code).toBe(1);
        expect(result.output).toContain("empty-article");
        expect(result.output).toContain("unordered-procedure");
        expect(result.output).toContain("dense-article");
        expect(result.output).toContain("markdown-table");
      }),
    ),
  ));

test("discovers unindexed practice files and duplicate rule names from the filesystem", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const index = {
          path: "index.md",
          value:
            "# Index\n\n- **File:** [Known](practices/known.md).\n- **[example:rule](practices/known.md#known)**\n- **[example:rule](practices/known.md)**\n",
        };
        const known = {
          path: "practices/known.md",
          value: "# Known\n\nOwned practice.\n",
        };
        const orphan = {
          path: "practices/orphan.md",
          value: "# Orphan\n\nUnindexed practice.\n",
        };
        const result = yield* fixture.check([
          new VFile(index),
          new VFile(known),
          new VFile(orphan),
        ]);
        expect(result.code).toBe(1);
        expect(result.output).toContain("missing-owner-entry");
        expect(result.output).toContain("duplicate-rule");
        expect(result.output).toContain("missing-rule-anchor");
      }),
    ),
  ));

test("fails when no Markdown files match", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const result = yield* fixture.check([]);
        expect(result.code).toBe(2);
        expect(result.output).toContain("No Markdown files matched");
      }),
    ),
  ));
