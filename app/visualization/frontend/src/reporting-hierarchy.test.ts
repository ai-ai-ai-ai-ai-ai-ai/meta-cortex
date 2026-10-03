import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import App from "./App.svelte";
import type {
  AgentId,
  ReportingTarget,
  TaskFlow,
  FeatureFlow,
} from "./contracts";
import { ReportingTable } from "./agent-tree";
import {
  Fixture,
  BrowserMediaQueries,
  renderedClientRects,
} from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
beforeEach(() => {
  const mediaQueries = new BrowserMediaQueries();
  const matchMedia: BrowserMediaQueries["matchMedia"] =
    mediaQueries.matchMedia.bind(mediaQueries);
  vi.stubGlobal("matchMedia", matchMedia);
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
    renderedClientRects,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  native.invoke.mockReset();
});

interface HierarchyActivity {
  id: string;
  agent: AgentId;
  target: ReportingTarget;
}
class HierarchyFixture {
  activity(input: HierarchyActivity): TaskFlow {
    const fixture = new Fixture();
    fixture.task.common.id = input.id;
    fixture.task.workspace = { kind: "read_only" };
    fixture.task.state = { kind: "completed", agent: input.agent, attempt: 1 };
    fixture.task.common.checkpoint = { kind: "unrecorded" };
    fixture.task.ownership = {
      kind: "Assigned",
      assignment: { agent: input.agent, reports_to: input.target },
    };
    fixture.contribution.worker = { kind: "recorded", agent: input.agent };
    fixture.contribution.checkpoints = [];
    fixture.contribution.integrations = [];
    return fixture.contribution;
  }
}
it("retains recorded ancestry and separates own activity from descendants", () => {
  const fixture = new HierarchyFixture();
  const definitions: ReadonlyArray<HierarchyActivity> = [
    {
      id: "prime",
      agent: { team: "Gizmo", role: "GizmoPrime" },
      target: { kind: "Host" },
    },
    {
      id: "team",
      agent: { team: "Gizmo", role: "Gizmo" },
      target: { kind: "Gizmo", coordinator: "GizmoPrime" },
    },
    {
      id: "worker-one",
      agent: { team: "Development", role: "TypescriptDev" },
      target: { kind: "Gizmo", coordinator: "Gizmo" },
    },
    {
      id: "worker-two",
      agent: { team: "Development", role: "TypescriptDev" },
      target: { kind: "Gizmo", coordinator: "Gizmo" },
    },
  ];
  // Parent activities may arrive after their children in the ledger page.
  const tasks = definitions.map((input) => fixture.activity(input)).reverse();
  const root = new ReportingTable(tasks).root;
  expect(root.children?.map((node) => node.data.label)).toEqual(["Host"]);
  const host = root.find((node) => node.data.label === "Host");
  expect(host?.data).toMatchObject({
    activities: [],
    status: "No activity on this page",
    descendantCounts: "4/4 finished",
  });
  const team = root.find((node) => node.data.label === "Team Gizmo");
  expect(team?.ancestors().map((node) => node.data.label)).toEqual([
    "Team Gizmo",
    "Gizmo Prime",
    "Host",
    "",
  ]);
  expect(team?.data).toMatchObject({
    ownCounts: "1/1 finished",
    descendantCounts: "2/2 finished",
  });
  const worker = root.find((node) => node.data.label === "TypescriptDev");
  expect(worker?.data).toMatchObject({
    ownCounts: "2/2 finished",
    descendantCounts: "",
  });
  expect(
    worker
      ?.leaves()
      .map((node) => node.data.label)
      .sort(),
  ).toEqual(["worker-one", "worker-two"]);
});
it("does not infer Prime or Host above an absent loaded Team activity", () => {
  const fixture = new Fixture();
  const root = new ReportingTable([fixture.contribution]).root;
  expect(root.children?.map((node) => node.data.label)).toEqual(["Team Gizmo"]);
  expect(root.children?.[0]?.data).toMatchObject({
    activities: [],
    status: "No activity on this page",
    ownCounts: "",
  });
  expect(root.leaves().map((node) => node.data.activities)).toEqual([
    [fixture.contribution],
  ]);
});
it("selects unfinished work before newer completed activity without changing ledger order", () => {
  const fixture = new HierarchyFixture();
  const agent: AgentId = { team: "Development", role: "TypescriptDev" };
  const working = fixture.activity({
    id: "working",
    agent,
    target: { kind: "Gizmo", coordinator: "Gizmo" },
  });
  working.task.state = {
    kind: "active",
    assignment: {
      agent,
      attempt: 1,
      expires_at: 3000,
      phase: { kind: "working" },
    },
  };
  working.task.common.last_update = 1000;
  const completed = fixture.activity({
    id: "done",
    agent,
    target: { kind: "Gizmo", coordinator: "Gizmo" },
  });
  completed.task.common.last_update = 2000;
  const tasks = [completed, working];
  const root = new ReportingTable(tasks).root;
  const worker = root.find((node) => node.data.label === "TypescriptDev");
  expect(worker?.data).toMatchObject({
    status: "In progress",
    ownCounts: "1/2 finished",
  });
  expect(worker?.data.activities[0]).toBe(working);
  expect(worker?.leaves().map((node) => node.data.label)).toEqual([
    "done",
    "working",
  ]);
  expect(root.children?.[0]?.data.descendantCounts).toBe("1/2 finished");
  expect(tasks).toEqual([completed, working]);
});
it("keeps historical creator/worker evidence outside recorded reporting ancestry", () => {
  const recorded = new Fixture();
  const historical = new Fixture();
  historical.task.common.id = "historical";
  historical.task.ownership = { kind: "Unrecorded" };
  const root = new ReportingTable([
    recorded.contribution,
    historical.contribution,
  ]).root;
  expect(root.children?.map((node) => node.data.label)).toEqual([
    "Team Gizmo",
    "Created by · Team Gizmo · reporting unrecorded",
  ]);
  const historic = root.find((node) => node.data.label === "historical");
  expect(historic?.data.activities).toEqual([historical.contribution]);
  expect(historic?.ancestors().map((node) => node.data.label)).toEqual([
    "historical",
    "TypescriptDev",
    "Created by · Team Gizmo · reporting unrecorded",
    "",
  ]);
  expect(historic?.data.activities[0]?.task.ownership).toEqual({
    kind: "Unrecorded",
  });
});

