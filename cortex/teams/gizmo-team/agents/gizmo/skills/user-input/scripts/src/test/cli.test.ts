import { expect, test } from "bun:test";
import type { SpawnOptions } from "bun";

type CliLaunch = Omit<
  SpawnOptions.SpawnSyncOptions<Uint8Array, "pipe", "pipe">,
  "onExit"
> & { readonly cmd: string[] };
export interface CliInput {
  readonly arguments: readonly string[];
  readonly request: string;
}
class CliScenario {
  static readonly developmentSchema = new URL(
    "../../../../../../../../../development.yaml",
    import.meta.url,
  ).pathname;
  static readonly profileSchema = new URL(
    "../../../examples/profile.yaml",
    import.meta.url,
  ).pathname;
  constructor(private readonly input: CliInput) {}
  execute() {
    const options: CliLaunch = {
      cmd: [
        process.execPath,
        new URL("../ts/cli.ts", import.meta.url).pathname,
        ...this.input.arguments,
      ],
      stdin: new TextEncoder().encode(this.input.request),
      stdout: "pipe",
      stderr: "pipe",
    };
    return Bun.spawnSync(options);
  }
}

test("CLI emits the shipped development-mode native question", () => {
  const input: CliInput = {
    arguments: [`--schema=${CliScenario.developmentSchema}`],
    request:
      '{"version":1,"state":{"answers":{},"skipped":[]},"event":{"type":"start"}}',
  };
  const result = new CliScenario(input).execute();
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('"field":"development.mode"');
  expect(result.stdout.toString()).toContain(
    '"options":["single_agent","multi_agent"]',
  );
  expect(result.stderr.toString()).toBe("");
});

test.each(["single_agent", "multi_agent"])(
  "CLI requires delivery after accepting development mode %s",
  (mode) => {
    const input: CliInput = {
      arguments: [`--schema=${CliScenario.developmentSchema}`],
      request: `{"version":1,"state":{"answers":{},"skipped":[]},"event":{"type":"answer","name":"development.mode","value":"${mode}"}}`,
    };
    const result = new CliScenario(input).execute();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('"status":"pending"');
    expect(result.stdout.toString()).toContain(`"development.mode":"${mode}"`);
    expect(result.stdout.toString()).toContain(
      '"field":"development.delivery"',
    );
    expect(result.stdout.toString()).toContain(
      '"options":["create_pr","local_only"]',
    );

    for (const delivery of ["create_pr", "local_only"]) {
      const selection: CliInput = {
        arguments: [`--schema=${CliScenario.developmentSchema}`],
        request: `{"version":1,"state":{"answers":{"development.mode":"${mode}"},"skipped":[]},"event":{"type":"answer","name":"development.delivery","value":"${delivery}"}}`,
      };
      const completed = new CliScenario(selection).execute();
      expect(completed.exitCode).toBe(0);
      expect(completed.stdout.toString()).toContain('"status":"complete"');
      expect(completed.stdout.toString()).toContain(
        `"development.mode":"${mode}"`,
      );
      expect(completed.stdout.toString()).toContain(
        `"development.delivery":"${delivery}"`,
      );
      expect(completed.stdout.toString()).toContain('"issues":[]');
    }
  },
);

test.each([
  '{"type":"start"}',
  '{"type":"skip","name":"development.delivery"}',
  '{"type":"answer","name":"development.delivery","value":"invalid"}',
])("CLI does not default an unanswered delivery choice: %s", (event) => {
  const input: CliInput = {
    arguments: [`--schema=${CliScenario.developmentSchema}`],
    request: `{"version":1,"state":{"answers":{"development.mode":"single_agent"},"skipped":[]},"event":${event}}`,
  };
  const result = new CliScenario(input).execute();
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('"status":"pending"');
  expect(result.stdout.toString()).toContain('"field":"development.delivery"');
  expect(result.stdout.toString()).toContain(
    '"answers":{"development.mode":"single_agent"}',
  );
});

test("CLI loads the shipped profile example", () => {
  const input: CliInput = {
    arguments: [`--schema=${CliScenario.profileSchema}`],
    request:
      '{"version":1,"state":{"answers":{},"skipped":[]},"event":{"type":"start"}}',
  };
  const result = new CliScenario(input).execute();
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('"field":"name"');
});

test("CLI rejects malformed input without echoing submitted data", () => {
  const input: CliInput = {
    arguments: [`--schema=${CliScenario.developmentSchema}`],
    request: "private-answer: [",
  };
  const result = new CliScenario(input).execute();
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toContain('"error":"invalid_yaml"');
  expect(result.stdout.toString()).not.toContain("private-answer");
  expect(result.stderr.toString()).toBe("");
});

test("CLI reports unsupported invocation and missing schema", () => {
  const usage: CliInput = { arguments: [], request: "" };
  const missing: CliInput = {
    arguments: ["--schema=/nonexistent/meta-cortex-form.yaml"],
    request: "",
  };
  expect(new CliScenario(usage).execute().exitCode).toBe(1);
  const result = new CliScenario(missing).execute();
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toContain('"error":"io"');
});
