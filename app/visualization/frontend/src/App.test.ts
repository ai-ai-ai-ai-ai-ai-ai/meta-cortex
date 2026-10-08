import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
  type ByRoleOptions,
} from "@testing-library/svelte";
import App from "./App.svelte";
import { Effect } from "effect";
import type {
  DesktopCatalogReply,
  DesktopReply,
  FeatureWorkflow,
  DesktopFailure,
} from "./contracts";
import type { WorkflowInvocation } from "./api";
import { Fixture } from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(true),
}));
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
});
type NativeReply = DesktopCatalogReply | DesktopReply | FeatureWorkflow;
class NativeFixture {
  static readonly OPEN_REPOSITORY: ByRoleOptions = {
    name: `Open meta-cortex, ${Fixture.REPOSITORY.repository_id}`,
  };
  constructor(readonly fixture: Fixture) {}
  read(command: string): Promise<NativeReply> {
    switch (command) {
      case "dashboard_read":
        return Effect.runPromise(Effect.succeed(this.fixture.catalog()));
      case "dashboard_features":
        return Effect.runPromise(Effect.succeed(this.fixture.reply()));
      case "dashboard_workflow":
        return Effect.runPromise(Effect.succeed(this.fixture.workflow()));
      default:
        return Effect.runPromise(Effect.fail(new Error("Unexpected command")));
    }
  }
  install(): void {
    native.invoke.mockImplementation((command: string) => this.read(command));
  }
}
it("shows the split cards and briefing with recorded PR, dates and duration", async () => {
  const fixture = new Fixture();
  new NativeFixture(fixture).install();
  render(App);
  await fireEvent.click(
    await screen.findByRole("button", NativeFixture.OPEN_REPOSITORY),
  );
  const panel = await screen.findByRole("article", {
    name: "Selected feature",
  });
  expect(within(panel).getByText("0 sec")).toBeTruthy();
  expect(within(panel).getByText("Started")).toBeTruthy();
  expect(within(panel).getByText("Finished")).toBeTruthy();
  expect(
    within(panel)
      .getByRole("link", { name: "Open pull request 41" })
      .getAttribute("href"),
  ).toBe(fixture.summary.pull_requests[0]?.url);
  const menu = screen.getByRole("group", { name: "Choose a feature" });
  expect(
    within(menu).getByText(fixture.summary.feature.objective),
  ).toBeTruthy();
  expect(
    within(menu)
      .getByRole("button", { name: "Preview Release 0 12 3" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  const request: WorkflowInvocation = {
    selection: {
      repository: Fixture.REPOSITORY,
      feature: fixture.summary.feature.id,
    },
  };
  expect(native.invoke).toHaveBeenCalledWith("dashboard_workflow", request);
});
it("keeps the agent index across Log and Time windows, with revision metadata and command evidence", async () => {
  new NativeFixture(new Fixture()).install();
  render(App);
  await fireEvent.click(
    await screen.findByRole("button", NativeFixture.OPEN_REPOSITORY),
  );
  await fireEvent.click(
    await screen.findByRole("button", { name: "Open workflow" }),
  );
  const index = screen.getByRole("navigation", { name: "Agent index" });
  expect(within(index).getByText("1. Rust Dev")).toBeTruthy();
  expect(screen.getByText("· Task r2")).toBeTruthy();
  expect(screen.getByText("cargo test -p workbench")).toBeTruthy();
  await fireEvent.click(screen.getByRole("tab", { name: "Time windows" }));
  expect(screen.getByRole("navigation", { name: "Agent index" })).toBe(index);
  expect(screen.getByRole("tabpanel", { name: "Time windows" })).toBeTruthy();
  await fireEvent.click(screen.getByRole("tab", { name: "Log" }));
  expect(screen.getByRole("tabpanel", { name: "Log" })).toBeTruthy();
});
it("refreshes summaries without reloading unchanged task history or resetting the selected view", async () => {
  new NativeFixture(new Fixture()).install();
  render(App);
  await fireEvent.click(
    await screen.findByRole("button", NativeFixture.OPEN_REPOSITORY),
  );
  await fireEvent.click(
    await screen.findByRole("button", { name: "Open workflow" }),
  );
  await fireEvent.click(screen.getByRole("tab", { name: "Time windows" }));
  await fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(4));
  expect(
    native.invoke.mock.calls.filter(
      ([command]) => command === "dashboard_workflow",
    ),
  ).toHaveLength(1);
  expect(
    screen
      .getByRole("tab", { name: "Time windows" })
      .getAttribute("aria-selected"),
  ).toBe("true");
});
it("reports a failed ledger read with a retry", async () => {
  native.invoke.mockRejectedValue({ kind: "Ledger", message: "ledger locked" });
  render(App);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("ledger locked");
  expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy();
});
it("shows an empty repository list without querying features or history", async () => {
  const empty: DesktopCatalogReply = {
    repositories: { records: [], end: "Complete" },
  };
  native.invoke.mockResolvedValue(empty);
  render(App);
  expect(await screen.findByText("No repositories recorded yet")).toBeTruthy();
  expect(native.invoke).toHaveBeenCalledTimes(1);
});

it("preserves the last repository catalog when refresh fails and retries at the global scope", async () => {
  const fixture = new Fixture();
  new NativeFixture(fixture).install();
  render(App);
  await screen.findByRole("button", NativeFixture.OPEN_REPOSITORY);
  const failure: DesktopFailure = {
    kind: "Ledger",
    message: "Repository catalog temporarily unavailable",
  };
  native.invoke.mockRejectedValueOnce(failure);
  const refresh: ByRoleOptions = { name: "Refresh now" };
  await fireEvent.click(screen.getByRole("button", refresh));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Showing the last successful read");
  expect(
    screen.getByRole("button", NativeFixture.OPEN_REPOSITORY),
  ).toBeTruthy();
  const retry: ByRoleOptions = { name: "Retry" };
  await fireEvent.click(within(alert).getByRole("button", retry));
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(3));
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read");
});
