// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { expect, it } from "vitest";
import { CheckCommand } from "./command.ts";

class StandardLintFixture {
  run = Effect.fn("StandardLintFixture.run")(function* (
    this: StandardLintFixture,
    source: string,
    filename: string = "fixture.ts",
  ) {
    const directory = yield* Effect.acquireRelease(
      Effect.tryPromise(() => mkdtemp(join(tmpdir(), "standard lint checks "))),
      (directory) => this.cleanup(directory),
    );
    const file = join(directory, filename);
    yield* Effect.tryPromise(() => writeFile(file, source));
    const result = yield* new CheckCommand().run([
      "run",
      "oxlint",
      "--config",
      "tools/checks/oxlint.json",
      "--no-ignore",
      "--format",
      "json",
      file,
    ]);
    const report = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(
        Schema.Struct({
          diagnostics: Schema.Array(
            Schema.Struct({ code: Schema.optional(Schema.String) }),
          ),
          number_of_files: Schema.Number,
        }),
      ),
    )(result.stdout);
    return {
      status: result.status,
      report,
      codes: report.diagnostics.map((finding) => finding.code),
    };
  });

  private cleanup(directory: string) {
    return Effect.promise(() =>
      rm(directory, { recursive: true, force: true }),
    );
  }
}

it("uses native bug checks while preserving constructor callback restrictions", () =>
  Effect.runPromise(
    new StandardLintFixture()
      .run(
        `
export const filled = Array(3).fill({});
export const replaced = "xx".replaceAll(/x/, "y");
debugger;
for (let index = 0; index < 10; index--) { console.log(index); }
export const promise = new Promise(async () => {});
export const nested = new Promise(() => new Promise(() => new Promise(() => {})));
export function depth() { for (;;) { for (;;) { for (;;) { break; } break; } break; } }
`,
      )
      .pipe(
        Effect.map(({ status, report, codes }) => {
          expect(status).toBe(1);
          expect(report.number_of_files).toBe(1);
          expect(codes).toEqual(
            expect.arrayContaining([
              "unicorn(no-array-fill-with-reference-type)",
              "oxc(bad-replace-all-arg)",
              "eslint(no-debugger)",
              "eslint(for-direction)",
              "eslint(no-async-promise-executor)",
              "eslint(max-depth)",
              "eslint-js(max-nested-callbacks)",
            ]),
          );
        }),
        Effect.scoped,
        Effect.provide(BunServices.layer),
      ),
  ));

it("rejects accidentally focused tests with the test-only native plugin", () =>
  Effect.runPromise(
    new StandardLintFixture()
      .run(
        'import { it } from "vitest"; it.only("focused", () => {});',
        "fixture.test.ts",
      )
      .pipe(
        Effect.map(({ status, codes }) => {
          expect(status).toBe(1);
          expect(codes).toContain("vitest(no-focused-tests)");
        }),
        Effect.scoped,
        Effect.provide(BunServices.layer),
      ),
  ));

it("accepts valid standard operations and callbacks within the existing limit", () =>
  Effect.runPromise(
    new StandardLintFixture()
      .run(
        `
export const filled = Array(3).fill("safe");
export const replaced = "xx".replaceAll(/x/g, "y");
export const nested = new Promise(() => new Promise(() => {}));
for (let index = 0; index < 10; index++) { console.log(index); }
`,
      )
      .pipe(
        Effect.map(({ status, report }) => {
          expect(status).toBe(0);
          expect(report.diagnostics).toEqual([]);
        }),
        Effect.scoped,
        Effect.provide(BunServices.layer),
      ),
  ));
