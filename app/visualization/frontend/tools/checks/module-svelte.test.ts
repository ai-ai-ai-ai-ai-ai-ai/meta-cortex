// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { ModuleSvelteChecks } from "./module-svelte.ts";

class ModuleFixture {
  run(name: string, source: string) {
    return Effect.gen({ self: this }, function* () {
      const root = yield* Effect.acquireRelease(
        Effect.tryPromise(() =>
          mkdtemp(join(tmpdir(), "native module checks ")),
        ),
        (directory) => this.cleanup(directory),
      );
      const file = join(root, name);
      yield* Effect.tryPromise(() => writeFile(file, source));
      return yield* new ModuleSvelteChecks().check([file]);
    }).pipe(Effect.scoped, Effect.provide(BunServices.layer));
  }

  private cleanup(directory: string) {
    return Effect.promise(() =>
      rm(directory, { recursive: true, force: true }),
    );
  }
}

it("rejects internal imports in ordinary TypeScript with original filenames", () =>
  Effect.runPromise(
    new ModuleFixture()
      .run("ordinary source.ts", 'import "svelte/internal";')
      .pipe(
        Effect.map((findings) => {
          expect(findings.join("\n")).toContain("ordinary source.ts:1:1");
          expect(findings.join("\n")).toContain(
            "Using svelte/internal is prohibited",
          );
        }),
      ),
  ));
it("rejects an aliased async store callback in ordinary JavaScript", () =>
  Effect.runPromise(
    new ModuleFixture()
      .run(
        "ordinary source.js",
        'import { readable as create } from "svelte/store"; export const value = create(0, async () => {});',
      )
      .pipe(
        Effect.map((findings) => {
          expect(findings.join("\n")).toContain("async");
          expect(findings.length).toBe(1);
        }),
      ),
  ));
it("keeps component-only reactivity rules off ordinary modules", () =>
  Effect.runPromise(
    new ModuleFixture()
      .run("ordinary.ts", "export const value = new Map<string,string>();")
      .pipe(Effect.map((findings) => expect(findings).toEqual([]))),
  ));
it("does not reinterpret relative imports as Svelte store imports", () =>
  Effect.runPromise(
    new ModuleFixture()
      .run(
        "relative.js",
        'import { readable } from "./local-module"; export const value = readable(0, async () => {});',
      )
      .pipe(Effect.map((findings) => expect(findings).toEqual([]))),
  ));
