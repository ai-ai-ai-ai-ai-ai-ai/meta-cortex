import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  type ByRoleOptions,
} from "@testing-library/svelte";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { guide } from "virtual:agent-guide";
import { Effect } from "effect";
import type { DesktopCatalogReply, DesktopFailure } from "./contracts";
import App from "./App.svelte";
import { type GuideDocument } from "./guide-content";
import { Fixture } from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: native.invoke,
  isTauri: () => true,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
class CanonicalFixture {
  static readonly GUIDE: ByRoleOptions = { name: "Agent guide" };
  static readonly WORKBENCH: ByRoleOptions = { name: "Homeostat" };
  static readonly PRIME_HEADING: ByRoleOptions = {
    name: "Gizmo Prime",
    level: 1,
  };
  static readonly TEAMS_HEADING: ByRoleOptions = { name: "Teams", level: 1 };
  static readonly COMMUNICATION_HEADING: ByRoleOptions = {
    name: "Communication and decisions",
    level: 2,
  };
  static readonly BACK: ByRoleOptions = { name: "Back to agent document" };
  static readonly RUST_HEADING: ByRoleOptions = {
    name: "Rust Developer",
    level: 1,
  };
  read(document: GuideDocument): string {
    return Effect.runSync(
      Effect.try(() =>
        readFileSync(
          resolve(
            dirname(fileURLToPath(import.meta.url)),
            "../../../../cortex",
            document.path,
          ),
          "utf8",
        ).replace(/\r\n/g, "\n"),
      ),
    );
  }
  empty(): void {
    const reply: DesktopCatalogReply = {
      repositories: { records: [], end: "Complete" },
    };
    native.invoke.mockResolvedValue(reply);
  }
}
beforeEach(() => {
  const descriptor: PropertyDescriptor = { configurable: true, value: vi.fn() };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
});
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
it("bundles current canonical role and protocol documents, with all 16 roles", () => {
  const fixture = new CanonicalFixture();
  expect(guide.agents).toHaveLength(16);
  expect(guide.documents).toHaveLength(19);
  expect(new Set(guide.agents.map((agent) => agent.path)).size).toBe(16);
  for (const document of guide.documents)
    expect(document.markdown).toBe(fixture.read(document));
  for (const agent of guide.agents)
    expect(
      guide.documents.filter((document) => document.path === agent.path),
    ).toHaveLength(1);
});
it("opens every canonical role from the original graph with an empty repository and returns to Homeostat", async () => {
  new CanonicalFixture().empty();
  render(App);
  await screen.findByText("No repositories recorded yet");
  await fireEvent.click(screen.getByRole("button", CanonicalFixture.GUIDE));
  const graph = screen.getByLabelText("Reporting structure");
  for (const agent of guide.agents) {
    const selection: ByRoleOptions = { name: agent.label };
    await fireEvent.click(within(graph).getByRole("button", selection));
    const heading: ByRoleOptions = { name: agent.label, level: 1 };
    expect(screen.getByRole("heading", heading)).toBeTruthy();
    expect(screen.getByText(agent.path)).toBeTruthy();
  }
  expect(native.invoke).toHaveBeenCalledTimes(1);
  await fireEvent.click(screen.getByRole("button", CanonicalFixture.WORKBENCH));
  expect(await screen.findByText("No repositories recorded yet")).toBeTruthy();
  await fireEvent.click(screen.getByRole("button", CanonicalFixture.GUIDE));
  expect(
    screen.getByRole("heading", CanonicalFixture.PRIME_HEADING),
  ).toBeTruthy();
});
it("follows canonical protocol links in the app and returns to the selected role", async () => {
  new CanonicalFixture().empty();
  render(App);
  await fireEvent.click(screen.getByRole("button", CanonicalFixture.GUIDE));
  const graph = screen.getByLabelText("Reporting structure");
  const rust: ByRoleOptions = { name: "Rust Developer" };
  await fireEvent.click(within(graph).getByRole("button", rust));
  const communication: ByRoleOptions = { name: "communication and decisions" };
  await fireEvent.click(screen.getByRole("link", communication));
  expect(
    screen.getByRole("heading", CanonicalFixture.TEAMS_HEADING),
  ).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("heading", CanonicalFixture.COMMUNICATION_HEADING),
  );
  await fireEvent.click(screen.getByRole("button", CanonicalFixture.BACK));
  expect(
    screen.getByRole("heading", CanonicalFixture.RUST_HEADING),
  ).toBeTruthy();
});
it("keeps Agent guide available when the native observation fails and with current feature data", async () => {
  const failure: DesktopFailure = { kind: "Ledger", message: "ledger locked" };
  native.invoke.mockRejectedValueOnce(failure);
  render(App);
  await screen.findByRole("alert");
  await fireEvent.click(screen.getByRole("button", CanonicalFixture.GUIDE));
  expect(screen.getByRole("heading", CanonicalFixture.GUIDE)).toBeTruthy();
  cleanup();
  const fixture = new Fixture();
  native.invoke.mockResolvedValue(fixture.catalog());
  render(App);
  await screen.findByRole("button", CanonicalFixture.GUIDE);
  await fireEvent.click(screen.getByRole("button", CanonicalFixture.GUIDE));
  expect(screen.getByRole("heading", CanonicalFixture.GUIDE)).toBeTruthy();
});
