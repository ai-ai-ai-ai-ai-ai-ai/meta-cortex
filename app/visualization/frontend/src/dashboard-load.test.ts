import { afterEach, expect, it, vi } from "vitest";
import { Deferred, Effect } from "effect";
import { waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import type { DesktopFailure, DesktopRead, DesktopReply } from "./contracts";
import { DashboardApi } from "./api";
import { DashboardController, LoadKind } from "./dashboard-state.svelte";
import { Fixture } from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
afterEach(() => native.invoke.mockReset());

it("skips overlapping refreshes and retains the last observation if a refresh fails", async () => {
  const fixture = new Fixture();
  const current = fixture.featuresReply();
  const late = Deferred.makeUnsafe<DesktopReply, DesktopFailure>();
  const transport = Effect.runPromise(Deferred.await(late));
  native.invoke.mockResolvedValueOnce(current).mockReturnValueOnce(transport);
  const dashboard = new DashboardController(new DashboardApi());
  dashboard.load({ kind: "Features", page: 0 });
  await waitFor(() => expect(dashboard.state.kind).toBe(LoadKind.Ready));
  dashboard.refresh();
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(2));
  dashboard.refresh();
  expect(native.invoke).toHaveBeenCalledTimes(2);
  expect(dashboard.reply).toEqual(current);
  const failure: DesktopFailure = {
    kind: "Ledger",
    message: "Refresh unavailable",
  };
  Effect.runSync(Deferred.fail(late, failure));
  await waitFor(() => expect(dashboard.state.kind).toBe(LoadKind.Failed));
  expect(dashboard.reply).toEqual(current);
  expect(dashboard.features).toEqual([fixture.flow.feature]);
  dashboard.stop();
});

it("keeps the newer page and sidebar when an interrupted main reply arrives late", async () => {
  const fixture = new Fixture();
  const first: DesktopRead = { kind: "Features", page: 0 };
  const next: DesktopRead = { kind: "Features", page: 1 };
  const obsolete: DesktopReply = {
    selection: { view: { kind: "Features" }, page: 0 },
    content: { kind: "Features", value: { records: [], end: "More" } },
  };
  const current: DesktopReply = {
    selection: { view: { kind: "Features" }, page: 1 },
    content: {
      kind: "Features",
      value: { records: [fixture.flow.feature], end: "Complete" },
    },
  };
  const late = Deferred.makeUnsafe<DesktopReply>();
  const transport = Effect.runPromise(Deferred.await(late));
  native.invoke.mockReturnValueOnce(transport).mockResolvedValueOnce(current);
  const dashboard = new DashboardController(new DashboardApi());
  dashboard.load(first);
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(1));
  dashboard.page(1);
  await waitFor(() => expect(dashboard.state.kind).toBe(LoadKind.Ready));
  Effect.runSync(Deferred.succeed(late, obsolete));
  await transport;
  await tick();
  expect(dashboard.state.request).toEqual(next);
  expect(dashboard.features).toEqual([fixture.flow.feature]);
  switch (dashboard.state.kind) {
    case LoadKind.Ready:
      expect(dashboard.state.reply).toEqual(current);
      break;
    case LoadKind.Loading:
    case LoadKind.Failed:
      expect(dashboard.state.kind).toBe(LoadKind.Ready);
  }
  dashboard.stop();
});

it("does not replace a current page with an interrupted native failure", async () => {
  const first: DesktopRead = { kind: "Features", page: 0 };
  const next: DesktopRead = { kind: "Features", page: 1 };
  const current: DesktopReply = {
    selection: { view: { kind: "Features" }, page: 1 },
    content: { kind: "Features", value: { records: [], end: "Complete" } },
  };
  const obsolete: DesktopFailure = {
    kind: "Ledger",
    message: "Old read failed",
  };
  const late = Deferred.makeUnsafe<DesktopReply, DesktopFailure>();
  const transport = Effect.runPromise(Deferred.await(late));
  native.invoke.mockReturnValueOnce(transport).mockResolvedValueOnce(current);
  const dashboard = new DashboardController(new DashboardApi());
  dashboard.load(first);
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(1));
  dashboard.load(next);
  await waitFor(() => expect(dashboard.state.kind).toBe(LoadKind.Ready));
  Effect.runSync(Deferred.fail(late, obsolete));
  await Effect.runPromise(Effect.result(Deferred.await(late)));
  await tick();
  expect(dashboard.state.kind).toBe(LoadKind.Ready);
  expect(dashboard.state.request).toEqual(next);
  dashboard.stop();
});

it("keeps the refreshed workflow and navigation when its cancelled sidebar arrives late", async () => {
  const fixture = new Fixture();
  const refreshed = new Fixture();
  refreshed.flow.observed_at = 3000;
  const first: DesktopRead = {
    kind: "Workflow",
    feature: "dashboard",
    page: 0,
  };
  const next: DesktopRead = { kind: "Workflow", feature: "dashboard", page: 1 };
  const original: DesktopReply = {
    selection: { view: { kind: "Tasks", feature: "dashboard" }, page: 0 },
    content: { kind: "Workflow", value: fixture.flow },
  };
  const current: DesktopReply = {
    selection: { view: { kind: "Tasks", feature: "dashboard" }, page: 1 },
    content: { kind: "Workflow", value: refreshed.flow },
  };
  const obsoleteSidebar: DesktopReply = {
    selection: { view: { kind: "Features" }, page: 0 },
    content: { kind: "Features", value: { records: [], end: "Complete" } },
  };
  const currentSidebar: DesktopReply = {
    selection: { view: { kind: "Features" }, page: 0 },
    content: {
      kind: "Features",
      value: { records: [refreshed.flow.feature], end: "Complete" },
    },
  };
  const late = Deferred.makeUnsafe<DesktopReply>();
  const transport = Effect.runPromise(Deferred.await(late));
  native.invoke
    .mockResolvedValueOnce(original)
    .mockReturnValueOnce(transport)
    .mockResolvedValueOnce(current)
    .mockResolvedValueOnce(currentSidebar);
  const dashboard = new DashboardController(new DashboardApi());
  dashboard.load(first);
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(2));
  expect(dashboard.state.kind).toBe(LoadKind.Loading);
  expect(dashboard.currentFeature()).toBe("dashboard");
  dashboard.page(1);
  await waitFor(() => expect(dashboard.state.kind).toBe(LoadKind.Ready));
  Effect.runSync(Deferred.succeed(late, obsoleteSidebar));
  await transport;
  await tick();
  expect(native.invoke).toHaveBeenCalledTimes(4);
  expect(dashboard.state.request).toEqual(next);
  expect(dashboard.features).toEqual([refreshed.flow.feature]);
  switch (dashboard.state.kind) {
    case LoadKind.Ready:
      expect(dashboard.state.reply).toEqual(current);
      break;
    case LoadKind.Loading:
    case LoadKind.Failed:
      expect(dashboard.state.kind).toBe(LoadKind.Ready);
  }
  dashboard.stop();
});