class CoordinatorFixture extends HierarchyFixture {
  flow(): FeatureFlow {
    const inputs: readonly [
      HierarchyActivity,
      HierarchyActivity,
      HierarchyActivity,
    ] = [
      {
        id: "coordinator-plan",
        agent: { team: "Gizmo", role: "Gizmo" },
        target: { kind: "Gizmo", coordinator: "GizmoPrime" },
      },
      {
        id: "coordinator-implementation",
        agent: { team: "Gizmo", role: "Gizmo" },
        target: { kind: "Gizmo", coordinator: "GizmoPrime" },
      },
      {
        id: "worker",
        agent: { team: "Development", role: "TypescriptDev" },
        target: { kind: "Gizmo", coordinator: "Gizmo" },
      },
    ];
    const completed = this.activity(inputs[0]);
    completed.task.common.objective = "Plan reporting hierarchy";
    completed.task.common.last_update = 3000;
    const working = this.activity(inputs[1]);
    working.task.common.objective = "Implement reporting hierarchy";
    working.task.common.last_update = 2000;
    working.task.workspace = { kind: "feature" };
    working.task.state = {
      kind: "active",
      assignment: {
        agent: inputs[1].agent,
        attempt: 1,
        expires_at: 4000,
        phase: { kind: "working" },
      },
    };
    const worker = this.activity(inputs[2]);
    const fixture = new Fixture();
    fixture.flow.tasks.records = [completed, working, worker];
    fixture.flow.counts = [
      { state: "completed", count: 2 },
      { state: "working", count: 1 },
    ];
    return fixture.flow;
  }
}
it("opens the prioritized coordinator record and keeps every activity selectable through the real DataTable", async () => {
  const flow = new CoordinatorFixture().flow();
  const fixture = new Fixture();
  fixture.flow = flow;
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  const table = await screen.findByRole("table", {
    name: "Recorded reporting and activities",
  });
  const team = within(table).getByRole("row", { name: /Team Gizmo/ });
  expect(within(team).getByText("In progress")).toBeTruthy();
  await userEvent.click(
    within(team).getByRole("button", {
      name: "Open task coordinator-implementation",
    }),
  );
  const working = await screen.findByRole("dialog", {
    name: "coordinator-implementation",
  });
  expect(
    within(working).getByText("Implement reporting hierarchy"),
  ).toBeTruthy();
  expect(within(working).getByText("In progress")).toBeTruthy();
  await waitFor(() =>
    expect(working.contains(document.activeElement)).toBe(true),
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  const completed = within(table).getByRole("button", {
    name: "Open task coordinator-plan",
  });
  await waitFor(() =>
    expect(getComputedStyle(completed).pointerEvents).not.toBe("none"),
  );
  await userEvent.click(completed);
  const plan = await screen.findByRole("dialog", { name: "coordinator-plan" });
  expect(within(plan).getByText("Plan reporting hierarchy")).toBeTruthy();
  expect(within(plan).getByText("Completed")).toBeTruthy();
  await waitFor(() => expect(plan.contains(document.activeElement)).toBe(true));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  const implementation = within(table).getByRole("row", {
    name: /coordinator-implementation/,
  });
  const reopen = within(implementation).getByRole("button", {
    name: "Open task coordinator-implementation",
  });
  await waitFor(() =>
    expect(getComputedStyle(reopen).pointerEvents).not.toBe("none"),
  );
  await userEvent.click(reopen);
  expect(
    within(
      await screen.findByRole("dialog", { name: "coordinator-implementation" }),
    ).getByText("Implement reporting hierarchy"),
  ).toBeTruthy();
});
it("uses library expanding subrows without selecting absent anchors and supports keyboard toggling", async () => {
  const fixture = new Fixture();
  fixture.flow = new CoordinatorFixture().flow();
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  const table = await screen.findByRole("table", {
    name: "Recorded reporting and activities",
  });
  const prime = within(table).getByRole("row", { name: /Gizmo Prime/ });
  expect(within(prime).getByText("No activity on this page")).toBeTruthy();
  expect(within(prime).queryByRole("button", { name: /Open task/ })).toBeNull();
  const collapse = within(prime).getByRole("button", {
    name: "Collapse Gizmo Prime",
  });
  collapse.focus();
  await userEvent.keyboard("{Enter}");
  expect(collapse.getAttribute("aria-expanded")).toBe("false");
  expect(within(table).queryByText("Team Gizmo")).toBeNull();
  await userEvent.keyboard(" ");
  expect(collapse.getAttribute("aria-expanded")).toBe("true");
  const worker = within(table).getByRole("row", { name: /TypescriptDev/ });
  const expandWorker = within(worker).getByRole("button", {
    name: "Expand TypescriptDev",
  });
  expect(
    within(table).queryByRole("button", { name: "Open task worker" }),
  ).toBeTruthy();
  await userEvent.click(expandWorker);
  expect(expandWorker.getAttribute("aria-expanded")).toBe("true");
  expect(within(table).getByRole("row", { name: /worker/ })).toBeTruthy();
  await userEvent.click(
    within(worker).getByRole("button", { name: "Collapse TypescriptDev" }),
  );
  expect(within(table).queryByRole("row", { name: /worker/ })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
