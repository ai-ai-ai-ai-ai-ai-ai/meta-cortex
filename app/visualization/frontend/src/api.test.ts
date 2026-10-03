import { afterEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { DashboardApi, ReadFailureKind } from "./api";
import type { DesktopRead, DesktopReply, DesktopFailure } from "./contracts";
import { Fixture } from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
afterEach(() => native.invoke.mockReset());
const initial: DesktopRead = { kind: "Initial" };
const reply: DesktopReply = {
  content: { kind: "Features", value: { records: [], end: "Complete" } },
  selection: { view: { kind: "Features" }, page: 0 },
};
const task = new Fixture().task;
interface InvalidInput {
  name: string;
  raw: unknown;
}
const invalidReplies: ReadonlyArray<InvalidInput> = [
  { name: "invalid content scalar", raw: { content: "invalid" } },
  {
    name: "unknown content enum",
    raw: {
      ...reply,
      content: { kind: "Unknown", value: { records: [], end: "Complete" } },
    },
  },
  {
    name: "unknown page enum",
    raw: {
      ...reply,
      content: { kind: "Features", value: { records: [], end: "Unknown" } },
    },
  },
  {
    name: "forbidden view field",
    raw: {
      ...reply,
      selection: { view: { kind: "Features", unexpected: true }, page: 0 },
    },
  },
  { name: "null content", raw: { ...reply, content: null } },
  {
    name: "string page scalar",
    raw: { ...reply, selection: { ...reply.selection, page: "0" } },
  },
  ...[
    { name: "legacy task version", raw: { ...task, version: 1 } },
    { name: "future task version", raw: { ...task, version: 3 } },
    {
      name: "flattened TaskV2",
      raw: {
        ...task.common,
        version: 2,
        ownership: task.ownership,
        workspace: task.workspace,
        state: task.state,
      },
    },
    {
      name: "forbidden common field",
      raw: { ...task, common: { ...task.common, unexpected: true } },
    },
    {
      name: "role in wrong team",
      raw: {
        ...task,
        ownership: {
          kind: "Assigned",
          assignment: {
            agent: { team: "Ai", role: "TypescriptVerifier" },
            reports_to: { kind: "Host" },
          },
        },
      },
    },
    {
      name: "missing reporting coordinator",
      raw: {
        ...task,
        ownership: {
          kind: "Assigned",
          assignment: {
            agent: { team: "Development", role: "TypescriptDev" },
            reports_to: { kind: "Gizmo" },
          },
        },
      },
    },
  ].map(({ name, raw }) => ({
    name,
    raw: { content: { kind: "Task", value: raw }, selection: reply.selection },
  })),
];
it.each(invalidReplies)("rejects native $name", async ({ raw }) => {
  native.invoke.mockResolvedValueOnce(raw);
  const result = await Effect.runPromise(
    Effect.result(new DashboardApi().read(initial)),
  );
  expect(result).toMatchObject({
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply, cause: raw },
  });
});
const invalidFailures: ReadonlyArray<InvalidInput> = [
  {
    name: "unknown failure enum",
    raw: { kind: "Unknown", message: "Unrecognized native kind" },
  },
  { name: "null failure message", raw: { kind: "Ledger", message: null } },
  { name: "missing failure message", raw: { kind: "Ledger" } },
];
it.each(invalidFailures)(
  "classifies $name as transport failure",
  async ({ raw }) => {
    native.invoke.mockRejectedValueOnce(raw);
    const result = await Effect.runPromise(
      Effect.result(new DashboardApi().read(initial)),
    );
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { kind: ReadFailureKind.Transport, cause: raw },
    });
  },
);
const failures: DesktopFailure[] = [
  { kind: "Ledger", message: "台帳 🚀" },
  { kind: "Runtime", message: "" },
  { kind: "Native", message: "Native unavailable", extra: "allowed by schema" },
];
it.each(failures)("preserves native $kind failure", async (failure) => {
  native.invoke.mockRejectedValueOnce(failure);
  expect(
    await Effect.runPromise(Effect.result(new DashboardApi().read(initial))),
  ).toMatchObject({ _tag: "Failure", failure });
});
it("validates native replies and preserves Unicode, empty prose and permitted extensions", async () => {
  native.invoke.mockResolvedValueOnce(reply);
  expect(await Effect.runPromise(new DashboardApi().read(initial))).toEqual(
    reply,
  );
  expect(native.invoke).toHaveBeenCalledWith("dashboard_read", {
    request: initial,
  });
  const fixture = new Fixture();
  fixture.task.common.objective = "🚀 日本語 e\u0301";
  fixture.task.common.progress.summary = "";
  const extended: DesktopReply = {
    content: { kind: "Task", value: fixture.task, extra: "allowed by schema" },
    selection: reply.selection,
    extra: "allowed by schema",
  };
  native.invoke.mockResolvedValueOnce(extended);
  expect(await Effect.runPromise(new DashboardApi().read(initial))).toEqual(
    extended,
  );
});

it("accepts completed feature activity with native historical worker and no fabricated Git", async () => {
  const fixture = new Fixture();
  fixture.task.workspace = { kind: "feature" };
  fixture.task.state = {
    kind: "completed",
    agent: { team: "Development", role: "TypescriptDev" },
    attempt: 1,
  };
  fixture.task.ownership = { kind: "Unrecorded" };
  fixture.task.common.checkpoint = { kind: "unrecorded" };
  fixture.contribution.checkpoints = [];
  fixture.contribution.integrations = [];
  fixture.flow.counts = [{ state: "completed", count: 1 }];
  const reply = fixture.workflowReply();
  native.invoke.mockResolvedValueOnce(reply);
  expect(await Effect.runPromise(new DashboardApi().read(initial))).toEqual(
    reply,
  );
});
