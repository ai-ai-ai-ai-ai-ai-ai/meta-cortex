import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  fireEvent,
  screen,
  within,
} from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import type {
  AgentId,
  ReportingTarget,
  TaskFlow,
  FeatureFlow,
} from "./contracts";
import {
  ActivityKind,
  ReportingHierarchy,
  SelectionKind,
  type TaskSelection,
} from "./agent-tree";
import {
  Fixture,
  BrowserMediaQueries,
  BrowserResizeObserver,
} from "./dashboard-fixture";
import { FlowPresentation, NodeKind } from "./workflow";
import Workflow from "./Workflow.svelte";
beforeEach(() => {
  const mediaQueries = new BrowserMediaQueries();
  const matchMedia: BrowserMediaQueries["matchMedia"] =
    mediaQueries.matchMedia.bind(mediaQueries);
  vi.stubGlobal("matchMedia", matchMedia);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface AbsentActivityExpectation {
  kind: ActivityKind.Absent;
}
interface RecordedActivityExpectation {
  kind: ActivityKind.Recorded;
  group: ActivityTasksExpectation;
}
interface ActivityTasksExpectation {
  tasks: ReadonlyArray<TaskFlow>;
}
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
  const graph = new FlowPresentation(fixture.flow).agents();
  const absent: AbsentActivityExpectation = { kind: ActivityKind.Absent };
  expect(graph.nodes[0]?.data.kind).toBe(NodeKind.Agent);
  expect(graph.nodes[0]?.data.activity).toEqual(absent);
  expect(graph.nodes[0]?.data).not.toHaveProperty("tasks");
  expect(graph.nodes[0]?.data).not.toHaveProperty("state");
  const workerData = graph.nodes[1]?.data;
  expect(workerData?.kind).toBe(NodeKind.Agent);
  switch (workerData?.kind) {
    case NodeKind.Agent:
      expect(workerData.activity.kind).toBe(ActivityKind.Recorded);
      switch (workerData.activity.kind) {
        case ActivityKind.Recorded:
          expect(workerData.activity.group.status()).toBe("integrated");
          expect(workerData.activity.group.tasks).toEqual(tasks);
          break;
        case ActivityKind.Absent:
          break;
      }
      break;
    case NodeKind.Task:
    case NodeKind.Branch:
    case undefined:
      break;
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
  expect(hierarchy.edges()).toHaveLength(2);
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
  expect(
    hierarchy
      .edges()
      .flatMap((edge) => edge.tasks)
      .map((task) => task.task.common.id),
  ).toEqual(definitions.map((definition) => definition.id));
  switch (worker?.activity.kind) {
    case ActivityKind.Recorded: {
      const group = worker.activity.group;
      const working = group.first();
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
      expect(group.status()).toBe("working");
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
  expect(hierarchy.edges()).toHaveLength(0);
  expect(hierarchy.historical()[0]?.actor).toEqual(
    fixture.contribution.created_by,
  );
  expect(
    hierarchy.historical()[0]?.workers.get("Development:TypescriptDev")
      ?.tasks[0]?.worker,
  ).toEqual(fixture.contribution.worker);
  const graph = new FlowPresentation(fixture.flow).agents();
  const absent: AbsentActivityExpectation = { kind: ActivityKind.Absent };
  expect(graph.nodes[0]?.data.activity).toEqual(absent);
  expect(graph.nodes[0]?.data).not.toHaveProperty("tasks");
  const recorded: RecordedActivityExpectation = {
    kind: ActivityKind.Recorded,
    group: { tasks },
  };
  expect(graph.nodes[1]?.data.activity).toMatchObject(recorded);
  expect(graph.edges[0]?.label).toBe("created by · reporting unrecorded");
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
it("selects the prioritized coordinator activity and keeps all recorded activities selectable", async () => {
  const flow = new CoordinatorFixture().flow();
  const select = vi.fn<(selection: TaskSelection) => void>();
  render(Workflow, { flow, select, history: vi.fn() });
  const summary = screen.getByRole("button", {
    name: "0 integrated · 1 completed · 0 ready · 2 tasks · own activities",
  });
  await userEvent.click(summary);
  const working = flow.tasks.records.find(
    (item) => item.task.common.objective === "Implement reporting hierarchy",
  );
  expect(working).toBeTruthy();
  const expected = { kind: SelectionKind.Activity, task: working };
  expect(select).toHaveBeenLastCalledWith(expected);
  const table = screen.getByRole("table", { name: /Team Gizmo/ });
  expect(within(table).getByText("In progress")).toBeTruthy();
  await userEvent.click(
    within(table).getByRole("button", { name: "Plan reporting hierarchy" }),
  );
  expect(select).toHaveBeenLastCalledWith({
    kind: SelectionKind.Activity,
    task: flow.tasks.records[0],
  });
  await userEvent.click(
    within(table).getByRole("button", {
      name: "Implement reporting hierarchy",
    }),
  );
  expect(select).toHaveBeenLastCalledWith(expected);
});
it("uses default graph nodes and the real selection handler without selecting absent anchors", async () => {
  const flow = new CoordinatorFixture().flow();
  const select = vi.fn<(selection: TaskSelection) => void>();
  vi.stubGlobal("ResizeObserver", BrowserResizeObserver);
  render(Workflow, { flow, select, history: vi.fn() });
  await userEvent.click(screen.getByRole("tab", { name: "graph" }));
  const prime = await screen.findByText(/Gizmo \/ GizmoPrime/);
  await fireEvent.click(prime);
  expect(select).not.toHaveBeenCalled();
  const team = await screen.findByText(/Gizmo \/ Gizmo\s/);
  await fireEvent.click(team);
  expect(select).toHaveBeenLastCalledWith({
    kind: SelectionKind.Activity,
    task: flow.tasks.records[1],
  });
});
