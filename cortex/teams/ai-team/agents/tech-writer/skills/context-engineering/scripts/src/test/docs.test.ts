import { expect, test } from "bun:test";
import { Effect } from "effect";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { RmOptions, MakeDirectoryOptions } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VFile, type Options as FileOptions } from "vfile";
import { stringify } from "yaml";
import { CatalogKind, type Catalog } from "../ts/catalog.ts";

interface CatalogFixture {
  readonly path: string;
  readonly catalog: Catalog;
}

type DocumentationFiles = readonly VFile[];
type CheckProcess = Bun.SpawnOptions.OptionsObject<"ignore", "pipe", "pipe"> & {
  cmd: string[];
};

class DocumentationFixture {
  private static readonly library = fileURLToPath(
    new URL("../../../../../../../../../", import.meta.url),
  );
  constructor(readonly root: string) {}

  catalog(request: CatalogFixture): VFile {
    const options: FileOptions = {
      path: request.path,
      value: stringify(request.catalog),
    };
    return new VFile(options);
  }

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

test("fails when no Markdown files or YAML indexes match", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const result = yield* fixture.check([]);
        expect(result.code).toBe(2);
        expect(result.output).toContain(
          "No Markdown files or YAML indexes matched",
        );
      }),
    ),
  ));

test("follows YAML indexes and validates nested rules and duplicate-heading references", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const root: CatalogFixture = {
          path: "index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Catalog",
            entries: [
              {
                title: "Known",
                path: "practices/known/index.yaml",
                summary: "Known decisions.",
              },
              {
                title: "Comparison",
                path: "checks/index.yaml",
                summary: "Related decisions.",
              },
            ],
          },
        };
        const leaf: CatalogFixture = {
          path: "practices/known/index.yaml",
          catalog: {
            kind: CatalogKind.Practice,
            title: "Known",
            source_title: "Known",
            source: "../known.md",
            owns: ["Known decisions."],
            excludes: [],
            relationships: [],
            related: [],
            rules: [
              {
                id: "known:rule",
                source: "../known.md#same-1",
                items: [
                  'Preserve "quotes": and YAML-like values.\nKeep the exception too.',
                ],
              },
            ],
          },
        };
        const check: CatalogFixture = {
          path: "checks/index.yaml",
          catalog: {
            kind: CatalogKind.Check,
            title: "Check",
            overview: ["Inspect the decision."],
            prohibited: ["Discard the exception."],
            preferred: ["Preserve the exception."],
            compare: [
              { id: "known:rule", source: "../practices/known.md#same-1" },
            ],
          },
        };
        const practice: FileOptions = {
          path: "practices/known.md",
          value:
            "# Known\n\n## Same\n\nFirst section.\n\n## Same\n\nSecond section.\n",
        };
        const result = yield* fixture.check([
          fixture.catalog(root),
          fixture.catalog(leaf),
          fixture.catalog(check),
          new VFile(practice),
        ]);
        expect(result.output).not.toContain("warning");
        expect(result.code).toBe(0);
      }),
    ),
  ));

test("reports lost practice coverage, duplicate ownership and rules, and broken YAML links", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const root: CatalogFixture = {
          path: "index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Catalog",
            entries: [
              {
                title: "Known",
                path: "practices/known/index.yaml",
                summary: "Known decisions.",
              },
              {
                title: "Duplicate",
                path: "practices/duplicate/index.yaml",
                summary: "Duplicate decisions.",
              },
              {
                title: "Missing",
                path: "missing/index.yaml",
                summary: "Missing child.",
              },
            ],
          },
        };
        const leaf: CatalogFixture = {
          path: "practices/known/index.yaml",
          catalog: {
            kind: CatalogKind.Practice,
            title: "Known",
            source_title: "Known",
            source: "../known.md",
            owns: ["Known decisions."],
            excludes: [],
            relationships: [],
            related: [{ title: "Missing", path: "../missing.md" }],
            rules: [
              {
                id: "known:rule",
                source: "../known.md",
                items: ["A rule without an anchor."],
              },
              {
                id: "known:other",
                source: "../known.md#absent",
                items: ["A rule with the wrong anchor."],
              },
            ],
          },
        };
        const duplicate: CatalogFixture = {
          path: "practices/duplicate/index.yaml",
          catalog: leaf.catalog,
        };
        const practice: FileOptions = {
          path: "practices/known.md",
          value: "# Known\n\nKnown practice.\n",
        };
        const orphan: FileOptions = {
          path: "practices/orphan.md",
          value: "# Orphan\n\nUnindexed practice.\n",
        };
        const result = yield* fixture.check([
          fixture.catalog(root),
          fixture.catalog(leaf),
          fixture.catalog(duplicate),
          new VFile(practice),
          new VFile(orphan),
        ]);
        expect(result.code).toBe(1);
        expect(result.output).toContain("missing-owner-entry");
        expect(result.output).toContain("duplicate-owner-entry");
        expect(result.output).toContain("duplicate-rule");
        expect(result.output).toContain("missing-rule-anchor");
        expect(result.output).toContain("missing-heading-in-file");
        expect(result.output).toContain("missing-file");
        expect(result.output).toContain("invalid-catalog");
      }),
    ),
  ));

