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
import { Effect } from "effect";
import type {
  DesktopCatalogReply,
  RepositorySelection,
  DesktopFailure,
  StoredFeatureSelection,
  DesktopReply,
} from "./contracts";
import type { WorkflowInvocation, RepositoryReadArguments } from "./api";
import App from "./App.svelte";
import { Fixture } from "./dashboard-fixture";
interface SearchInput {
  target: { value: string };
}
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
});
class CloneScenario {
  static readonly GROUPS: ByRoleOptions = { name: "Choose a repository" };
  static readonly BRIEFING: ByRoleOptions = { name: "Selected feature" };
  static readonly OPEN: ByRoleOptions = { name: "Open workflow" };
  static readonly WINDOWS: ByRoleOptions = { name: "Time windows" };
  static readonly JOURNAL: ByRoleOptions = { name: "Release 0 12 3", level: 1 };
  static readonly LOG: ByRoleOptions = { name: "Log" };
  static readonly REPOSITORIES: ByRoleOptions = { name: "Repositories" };
  static readonly BACK: ByRoleOptions = { name: "Back to repositories" };
  static readonly BREADCRUMB: ByRoleOptions = { name: "Breadcrumb" };
  static readonly SEARCH: ByRoleOptions = { name: "Find a feature" };
  static readonly UPGRADE: ByRoleOptions = { name: "Upgrade and open" };
  static readonly FEATURES: ByRoleOptions = { name: "Features", level: 1 };
  static readonly INDEX: ByRoleOptions = { name: "Agent index" };
  static readonly RETRY: ByRoleOptions = { name: "Retry" };

