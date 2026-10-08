import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
interface RoleQueryOptions {
  name: string;
}
import { Effect } from "effect";
import App from "./App.svelte";
import { Fixture } from "./dashboard-fixture";
import type {
  DesktopReply,
  DesktopFailure,
  FeatureWorkflow,
} from "./contracts";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
});
interface UpgradeArguments {
  feature: string;
}
class MixedCatalog {
  readonly fixture = new Fixture();
  readonly old = { ...this.fixture.summary.feature, id: "older-feature" };
  reply(): DesktopReply {
    return {
      features: {
        end: "Complete",
        records: [
          { kind: "current", summary: this.fixture.summary },
          { kind: "upgrade_required", feature: this.old, storage_version: 4 },
          {
            kind: "unavailable",
            feature: "future-feature",
            message: "Database version 99 is newer than supported version 5",
          },
          {
            kind: "unavailable",
            feature: "broken-feature",
            message: "Database could not be read",
          },
        ],
      },
    };
  }
  read(command: string) {
    switch (command) {
      case "dashboard_read":
        return Effect.runPromise(Effect.succeed(this.reply()));
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
it("keeps current, older, future and failed cards visible without automatic upgrades", async () => {
  const catalog = new MixedCatalog();
  catalog.install();
  render(App);
  const menuQuery: RoleQueryOptions = { name: "Choose a feature" };
  const menu = await screen.findByRole("group", menuQuery);
  expect(within(menu).getByText("Upgrade required")).toBeTruthy();
  expect(within(menu).getAllByText("Unavailable")).toHaveLength(2);
  const oldQuery: RoleQueryOptions = { name: "Preview older-feature" };
  await fireEvent.click(screen.getByRole("button", oldQuery));
  expect(screen.getByText("Storage version 4")).toBeTruthy();
  const refreshQuery: RoleQueryOptions = { name: "Refresh now" };
  await fireEvent.click(screen.getByRole("button", refreshQuery));
  const futureQuery: RoleQueryOptions = { name: "Preview future-feature" };
  await fireEvent.click(screen.getByRole("button", futureQuery));
  expect(
    screen.getByText("Database version 99 is newer than supported version 5"),
  ).toBeTruthy();
  expect(
    native.invoke.mock.calls.filter((call) => call[0] === "dashboard_upgrade"),
  ).toHaveLength(0);
  expect(
    native.invoke.mock.calls.filter((call) => call[0] === "dashboard_workflow"),
  ).toHaveLength(1);
});
it("upgrades only the selected feature on explicit action, prevents repeat submission, and opens its workflow", async () => {
  const catalog = new MixedCatalog();
  catalog.install();
  render(App);
  const oldQuery: RoleQueryOptions = { name: "Preview older-feature" };
  await fireEvent.click(await screen.findByRole("button", oldQuery));
  const upgraded: FeatureWorkflow = catalog.fixture.workflow();
  upgraded.feature = catalog.old.id;
  native.invoke.mockImplementationOnce(() =>
    Effect.runPromise(
      Effect.sleep("100 millis").pipe(Effect.andThen(Effect.succeed(upgraded))),
    ),
  );
  const next: DesktopReply = {
    features: {
      end: "Complete",
      records: [
        {
          kind: "current",
          summary: { ...catalog.fixture.summary, feature: catalog.old },
        },
      ],
    },
  };
  native.invoke.mockResolvedValueOnce(next);
  native.invoke.mockResolvedValue(upgraded);
  const upgradeQuery: RoleQueryOptions = { name: "Upgrade and open" };
  await fireEvent.click(screen.getByRole("button", upgradeQuery));
  const pendingQuery: RoleQueryOptions = { name: "Upgrading…" };
  expect(
    screen.getByRole("button", pendingQuery).hasAttribute("disabled"),
  ).toBe(true);
  const args: UpgradeArguments = { feature: catalog.old.id };
  expect(native.invoke).toHaveBeenCalledWith("dashboard_upgrade", args);
  const workflowQuery: RoleQueryOptions = { name: "Agent index" };
  await screen.findByRole("navigation", workflowQuery);
  const featureQuery: RoleQueryOptions = { name: "Feature log" };
  expect(
    screen.getByRole("tab", featureQuery).getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    native.invoke.mock.calls.filter((call) => call[0] === "dashboard_upgrade"),
  ).toHaveLength(1);
});
it("keeps the catalog visible after selected upgrade failure and offers an explicit retry", async () => {
  const catalog = new MixedCatalog();
  catalog.install();
  render(App);
  const oldQuery: RoleQueryOptions = { name: "Preview older-feature" };
  await fireEvent.click(await screen.findByRole("button", oldQuery));
  const failure: DesktopFailure = {
    kind: "Ledger",
    message: "Selected database is locked",
  };
  native.invoke.mockRejectedValueOnce(failure);
  const upgradeQuery: RoleQueryOptions = { name: "Upgrade and open" };
  await fireEvent.click(screen.getByRole("button", upgradeQuery));
  await screen.findByText("Selected database is locked");
  expect(
    screen.getByRole("button", upgradeQuery).hasAttribute("disabled"),
  ).toBe(false);
  const menuQuery: RoleQueryOptions = { name: "Choose a feature" };
  expect(
    within(screen.getByRole("group", menuQuery)).getAllByRole("button"),
  ).toHaveLength(4);
  expect(
    native.invoke.mock.calls.filter((call) => call[0] === "dashboard_upgrade"),
  ).toHaveLength(1);
});

it("shows an older first card without automatically reading or upgrading its workflow", async () => {
  const catalog = new MixedCatalog();
  const reply: DesktopReply = catalog.reply();
  reply.features.records = reply.features.records.slice(1);
  native.invoke.mockResolvedValue(reply);
  render(App);
  const query: RoleQueryOptions = { name: "Upgrade and open" };
  await screen.findByRole("button", query);
  expect(native.invoke).toHaveBeenCalledTimes(1);
  expect(native.invoke).toHaveBeenCalledWith("dashboard_read");
});
