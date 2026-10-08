import { afterEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import {
  DashboardApi,
  NativeCommand,
  ReadFailureKind,
  type RepositoryReadArguments,
  type InvalidNativeReply,
  type NativeTransportFailure,
} from "./api";
import type {
  DesktopFailure,
  DesktopReply,
  FeatureWorkflow,
  StoredFeatureSelection,
  RepositorySelection,
  PageEnd,
} from "./contracts";
import { Fixture } from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
afterEach(() => native.invoke.mockReset());
type InvalidReplyProjection = Pick<InvalidNativeReply, "kind">;
type TransportFailureProjection = Pick<NativeTransportFailure, "kind">;
interface InvalidReplyExpectation {
  _tag: "Failure";
  failure: InvalidReplyProjection;
}
interface TransportFailureExpectation {
  _tag: "Failure";
  failure: TransportFailureProjection;
}
/** Deliberately omits repository_id to exercise the catalog decoder. */
type IncompleteRepositoryIdentity = Pick<RepositorySelection, "name">;
interface IncompleteRepositoryCatalog {
  repositories: IncompleteRepositoryPage;
}
interface IncompleteRepositoryPage {
  end: PageEnd;
  records: ReadonlyArray<IncompleteRepositoryCard>;
}
interface IncompleteRepositoryCard {
  repository: IncompleteRepositoryIdentity;
  feature_count: number;
}
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
    Effect.result(new DashboardApi().features(Fixture.REPOSITORY)),
  );
  const rejected: InvalidReplyExpectation = {
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply },
  };
  expect(result).toMatchObject(rejected);
  expect(result).not.toHaveProperty("failure.cause");
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
      Effect.result(new DashboardApi().features(Fixture.REPOSITORY)),
    );
    const rejected: TransportFailureExpectation = {
      _tag: "Failure",
      failure: { kind: ReadFailureKind.Transport },
    };
    expect(result).toMatchObject(rejected);
    expect(result).not.toHaveProperty("failure.cause");
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
    await Effect.runPromise(
      Effect.result(new DashboardApi().features(Fixture.REPOSITORY)),
    ),
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
  expect(
    await Effect.runPromise(new DashboardApi().features(Fixture.REPOSITORY)),
  ).toEqual(extended);
  const request: RepositoryReadArguments = { repository: Fixture.REPOSITORY };
  expect(native.invoke).toHaveBeenCalledWith("dashboard_features", request);
  native.invoke.mockResolvedValueOnce(reply);
  expect(
    await Effect.runPromise(new DashboardApi().features(Fixture.REPOSITORY)),
  ).toEqual(reply);
});

it("validates full workflow replies and rejects a malformed event", async () => {
  const workflow = new Fixture().workflow();
  const selection: StoredFeatureSelection = {
    repository: Fixture.REPOSITORY,
    feature: workflow.feature,
  };
  native.invoke.mockResolvedValueOnce(workflow);
  expect(
    await Effect.runPromise(new DashboardApi().workflow(selection)),
  ).toEqual(workflow);
  native.invoke.mockResolvedValueOnce({
    ...workflow,
    timing: { kind: "Finished", started: 1 },
  });
  expect(
    await Effect.runPromise(
      Effect.result(new DashboardApi().workflow(selection)),
    ),
  ).toMatchObject({
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply },
  });
});

interface UpgradeArguments {
  selection: StoredFeatureSelection;
}
/** Deliberately incomplete native payload exercises the workflow decoder. */
interface IncompleteWorkflowReply {
  feature: FeatureWorkflow["feature"];
}
interface NativeUpgradeExpectation {
  _tag: "Failure";
  failure: DesktopFailure;
}

it("validates selected upgrade replies and preserves native failures", async () => {
  const workflow: FeatureWorkflow = new Fixture().workflow();
  const selection: StoredFeatureSelection = {
    repository: Fixture.REPOSITORY,
    feature: workflow.feature,
  };
  native.invoke.mockResolvedValueOnce(workflow);
  expect(
    await Effect.runPromise(new DashboardApi().upgrade(selection)),
  ).toEqual(workflow);
  const args: UpgradeArguments = {
    selection: { repository: Fixture.REPOSITORY, feature: workflow.feature },
  };
  expect(native.invoke).toHaveBeenCalledWith("dashboard_upgrade", args);
  const malformed: IncompleteWorkflowReply = { feature: workflow.feature };
  native.invoke.mockResolvedValueOnce(malformed);
  const invalid: InvalidReplyExpectation = {
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply },
  };
  expect(
    await Effect.runPromise(
      Effect.result(new DashboardApi().upgrade(selection)),
    ),
  ).toMatchObject(invalid);
  const failure: DesktopFailure = { kind: "Ledger", message: "Upgrade failed" };
  native.invoke.mockRejectedValueOnce(failure);
  const rejected: NativeUpgradeExpectation = { _tag: "Failure", failure };
  expect(
    await Effect.runPromise(
      Effect.result(new DashboardApi().upgrade(selection)),
    ),
  ).toMatchObject(rejected);
});
it("validates the global repository catalog separately from scoped feature pages", async () => {
  const fixture = new Fixture();
  native.invoke.mockResolvedValueOnce(fixture.catalog());
  expect(await Effect.runPromise(new DashboardApi().read())).toEqual(
    fixture.catalog(),
  );
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read");
  native.invoke.mockResolvedValueOnce(fixture.reply());
  const rejectedFeaturePage: InvalidReplyExpectation = {
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply },
  };
  expect(
    await Effect.runPromise(Effect.result(new DashboardApi().read())),
  ).toMatchObject(rejectedFeaturePage);
  const incomplete: IncompleteRepositoryCatalog = {
    repositories: {
      end: "Complete",
      records: [{ repository: { name: "repo" }, feature_count: 1 }],
    },
  };
  native.invoke.mockResolvedValueOnce(incomplete);
  const rejectedMissingIdentity: InvalidReplyExpectation = {
    _tag: "Failure",
    failure: { kind: ReadFailureKind.InvalidReply },
  };
  expect(
    await Effect.runPromise(Effect.result(new DashboardApi().read())),
  ).toMatchObject(rejectedMissingIdentity);
});
type TransportContextProjection = Pick<
  NativeTransportFailure,
  "kind" | "operation" | "detail"
>;
interface NativeTransportExpectation {
  _tag: "Failure";
  failure: TransportContextProjection;
}
it("preserves concrete transport context without retaining an undecoded rejection", async () => {
  native.invoke.mockRejectedValueOnce(new Error("native connection closed"));
  const result = await Effect.runPromise(
    Effect.result(new DashboardApi().read()),
  );
  const rejected: NativeTransportExpectation = {
    _tag: "Failure",
    failure: {
      kind: ReadFailureKind.Transport,
      operation: NativeCommand.Catalog,
      detail: "Error: native connection closed",
    },
  };
  expect(result).toMatchObject(rejected);
  expect(result).not.toHaveProperty("failure.cause");
});
