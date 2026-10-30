// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { expect, it } from "vitest";
import { CheckCommand } from "./command.ts";

class NativeOutputFixture {
  run = Effect.fn("NativeOutputFixture.run")(function* (
    this: NativeOutputFixture,
  ) {
    const directory = yield* Effect.acquireRelease(
      Effect.tryPromise(() => mkdtemp(join(tmpdir(), "native output checks "))),
      (directory) => this.cleanup(directory),
    );
    const file = join(directory, "large.ts");
    const config = join(directory, "oxlint.json");
    const source = Array.from(
      { length: 1500 },
      (_, index) => `missing${index}();`,
    ).join("\n");
    yield* Effect.tryPromise(() => writeFile(file, source));
    yield* Effect.tryPromise(() =>
      writeFile(config, JSON.stringify({ rules: { "no-undef": "error" } })),
    );
    const result = yield* new CheckCommand().run([
      "run",
      "oxlint",
      "--no-ignore",
      "--config",
      config,
      "--format",
      "json",
      file,
    ]);
    const report = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(
        Schema.Struct({
          diagnostics: Schema.Array(Schema.Struct({ message: Schema.String })),
          number_of_files: Schema.Number,
        }),
      ),
    )(result.stdout);
    return { result, report };
  });

  private cleanup(directory: string) {
    return Effect.promise(() =>
      rm(directory, { recursive: true, force: true }),
    );
  }
}

it("drains a large native lint JSON report before accepting its nonzero exit", () =>
  Effect.runPromise(
    new NativeOutputFixture().run().pipe(
      Effect.map(({ result, report }) => {
        expect(result.status).toBe(1);
        expect(Buffer.byteLength(result.stdout)).toBeGreaterThan(500_000);
        expect(report.number_of_files).toBe(1);
        expect(report.diagnostics).toHaveLength(1500);
      }),
      Effect.scoped,
      Effect.provide(BunServices.layer),
    ),
  ));
