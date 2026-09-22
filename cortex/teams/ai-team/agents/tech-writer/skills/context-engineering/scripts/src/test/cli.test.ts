import { expect, test } from "bun:test";
import type { CommandArguments } from "../ts/cli.ts";
import type { SpawnOptions } from "bun";
type CliLaunch = Omit<
  SpawnOptions.SpawnSyncOptions<"ignore", "pipe", "pipe">,
  "onExit"
> & { readonly cmd: string[] };

class CliFixture {
  constructor(private readonly arguments_: CommandArguments) {}
  execute() {
    const options: CliLaunch = {
      cmd: [
        process.execPath,
        new URL("../ts/cli.ts", import.meta.url).pathname,
        ...this.arguments_,
      ],
      stdout: "pipe",
      stderr: "pipe",
    };
    return Bun.spawnSync(options);
  }
}

test("CLI produces YAML and uses exit status 0 for discovery", () => {
  const arguments_: CommandArguments = [
    "--request-yaml=version: 1\ntools: {list: {}}",
  ];
  const result = new CliFixture(arguments_).execute();
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("kind: catalog");
  expect(result.stderr.toString()).toBe("");
});

test("CLI rejects extra arguments and does not echo input", () => {
  const arguments_: CommandArguments = ["--request-yaml=secret", "secret"];
  const result = new CliFixture(arguments_).execute();
  expect(result.exitCode).toBe(2);
  expect(result.stdout.toString()).toContain("code: usage");
  expect(result.stdout.toString()).not.toContain("secret");
  expect(result.stderr.toString()).toBe("");
});

test("CLI exits 1 for findings", () => {
  const source =
    "version: 1\narticles:\n  audit:\n    documents:\n      - path: a.md\n        blocks:\n          - {kind: heading, depth: 2, line: 1, text: Empty}";
  const arguments_: CommandArguments = [`--request-yaml=${source}`];
  const result = new CliFixture(arguments_).execute();
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toContain("code: empty-article");
});
