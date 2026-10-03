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
import { TaskPresentation } from "./task-presentation";
import type {
  AgentId,
  ReportingTarget,
  TaskFlow,
  FeatureFlow,
} from "./contracts";
import {
  ActivityKind,
  ReportingHierarchy,
  ReportingRowKind,
  reportingRows,
} from "./agent-tree";
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
it("uses only recorded coordinator ancestry and separates own completed activity from descendants", () => {
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
  const tasks: ReadonlyArray<TaskFlow> = definitions.map((definition) =>
    fixture.activity(definition),
  );
  const hierarchy = new ReportingHierarchy(tasks);
  expect(hierarchy.roots().map((node) => node.name())).toEqual(["Host"]);
  const host = hierarchy.roots()[0];
  expect(host?.activity.kind).toBe(ActivityKind.Absent);
  expect(host?.ownTasks()).toHaveLength(0);
  expect(host?.descendantCounts().map((count) => count.count)).toEqual([4]);
  const team = hierarchy.nodes().find((node) => node.name() === "Team Gizmo");
  expect(team?.ownTasks()).toHaveLength(1);
  expect(team?.descendantCounts().map((count) => count.count)).toEqual([2]);
  expect(team?.subtreeCounts().map((count) => count.count)).toEqual([3]);
  const worker = hierarchy
    .nodes()
    .find((node) => node.name() === "TypescriptDev");
  expect(worker?.ownTasks()).toHaveLength(2);
  expect(worker?.descendantCounts()).toHaveLength(0);
});
it("does not infer Prime or Host above a missing loaded Team activity", () => {
  const fixture = new Fixture();
  const tasks: ReadonlyArray<TaskFlow> = [fixture.contribution];
  const hierarchy = new ReportingHierarchy(tasks);
  expect(hierarchy.roots().map((node) => node.name())).toEqual(["Team Gizmo"]);
  expect(hierarchy.roots()[0]?.activity.kind).toBe(ActivityKind.Absent);
  expect(hierarchy.nodes()).toHaveLength(2);
  const rows = reportingRows(tasks);
  const parent = rows[0];
  expect(parent?.kind).toBe(ReportingRowKind.Reporting);
  switch (parent?.kind) {
    case ReportingRowKind.Reporting: {
      expect(parent.node.activity.kind).toBe(ActivityKind.Absent);
      expect(parent.node.ownTasks()).toHaveLength(0);
      const worker = parent.subRows[0];
      expect(worker?.kind).toBe(ReportingRowKind.Reporting);
      switch (worker?.kind) {
        case ReportingRowKind.Reporting:
          expect(worker.node.ownTasks()).toEqual(tasks);
          expect(worker.subRows[0]).toMatchObject({
            kind: ReportingRowKind.Task,
            task: fixture.contribution,
          });
          break;
        case ReportingRowKind.Creator:
        case ReportingRowKind.Worker:
        case ReportingRowKind.Task:
        case undefined:
          throw Error("Expected recorded worker row");
      }
      break;
    }
    case ReportingRowKind.Creator:
    case ReportingRowKind.Worker:
    case ReportingRowKind.Task:
    case undefined:
      throw Error("Expected missing reporting target anchor");
  }
});
it("counts repeated valid activities once and represents older Working before newer Completed", () => {
  const fixture = new HierarchyFixture();
  const definitions: ReadonlyArray<HierarchyActivity> = [
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
    {
      id: "worker-three",
      agent: { team: "Development", role: "TypescriptDev" },
      target: { kind: "Gizmo", coordinator: "Gizmo" },
    },
  ];
  const tasks: ReadonlyArray<TaskFlow> = definitions.map((definition) =>
    fixture.activity(definition),
  );
  const hierarchy = new ReportingHierarchy(tasks);
  expect(hierarchy.nodes()).toHaveLength(3);
  expect(hierarchy.roots()[0]?.children).toHaveLength(1);
  const team = hierarchy.nodes().find((node) => node.name() === "Team Gizmo");
  const worker = hierarchy
    .nodes()
    .find((node) => node.name() === "TypescriptDev");
  expect(worker?.ownTasks()).toHaveLength(3);
  expect(worker?.subtreeCounts().map((count) => count.count)).toEqual([3]);
  expect(team?.ownTasks()).toHaveLength(1);
  expect(team?.descendantCounts().map((count) => count.count)).toEqual([3]);
  expect(team?.subtreeCounts().map((count) => count.count)).toEqual([4]);
  expect(
    hierarchy
      .roots()[0]
      ?.descendantCounts()
      .map((count) => count.count),
  ).toEqual([4]);
  expect(team?.children).toEqual([worker]);
  expect(
    hierarchy
      .nodes()
      .flatMap((node) => node.ownTasks())
      .map((task) => task.task.common.id),
  ).toEqual(definitions.map((definition) => definition.id));
  switch (worker?.activity.kind) {
    case ActivityKind.Recorded: {
      const group = worker.activity.group;
      const working = group.tasks[0];
      const agent: AgentId = { team: "Development", role: "TypescriptDev" };
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
      expect(TaskPresentation.describe(group.latest().task).status).toBe(
        "working",
      );
      expect(group.latest()).toBe(working);
      expect(group.latest().task.common.id).toBe("worker-one");
      expect(group.tasks).toHaveLength(3);
      break;
    }
    case ActivityKind.Absent:
    case undefined:
      break;
  }
});
it("keeps migrated creator and history worker evidence outside recorded reporting ancestry", () => {
  const fixture = new Fixture();
  fixture.task.ownership = { kind: "Unrecorded" };
  const tasks: ReadonlyArray<TaskFlow> = [fixture.contribution];
  const hierarchy = new ReportingHierarchy(tasks);
  expect(hierarchy.nodes()).toHaveLength(0);
  expect(hierarchy.roots()).toHaveLength(0);
  expect(hierarchy.historical()[0]?.actor).toEqual(
    fixture.contribution.created_by,
  );
  expect(
    hierarchy.historical()[0]?.workers.get("Development:TypescriptDev")
      ?.tasks[0]?.worker,
  ).toEqual(fixture.contribution.worker);
  const creator = reportingRows(tasks)[0];
  expect(creator?.kind).toBe(ReportingRowKind.Creator);
  switch (creator?.kind) {
    case ReportingRowKind.Creator: {
      expect(creator.label).toBe(
        "Created by · Team Gizmo · reporting unrecorded",
      );
      const worker = creator.subRows[0];
      expect(worker?.kind).toBe(ReportingRowKind.Worker);
      switch (worker?.kind) {
        case ReportingRowKind.Worker:
          expect(worker.group.tasks).toEqual(tasks);
          expect(worker.subRows[0]).toMatchObject({
            kind: ReportingRowKind.Task,
            task: fixture.contribution,
          });
          break;
        case ReportingRowKind.Reporting:
        case ReportingRowKind.Creator:
        case ReportingRowKind.Task:
        case undefined:
          throw Error("Expected history worker fallback");
      }
      break;
    }
    case ReportingRowKind.Reporting:
    case ReportingRowKind.Worker:
    case ReportingRowKind.Task:
    case undefined:
      throw Error("Expected historical creator row");
  }
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
    name: /Implement reporting hierarchy/,
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
  expect(
    within(table).getByRole("row", { name: /Build workflow/ }),
  ).toBeTruthy();
  await userEvent.click(
    within(worker).getByRole("button", { name: "Collapse TypescriptDev" }),
  );
  expect(
    within(table).queryByRole("row", { name: /Build workflow/ }),
  ).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
