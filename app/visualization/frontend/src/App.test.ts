import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/svelte";
import App from "./App.svelte";
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
class NativeFixture {
  constructor(readonly fixture: Fixture) {}
  read(command: string): Promise<unknown> {
    switch (command) {
      case "dashboard_read":
        return Promise.resolve(this.fixture.reply());
      case "dashboard_workflow":
        return Promise.resolve(this.fixture.workflow());
      default:
        return Promise.reject(new Error("Unexpected command"));
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
  const panel = await screen.findByRole("article", {
    name: "Selected feature",
  });
  expect(within(panel).getByText("20 min")).toBeTruthy();
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
  expect(native.invoke).toHaveBeenCalledWith("dashboard_workflow", {
    feature: fixture.summary.feature.id,
  });
});
it("keeps the agent index across Log and Time windows, with revision metadata and command evidence", async () => {
  new NativeFixture(new Fixture()).install();
  render(App);
  await fireEvent.click(
    await screen.findByRole("button", { name: "Open workflow" }),
  );
  const index = screen.getByRole("navigation", { name: "Agent index" });
  expect(within(index).getByText("1. Rust Dev")).toBeTruthy();
  expect(screen.getByText("· r2")).toBeTruthy();
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
    await screen.findByRole("button", { name: "Open workflow" }),
  );
  await fireEvent.click(screen.getByRole("tab", { name: "Time windows" }));
  await fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(3));
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
it("shows an empty feature list without querying history", async () => {
  native.invoke.mockResolvedValue({
    features: { records: [], end: "Complete" },
  });
  render(App);
  expect(await screen.findByText("No features recorded yet")).toBeTruthy();
  expect(native.invoke).toHaveBeenCalledTimes(1);
});
