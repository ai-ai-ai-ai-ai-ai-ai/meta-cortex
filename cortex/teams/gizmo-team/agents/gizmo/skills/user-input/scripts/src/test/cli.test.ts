import { expect, test } from "bun:test";
import type { SpawnOptions } from "bun";
import { IssueCode } from "../ts/answer.ts";
import { FailureCode } from "../ts/failure.ts";
import {
  EventType,
  InputProtocol,
  ProtocolVersion,
  Status,
} from "../ts/protocol.ts";

type CliRequest = typeof InputProtocol.value.Encoded;
type CliEvent = typeof InputProtocol.event.Encoded;

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
  static development(request: CliRequest): CliScenario {
    const input: CliInput = {
      arguments: [`--schema=${CliScenario.developmentSchema}`],
      request: JSON.stringify(request),
    };
    return new CliScenario(input);
  }
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

test("CLI asks only for delivery in the shipped development form", () => {
  const request: CliRequest = {
    version: ProtocolVersion.V2,
    state: { answers: {}, skipped: [] },
    event: { type: EventType.Start },
  };
  const result = CliScenario.development(request).execute();
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain(`"status":"${Status.Pending}"`);
  expect(result.stdout.toString()).toContain('"name":"development.delivery"');
  expect(result.stdout.toString()).toContain(
    '"options":["create_pr","local_only"]',
  );
  expect(result.stdout.toString()).toContain('"answers":{}');
  expect(result.stdout.toString()).not.toContain("development.mode");
  expect(result.stderr.toString()).toBe("");
});

test.each(["create_pr", "local_only"])(
  "CLI completes with explicit delivery %s and retains it on continuation",
  (delivery) => {
    const request: CliRequest = {
      version: ProtocolVersion.V2,
      state: { answers: {}, skipped: [] },
      event: {
        type: EventType.Answer,
        name: "development.delivery",
        value: delivery,
      },
    };
    const result = CliScenario.development(request).execute();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(`"status":"${Status.Complete}"`);
    expect(result.stdout.toString()).toContain(
      `"answers":{"development.delivery":"${delivery}"}`,
    );
    expect(result.stdout.toString()).toContain('"issues":[]');
    expect(result.stdout.toString()).not.toContain("development.mode");
    const continuation: CliRequest = {
      version: ProtocolVersion.V2,
      state: { answers: { "development.delivery": delivery }, skipped: [] },
      event: { type: EventType.Start },
    };
    const resumed = CliScenario.development(continuation).execute();
    expect(resumed.exitCode).toBe(0);
    expect(resumed.stdout.toString()).toBe(result.stdout.toString());
    expect(resumed.stdout.toString()).not.toContain('"prompt"');
    expect(resumed.stderr.toString()).toBe("");
  },
);

test.each([
  { type: EventType.Start },
  { type: EventType.Skip, name: "development.delivery" },
  { type: EventType.Answer, name: "development.delivery", value: "invalid" },
  { type: EventType.Answer, name: "development.delivery", value: "" },
] satisfies readonly CliEvent[])(
  "CLI does not default an unanswered delivery choice: %j",
  (event) => {
    const request: CliRequest = {
      version: ProtocolVersion.V2,
      state: { answers: {}, skipped: [] },
      event,
    };
    const result = CliScenario.development(request).execute();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(`"status":"${Status.Pending}"`);
    expect(result.stdout.toString()).toContain('"name":"development.delivery"');
    expect(result.stdout.toString()).toContain(
      '"state":{"answers":{},"skipped":[]}',
    );
  },
);

test.each([EventType.Cancel, EventType.Unavailable])(
  "CLI leaves delivery unanswered when collection is %s",
  (type) => {
    const request: CliRequest = {
      version: ProtocolVersion.V2,
      state: { answers: {}, skipped: [] },
      event: { type },
    };
    const result = CliScenario.development(request).execute();
    expect(result.exitCode).toBe(0);
    switch (type) {
      case EventType.Cancel:
        expect(result.stdout.toString()).toContain(
          `"status":"${Status.Cancelled}"`,
        );
        break;
      case EventType.Unavailable:
        expect(result.stdout.toString()).toContain(
          `"status":"${Status.Unavailable}"`,
        );
        break;
    }
    expect(result.stdout.toString()).toContain(
      '"state":{"answers":{},"skipped":[]}',
    );
    expect(result.stdout.toString()).not.toContain('"prompt"');
  },
);

test.each([
  { type: EventType.Answer, name: "development.mode", value: "single_agent" },
  { type: EventType.Answer, name: "development.mode", value: "multi_agent" },
  { type: EventType.Skip, name: "development.mode" },
] satisfies readonly CliEvent[])(
  "CLI rejects removed mode events as unknown fields: %j",
  (event) => {
    const request: CliRequest = {
      version: ProtocolVersion.V2,
      state: { answers: {}, skipped: [] },
      event,
    };
    const result = CliScenario.development(request).execute();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(`"status":"${Status.Pending}"`);
    expect(result.stdout.toString()).toContain(
      `"issues":[{"name":"development.mode","code":"${IssueCode.Unknown}"}]`,
    );
    expect(result.stdout.toString()).toContain(
      '"state":{"answers":{},"skipped":[]}',
    );
    expect(result.stdout.toString()).toContain('"name":"development.delivery"');
  },
);

test.each([
  '{"answers":{"development.mode":"single_agent"},"skipped":[]}',
  '{"answers":{"development.mode":"multi_agent"},"skipped":[]}',
  '{"answers":{"development.mode":"multi_agent","development.delivery":"create_pr"},"skipped":[]}',
  '{"answers":{"development.delivery":"local_only"},"skipped":["development.mode"]}',
])("CLI rejects retained removed mode state: %s", (state) => {
  const input: CliInput = {
    arguments: [`--schema=${CliScenario.developmentSchema}`],
    request: `{"version":2,"state":${state},"event":{"type":"start"}}`,
  };
  const result = new CliScenario(input).execute();
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toContain(`"error":"${FailureCode.State}"`);
  expect(result.stdout.toString()).not.toContain('"status"');
  expect(result.stderr.toString()).toBe("");
});

test("CLI loads the shipped profile example", () => {
  const input: CliInput = {
    arguments: [`--schema=${CliScenario.profileSchema}`],
    request:
      '{"version":2,"state":{"answers":{},"skipped":[]},"event":{"type":"start"}}',
  };
  const result = new CliScenario(input).execute();
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('"name":"name"');
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
