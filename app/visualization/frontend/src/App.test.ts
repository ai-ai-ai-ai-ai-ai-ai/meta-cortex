import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import App from "./App.svelte";
import { Fixture } from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
});

it("shows each feature as a journal card with its goal, PR, blocker and outcomes", async () => {
  const fixture = new Fixture();
  native.invoke.mockResolvedValue(fixture.reply());
  render(App);
  const card = await screen.findByRole("article", {
    name: fixture.summary.feature.objective,
  });
  const scoped = within(card);
  expect(scoped.getByText("Needs attention")).toBeTruthy();
  expect(
    scoped.getByRole("button", {
      name: "Copy link to pull request 41 in acme/release",
    }),
  ).toBeTruthy();
  expect(
    scoped.getByText("Blocked: rust-review — Release SHA formatting fails"),
  ).toBeTruthy();
  const outcomes = scoped.getByRole("list", {
    name: "release-0-12-3 outcomes",
  });
  expect(within(outcomes).getByText("prep-pr")).toBeTruthy();
  expect(scoped.getByTestId("feature-sentence").textContent).toContain(
    "1 of 6 tasks done",
  );
  expect(native.invoke).toHaveBeenCalledWith("dashboard_read");
});

it("reports a failed ledger read with a retry", async () => {
  native.invoke.mockRejectedValue({ kind: "Ledger", message: "ledger locked" });
  render(App);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("ledger locked");
  expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy();
});

it("shows an empty journal when no features are recorded", async () => {
  native.invoke.mockResolvedValue({
    features: { records: [], end: "Complete" },
  });
  render(App);
  expect(await screen.findByText("No features recorded yet")).toBeTruthy();
});