  readonly fixture = new Fixture();
  readonly first = Fixture.REPOSITORY;
  readonly second: RepositorySelection = {
    ...Fixture.REPOSITORY,
    repository_id: "5822db5f-7552-44d4-bdc1-1e5ebd98bc4c",
  };
  catalog(): DesktopCatalogReply {
    return {
      repositories: {
        records: [
          { repository: this.first, feature_count: 1 },
          { repository: this.second, feature_count: 1 },
        ],
        end: "Complete",
      },
    };
  }
  install(): void {
    native.invoke.mockResolvedValueOnce(this.catalog());
  }
  repositoryQuery(repository: RepositorySelection): ByRoleOptions {
    return { name: `Open ${repository.name}, ${repository.repository_id}` };
  }
  featureRequest(repository: RepositorySelection): RepositoryReadArguments {
    return { repository };
  }
  workflowRequest(repository: RepositorySelection): WorkflowInvocation {
    const selection: StoredFeatureSelection = {
      repository,
      feature: this.fixture.summary.feature.id,
    };
    return { selection };
  }
  empty(): DesktopReply {
    return { features: { records: [], end: "Complete" } };
  }
  async open(repository: RepositorySelection): Promise<void> {
    await fireEvent.click(
      await screen.findByRole("button", this.repositoryQuery(repository)),
    );
  }
  async back(query: ByRoleOptions): Promise<void> {
    await fireEvent.click(screen.getByRole("button", query));
  }
}
it("starts at repository groups, distinguishes same-name clones and scopes repeated feature IDs", async () => {
  const scenario = new CloneScenario();
  scenario.install();
  render(App);
  const groups = await screen.findByRole("group", CloneScenario.GROUPS);
  expect(within(groups).getAllByText("meta-cortex")).toHaveLength(2);
  expect(within(groups).getByText(scenario.first.repository_id)).toBeTruthy();
  expect(within(groups).getByText(scenario.second.repository_id)).toBeTruthy();
  expect(native.invoke).toHaveBeenCalledTimes(1);
  native.invoke.mockResolvedValueOnce(scenario.fixture.reply());
  native.invoke.mockResolvedValueOnce(scenario.fixture.workflow());
  await scenario.open(scenario.first);
  await screen.findByRole("article", CloneScenario.BRIEFING);
  expect(native.invoke).toHaveBeenCalledWith(
    "dashboard_features",
    scenario.featureRequest(scenario.first),
  );
  await fireEvent.click(screen.getByRole("button", CloneScenario.OPEN));
  expect(document.activeElement).toBe(
    screen.getByRole("heading", CloneScenario.JOURNAL),
  );
  await fireEvent.click(screen.getByRole("tab", CloneScenario.WINDOWS));
  await scenario.back(CloneScenario.REPOSITORIES);
  expect(document.activeElement).toBe(
    screen.getByRole("button", scenario.repositoryQuery(scenario.first)),
  );
  const secondReply = scenario.fixture.reply();
  secondReply.features.records = secondReply.features.records.map((card) => {
    switch (card.kind) {
      case "current":
        return {
          ...card,
          summary: {
            ...card.summary,
            feature: {
              ...card.summary.feature,
              objective: "Second clone recorded work",
            },
          },
        };
      case "upgrade_required":
      case "unavailable":
        return card;
    }
  });
  native.invoke.mockResolvedValueOnce(secondReply);
  native.invoke.mockResolvedValueOnce(scenario.fixture.workflow());
  await scenario.open(scenario.second);
  const briefing = await screen.findByRole("article", CloneScenario.BRIEFING);
  expect(within(briefing).getByText("Second clone recorded work")).toBeTruthy();
  expect(native.invoke).toHaveBeenLastCalledWith(
    "dashboard_workflow",
    scenario.workflowRequest(scenario.second),
  );
  await fireEvent.click(screen.getByRole("button", CloneScenario.OPEN));
  expect(
    screen.getByRole("tab", CloneScenario.LOG).getAttribute("aria-selected"),
  ).toBe("true");
  const breadcrumb = screen.getByRole("navigation", CloneScenario.BREADCRUMB);
  expect(breadcrumb.textContent).toContain(scenario.second.repository_id);
  expect(breadcrumb.textContent).toContain(scenario.fixture.summary.feature.id);
});
it("cancels a previous group's delayed feature read before opening another group", async () => {
  const scenario = new CloneScenario();
  scenario.install();
  render(App);
  native.invoke.mockImplementationOnce(() =>
    Effect.runPromise(
      Effect.sleep("100 millis").pipe(Effect.as(scenario.fixture.reply())),
    ),
  );
  await scenario.open(scenario.first);
  await scenario.back(CloneScenario.BACK);
  native.invoke.mockResolvedValueOnce(scenario.empty());
  await scenario.open(scenario.second);
  await screen.findByText("No features recorded yet");
  await Effect.runPromise(Effect.sleep("150 millis"));
  expect(screen.queryAllByRole("article", CloneScenario.BRIEFING)).toHaveLength(
    0,
  );
  expect(screen.getByText("No features recorded yet")).toBeTruthy();
});
it("keeps group error recovery and back navigation without stale cards from a different group", async () => {
  const scenario = new CloneScenario();
  scenario.install();
  render(App);
  const failure: DesktopFailure = {
    kind: "Ledger",
    message: "Selected repository storage unavailable",
  };
  native.invoke.mockRejectedValueOnce(failure);
  await scenario.open(scenario.first);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Selected repository storage unavailable",
  );
  expect(screen.getByRole("button", CloneScenario.BACK)).toBeTruthy();
  native.invoke.mockResolvedValueOnce(scenario.empty());
  await fireEvent.click(within(alert).getByRole("button", CloneScenario.RETRY));
  await screen.findByText("No features recorded yet");
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(3));
  expect(native.invoke).toHaveBeenLastCalledWith(
    "dashboard_features",
    scenario.featureRequest(scenario.first),
  );
});
it("clears feature search and an in-flight selected upgrade when changing repository groups", async () => {
  const scenario = new CloneScenario();
  scenario.install();
  render(App);
  const old: DesktopReply = {
    features: {
      end: "Complete",
      records: [
        {
          kind: "upgrade_required",
          feature: scenario.fixture.summary.feature,
          storage_version: 4,
        },
      ],
    },
  };
  native.invoke.mockResolvedValueOnce(old);
  await scenario.open(scenario.first);
  const action = await screen.findByRole("button", CloneScenario.UPGRADE);
  native.invoke.mockImplementationOnce(() =>
    Effect.runPromise(
      Effect.sleep("100 millis").pipe(Effect.as(scenario.fixture.workflow())),
    ),
  );
  await fireEvent.click(action);
  expect(native.invoke).toHaveBeenLastCalledWith(
    "dashboard_upgrade",
    scenario.workflowRequest(scenario.first),
  );
  const search: SearchInput = {
    target: { value: "No matching work" },
  };
  await fireEvent.input(
    screen.getByRole("searchbox", CloneScenario.SEARCH),
    search,
  );
  await screen.findByText("No matching features");
  await scenario.back(CloneScenario.BACK);
  native.invoke.mockResolvedValueOnce(scenario.fixture.reply());
  native.invoke.mockResolvedValueOnce(scenario.fixture.workflow());
  await scenario.open(scenario.second);
  await screen.findByRole("article", CloneScenario.BRIEFING);
  expect(screen.getByRole("searchbox", CloneScenario.SEARCH)).toHaveProperty(
    "value",
    "",
  );
  await Effect.runPromise(Effect.sleep("150 millis"));
  expect(screen.queryAllByRole("navigation", CloneScenario.INDEX)).toHaveLength(
    0,
  );
  expect(screen.getByRole("heading", CloneScenario.FEATURES)).toBeTruthy();
  expect(
    native.invoke.mock.calls.filter(
      ([command]) => command === "dashboard_upgrade",
    ),
  ).toHaveLength(1);
});
