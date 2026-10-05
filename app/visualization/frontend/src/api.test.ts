import { afterEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { DashboardApi, ReadFailureKind } from "./api";
import type {
  DesktopFailure,
  DesktopReply,
  FeatureWorkflow,
} from "./contracts";
import { Fixture } from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
afterEach(() => native.invoke.mockReset());
interface InvalidInput {
  name: string;
  raw: unknown;
}
const reply = new Fixture().reply();
const summary = new Fixture().summary;
const invalidReplies: ReadonlyArray<InvalidInput> = [
  { name: "scalar reply", raw: "invalid" },
  { name: "null features", raw: { features: null } },
  {
    name: "unknown page end",
    raw: { features: { records: [], end: "Unknown" } },
  },
  {
    name: "unknown condition",
    raw: {
      features: {
        records: [
          {
            kind: "current",
            summary: {
              ...summary,
              totals: { ...summary.totals, condition: "dreaming" },
            },
          },
        ],
        end: "Complete",
      },
    },
  },
  {
    name: "unknown outcome state",
    raw: {
      features: {
        records: [
          {
            kind: "current",
            summary: {
              ...summary,
              outcomes: [{ task: "x", status: "dreaming", last_update: 1 }],
            },
          },
        ],
        end: "Complete",
      },
    },
  },
  {
    name: "blocked work without a reason",
    raw: {
      features: {
        records: [
          {
            kind: "current",
            summary: {
              ...summary,
              active: [{ ...summary.active[0], blocker: { kind: "blocked" } }],
            },
          },
        ],
        end: "Complete",
      },
    },
  },
  {
    name: "forbidden feature field",
    raw: {
      features: {
        records: [
          {
            kind: "current",
            summary: {
              ...summary,
              feature: { ...summary.feature, unexpected: true },
            },
          },
        ],
        end: "Complete",
      },
    },
  },
];
it.each(invalidReplies)("rejects native $name", async ({ raw }) => {
  native.invoke.mockResolvedValueOnce(raw);
  const result = await Effect.runPromise(
    Effect.result(new DashboardApi().read()),
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
      Effect.result(new DashboardApi().read()),
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
    await Effect.runPromise(Effect.result(new DashboardApi().read())),
  ).toMatchObject({ _tag: "Failure", failure });
});
it("validates native replies and preserves Unicode and permitted extensions", async () => {
  const fixture = new Fixture();
  fixture.summary.feature.objective = "🚀 日本語 e\u0301";
  const extended: DesktopReply = {
    ...fixture.reply(),
    extra: "allowed by schema",
  };
  native.invoke.mockResolvedValueOnce(extended);
  expect(await Effect.runPromise(new DashboardApi().read())).toEqual(extended);
  expect(native.invoke).toHaveBeenCalledWith("dashboard_read");
  native.invoke.mockResolvedValueOnce(reply);
  expect(await Effect.runPromise(new DashboardApi().read())).toEqual(reply);
});

it("validates full workflow replies and rejects a malformed event", async () => {
  const workflow = new Fixture().workflow();
  native.invoke.mockResolvedValueOnce(workflow);
  expect(
    await Effect.runPromise(new DashboardApi().workflow(workflow.feature)),
  ).toEqual(workflow);
  native.invoke.mockResolvedValueOnce({
    ...workflow,
    timing: { kind: "Finished", started: 1 },
  });
  expect(
    await Effect.runPromise(
      Effect.result(new DashboardApi().workflow(workflow.feature)),
    ),
  ).toMatchObject({
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply },
  });
});

interface UpgradeArguments {
  feature: string;
}
/** Deliberately incomplete native payload exercises the workflow decoder. */
interface IncompleteWorkflowReply {
  feature: FeatureWorkflow["feature"];
}
interface InvalidUpgradeExpectation {
  _tag: "Failure";
  failure: { kind: ReadFailureKind.InvalidReply };
}
interface NativeUpgradeExpectation {
  _tag: "Failure";
  failure: DesktopFailure;
}

it("validates selected upgrade replies and preserves native failures", async () => {
  const workflow: FeatureWorkflow = new Fixture().workflow();
  native.invoke.mockResolvedValueOnce(workflow);
  expect(
    await Effect.runPromise(new DashboardApi().upgrade(workflow.feature)),
  ).toEqual(workflow);
  const args: UpgradeArguments = { feature: workflow.feature };
  expect(native.invoke).toHaveBeenCalledWith("dashboard_upgrade", args);
  const malformed: IncompleteWorkflowReply = { feature: workflow.feature };
  native.invoke.mockResolvedValueOnce(malformed);
  const invalid: InvalidUpgradeExpectation = {
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply },
  };
  expect(
    await Effect.runPromise(
      Effect.result(new DashboardApi().upgrade(workflow.feature)),
    ),
  ).toMatchObject(invalid);
  const failure: DesktopFailure = { kind: "Ledger", message: "Upgrade failed" };
  native.invoke.mockRejectedValueOnce(failure);
  const rejected: NativeUpgradeExpectation = { _tag: "Failure", failure };
  expect(
    await Effect.runPromise(
      Effect.result(new DashboardApi().upgrade(workflow.feature)),
    ),
  ).toMatchObject(rejected);
});
