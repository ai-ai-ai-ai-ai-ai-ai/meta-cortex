import { expect, test } from "bun:test";
import type { SpawnOptions } from "bun";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { RmOptions } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";

type CliLaunch = Omit<
  SpawnOptions.SpawnSyncOptions<"ignore", "pipe", "pipe">,
  "onExit"
> & { readonly cmd: string[] };

class RootCheckScenario {
  private constructor(private readonly directory: string) {}

  static scoped() {
    return Effect.acquireRelease(
      Effect.try(
        () =>
          new RootCheckScenario(mkdtempSync(join(tmpdir(), "cortex-root-"))),
      ),
      (scenario) => Effect.sync(() => scenario.remove()),
    );
  }

  writeConfiguration() {
    return Effect.try(() => {
      writeFileSync(
        join(this.directory, "meta-cortex.toml"),
        "not valid TOML [",
      );
    });
  }

  createDirectoryNamedConfiguration() {
    return Effect.try(() => {
      mkdirSync(join(this.directory, "meta-cortex.toml"));
    });
  }

  execute() {
    const launch: CliLaunch = {
      cmd: [
        process.execPath,
        fileURLToPath(new URL("../ts/check-library-root.ts", import.meta.url)),
      ],
      cwd: this.directory,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    };
    return Effect.try(() => Bun.spawnSync(launch));
  }

  private remove(): void {
    const options: RmOptions = { recursive: true, force: true };
    rmSync(this.directory, options);
  }
}

test("accepts an existing configuration without parsing its contents", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const scenario = yield* RootCheckScenario.scoped();
      yield* scenario.writeConfiguration();
      const result = yield* scenario.execute();
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain("Found meta-cortex.toml");
      expect(result.stderr.toString()).toBe("");
    }).pipe(Effect.scoped),
  );
});

test("fails when the current directory has no configuration", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const scenario = yield* RootCheckScenario.scoped();
      const result = yield* scenario.execute();
      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toBe("");
      expect(result.stderr.toString()).toContain("Missing meta-cortex.toml");
    }).pipe(Effect.scoped),
  );
});

test("a directory named meta-cortex.toml does not count as a file", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const scenario = yield* RootCheckScenario.scoped();
      yield* scenario.createDirectoryNamedConfiguration();
      const result = yield* scenario.execute();
      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toBe("");
      expect(result.stderr.toString()).toContain("Missing meta-cortex.toml");
    }).pipe(Effect.scoped),
  );
});
