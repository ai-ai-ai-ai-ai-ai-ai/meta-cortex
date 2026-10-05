import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/svelte";
import App from "./App.svelte";
import fixture from "./agent-guide-fixture.json";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
type RoleQuery = NonNullable<Parameters<typeof screen.getByRole>[1]>;
beforeEach(() => {
  const scrolling: PropertyDescriptor = { configurable: true, value: () => {} };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrolling);
});
afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  cleanup();
  native.invoke.mockReset();
});
it("opens the static guide despite a failed ledger read and displays selected canonical role content", async () => {
  native.invoke.mockImplementation((command: string) => {
    switch (command) {
      case "dashboard_read":
        return Promise.reject(new Error("Ledger unavailable"));
      case "dashboard_guide":
        return Promise.resolve(fixture);
      default:
        return Promise.reject(new Error("Unexpected command"));
    }
  });
  render(App);
  await screen.findByRole("alert");
  const guideQuery: RoleQuery = { name: "Agent guide" };
  await fireEvent.click(screen.getByRole("button", guideQuery));
  const rustQuery: RoleQuery = { name: "Rust Developer" };
  const rust = await screen.findByRole("button", rustQuery);
  await fireEvent.click(rust);
  expect(rust.getAttribute("aria-pressed")).toBe("true");
  const detail = screen.getByRole("complementary");
  for (const agent of fixture.agents.filter(
    (entry) => entry.agent.role === "RustDev",
  )) {
    expect(detail.textContent).toContain(agent.responsibility);
    expect(
      within(detail)
        .getAllByRole("listitem")
        .map((step) => step.textContent)
        .join("\n"),
    ).toBe(agent.handoff);
  }
  expect(within(detail).getByText("review via Team Gizmo")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  const disclosure = detail.querySelector("details");
  expect(disclosure?.open).toBe(false);
  disclosure?.setAttribute("open", "");
  expect(detail.querySelector("pre")?.textContent).toContain(
    "# Rust Developer",
  );
  await waitFor(() =>
    expect(native.invoke).toHaveBeenCalledWith("dashboard_guide"),
  );
  expect(native.invoke).toHaveBeenCalledTimes(2);
  expect(native.invoke).toHaveBeenNthCalledWith(1, "dashboard_read");
  expect(native.invoke).toHaveBeenNthCalledWith(2, "dashboard_guide");
  expect(document.activeElement).toBe(detail);
});
