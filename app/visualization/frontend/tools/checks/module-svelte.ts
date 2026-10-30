import { copyFile, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { Effect } from "effect";
import { CheckCommand, CheckFailure } from "./command.ts";

/** Runs the two Svelte rules that also apply to ordinary modules, without enabling component rules. */
export class ModuleSvelteChecks {
  private readonly command = new CheckCommand();

  check = Effect.fn("ModuleSvelteChecks.check")(function* (
    this: ModuleSvelteChecks,
    files: readonly string[],
  ) {
    const root = ".svelte-check/modules";
    yield* Effect.tryPromise(() => rm(root, { recursive: true, force: true }));
    const paths = new Map<string, string>();
    for (const file of files.filter((file) => !/\.svelte\.[jt]s$/.test(file))) {
      const extension = this.extension(file);
      const projected = join(
        root,
        String(paths.size),
        `${basename(file)}.svelte.${extension}`,
      );
      yield* Effect.tryPromise(() =>
        mkdir(dirname(projected), { recursive: true }),
      );
      yield* Effect.tryPromise(() => copyFile(file, projected));
      paths.set(projected, file);
    }
    const result = yield* this.command.run([
      "run",
      "rsvelte-lint",
      "--config",
      "tools/checks/rsvelte-modules.json",
      "--max-warnings",
      "0",
      ...paths.keys(),
    ]);
    const count = result.stdout.match(
      /rsvelte-lint found \d+ errors? and \d+ warnings? in (\d+) files?/,
    );
    switch (Number(count?.[1]) === paths.size) {
      case true:
        break;
      case false:
        return yield* new CheckFailure({
          message: `Native Svelte module scan did not check all ${paths.size} files.\n${result.stdout}${result.stderr}`,
        });
    }
    let output = result.stdout + result.stderr;
    for (const [projected, original] of paths)
      output = output.replaceAll(projected, original);
    switch (result.status) {
      case 0:
        return [];
      default:
        return [output];
    }
  });

  private extension(file: string): "ts" | "js" {
    switch (file.endsWith(".ts")) {
      case true:
        return "ts";
      case false:
        return "js";
    }
  }
}