test.each([
  "kind: navigation\nkind: practice\ntitle: Duplicate keys\nentries: []\n",
  "kind: navigation\ntitle: Empty entries\nentries: []\n",
  "kind: navigation\ntitle: Unknown property\nextra: true\nentries: [{title: Item, path: note.txt, summary: Text}]\n",
  "kind: practice\ntitle: Missing rule metadata\nrules: [{id: malformed}]\n",
])("rejects malformed or incomplete catalogs: %s", (value) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const file: FileOptions = { path: "index.yaml", value };
        const result = yield* fixture.check([new VFile(file)]);
        expect(result.code).toBe(1);
        expect(result.output).toContain("invalid-catalog");
      }),
    ),
  ),
);

test("detects catalog cycles without hanging", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const root: CatalogFixture = {
          path: "index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Root",
            entries: [
              {
                title: "Child",
                path: "child/index.yaml",
                summary: "Child branch.",
              },
            ],
          },
        };
        const child: CatalogFixture = {
          path: "child/index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Child",
            entries: [
              {
                title: "Root",
                path: "../index.yaml",
                summary: "Circular branch.",
              },
            ],
          },
        };
        const result = yield* fixture.check([
          fixture.catalog(root),
          fixture.catalog(child),
        ]);
        expect(result.code).toBe(1);
        expect(result.output).toContain("catalog-cycle");
      }),
    ),
  ));

test("detects unlinked namespace catalogs", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const root: CatalogFixture = {
          path: "index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Root",
            entries: [{ title: "Note", path: "note.txt", summary: "Notes." }],
          },
        };
        const orphan: CatalogFixture = {
          path: "orphan/index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Orphan",
            entries: [
              { title: "Note", path: "../note.txt", summary: "Notes." },
            ],
          },
        };
        const note: FileOptions = { path: "note.txt", value: "Notes." };
        const result = yield* fixture.check([
          fixture.catalog(root),
          fixture.catalog(orphan),
          new VFile(note),
        ]);
        expect(result.code).toBe(1);
        expect(result.output).toContain("unlinked-catalog");
      }),
    ),
  ));

test("accepts a YAML-only selection without invoking Markdown tools with empty inputs", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const root: CatalogFixture = {
          path: "index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Root",
            entries: [{ title: "Note", path: "note.txt", summary: "Notes." }],
          },
        };
        const note: FileOptions = { path: "note.txt", value: "Notes." };
        const result = yield* fixture.check([
          fixture.catalog(root),
          new VFile(note),
        ]);
        expect(result.code).toBe(0);
      }),
    ),
  ));

test("reports unknown comparison IDs and comparisons pointing at another rule section", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const root: CatalogFixture = {
          path: "index.yaml",
          catalog: {
            kind: CatalogKind.Navigation,
            title: "Root",
            entries: [
              {
                title: "Known",
                path: "practices/known/index.yaml",
                summary: "Known decisions.",
              },
              {
                title: "Check",
                path: "checks/index.yaml",
                summary: "Related decisions.",
              },
            ],
          },
        };
        const leaf: CatalogFixture = {
          path: "practices/known/index.yaml",
          catalog: {
            kind: CatalogKind.Practice,
            title: "Known",
            source_title: "Known",
            source: "../known.md",
            owns: ["Known decisions."],
            excludes: [],
            relationships: [],
            related: [],
            rules: [
              {
                id: "known:rule",
                source: "../known.md#first",
                items: ["Use the first rule."],
              },
            ],
          },
        };
        const check: CatalogFixture = {
          path: "checks/index.yaml",
          catalog: {
            kind: CatalogKind.Check,
            title: "Check",
            overview: ["Inspect decisions."],
            prohibited: ["Wrong sources."],
            preferred: ["Canonical sources."],
            compare: [
              { id: "known:rule", source: "../practices/known.md#second" },
              { id: "known:absent", source: "../practices/known.md#first" },
            ],
          },
        };
        const practice: FileOptions = {
          path: "practices/known.md",
          value:
            "# Known\n\n## First\n\nFirst rule.\n\n## Second\n\nSecond rule.\n",
        };
        const result = yield* fixture.check([
          fixture.catalog(root),
          fixture.catalog(leaf),
          fixture.catalog(check),
          new VFile(practice),
        ]);
        expect(result.code).toBe(1);
        expect(result.output).toContain("unknown-rule");
        expect(result.output).toContain("rule-source-mismatch");
      }),
    ),
  ));

test("validates a focused comparison leaf without requiring unrelated rule inventories", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* DocumentationFixture.create();
        const check: CatalogFixture = {
          path: "index.yaml",
          catalog: {
            kind: CatalogKind.Check,
            title: "Focused check",
            overview: ["Inspect conversion."],
            prohibited: ["Discard validation."],
            preferred: ["Preserve validation."],
            compare: [{ id: "known:rule", source: "known.md#known" }],
          },
        };
        const practice: FileOptions = {
          path: "known.md",
          value: "# Known\n\nCanonical rule.\n",
        };
        const result = yield* fixture.check([
          fixture.catalog(check),
          new VFile(practice),
        ]);
        expect(result.code).toBe(0);
      }),
    ),
  ));
