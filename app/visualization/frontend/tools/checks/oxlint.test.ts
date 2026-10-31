// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it.each([
  {
    name: "native bugs and constructor callbacks",
    filename: "fixture.ts",
    source: `
export const filled = Array(3).fill({});
export const replaced = "xx".replaceAll(/x/, "y");
debugger;
for (let index = 0; index < 10; index--) { console.log(index); }
export const promise = new Promise(async () => {});
export const nested = new Promise(() => new Promise(() => new Promise(() => {})));
export function depth() { for (;;) { for (;;) { for (;;) { break; } break; } break; } }
`,
    status: 1,
    rules: [
      "no-array-fill-with-reference-type",
      "bad-replace-all-arg",
      "no-debugger",
      "for-direction",
      "no-async-promise-executor",
      "max-depth",
      "max-nested-callbacks",
    ],
  },
  {
    name: "focused tests",
    filename: "fixture.test.ts",
    source: 'import { it } from "vitest"; it.only("focused", () => {});',
    status: 1,
    rules: ["no-focused-tests"],
  },
  {
    name: "valid native operations and callbacks",
    filename: "fixture.ts",
    source: `
export const filled = Array(3).fill("safe");
export const replaced = "xx".replaceAll(/x/g, "y");
export const nested = new Promise(() => new Promise(() => {}));
for (let index = 0; index < 10; index++) { console.log(index); }
`,
    status: 0,
    rules: [],
  },
])("stock Oxlint handles $name", ({ filename, source, status, rules }) => {
  const directory = mkdtempSync(join(tmpdir(), "stock oxlint "));
  try {
    const file = join(directory, filename);
    writeFileSync(file, source);
    const result = spawnSync(
      "node",
      [
        resolve("node_modules/oxlint/bin/oxlint"),
        "--config",
        resolve(".oxlintrc.json"),
        "--no-ignore",
        "--max-warnings",
        "0",
        file,
      ],
      { encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(status);
    for (const rule of rules) expect(result.stdout).toContain(rule);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
