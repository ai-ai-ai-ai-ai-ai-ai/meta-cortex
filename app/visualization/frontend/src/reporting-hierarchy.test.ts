import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  fireEvent,
  screen,
  within,
  waitFor,
  type ByRoleOptions,
} from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "svelte";
import type {
  AgentId,
  ReportingTarget,
  TaskFlow,
  FeatureFlow,
} from "./contracts";
import { ActivityKind, ReportingHierarchy } from "./agent-tree";
import { Fixture } from "./dashboard-fixture";
import { FlowPresentation, NodeKind } from "./workflow";
import Workflow from "./Workflow.svelte";
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
  expect(hierarchy.historical()[0]?.tasks()[0]?.worker).toEqual(
    fixture.contribution.worker,
  );
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
it("selects compact coordinator own activity matching Working and keeps every objective selectable", async () => {
  const fixture = new CoordinatorFixture();
  const flow = fixture.flow();
  const select = vi.fn();
  const props: ComponentProps<typeof Workflow> = {
    flow,
    select,
    history: vi.fn(),
    refresh: vi.fn(),
  };
  const rowQuery: ByRoleOptions = {
    name: /Team Gizmo 2 own activities Implement reporting hierarchy working/,
  };
  const inspectorQuery: ByRoleOptions = { name: "Team Gizmo details" };
  const workingHeadingQuery: ByRoleOptions = {
    name: "Implement reporting hierarchy",
  };
  const planningQuery: ByRoleOptions = { name: /Plan reporting hierarchy/ };
  const implementationQuery: ByRoleOptions = {
    name: /Implement reporting hierarchy/,
  };
  render(Workflow, props);
  const row = screen.getByRole("button", rowQuery);
  expect(screen.getAllByRole("button", rowQuery)).toHaveLength(1);
  await userEvent.click(row);
  const inspector = screen.getByRole("complementary", inspectorQuery);
  expect(
    within(inspector).getByRole("heading", workingHeadingQuery),
  ).toBeTruthy();
  expect(
    within(inspector).getAllByText("working")[0]?.getAttribute("data-state"),
  ).toBe("working");
  expect(within(inspector).queryAllByText("Git evidence")).toHaveLength(0);
  const planning = within(inspector).getByRole("button", planningQuery);
  const implementation = within(inspector).getByRole(
    "button",
    implementationQuery,
  );
  expect(implementation.getAttribute("data-current")).toBe("true");
  await userEvent.click(planning);
  expect(select).toHaveBeenLastCalledWith(flow.tasks.records[0]?.task);
  await userEvent.click(implementation);
  expect(select).toHaveBeenLastCalledWith(flow.tasks.records[1]?.task);
  expect(
    within(inspector).getByRole("heading", workingHeadingQuery),
  ).toBeTruthy();
});
// JSDOM has no matchMedia. Svelte's MediaQuery uses matches/media and
// EventTarget change listeners; keep real graph components and handlers intact.
class BrowserMediaQuery extends EventTarget {
  readonly matches = false;
  constructor(readonly media: string) {
    super();
  }
}
class BrowserMediaQueries {
  matchMedia(query: string): BrowserMediaQuery {
    return new BrowserMediaQuery(query);
  }
}
// JSDOM has no layout-driven resize notifications. Track native observer
// lifecycles while leaving SvelteFlow rendering and selection handlers real.
class BrowserResizeObserver implements ResizeObserver {
  private readonly targets = new Set<Element>();
  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
}
it("uses the real Agents graph selection handler for prioritized own activity and leaves absent targets nonselectable", async () => {
  const fixture = new CoordinatorFixture();
  const props: ComponentProps<typeof Workflow> = {
    flow: fixture.flow(),
    select: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  };
  const mediaQueries = new BrowserMediaQueries();
  const matchMedia: BrowserMediaQueries["matchMedia"] =
    mediaQueries.matchMedia.bind(mediaQueries);
  vi.stubGlobal("matchMedia", matchMedia);
  vi.stubGlobal("ResizeObserver", BrowserResizeObserver);
  const graphQuery: ByRoleOptions = { name: "graph" };
  const inspectorQuery: ByRoleOptions = { name: "Team Gizmo details" };
  const objectiveQuery: ByRoleOptions = {
    name: "Implement reporting hierarchy",
  };
  render(Workflow, props);
  await userEvent.click(screen.getByRole("tab", graphQuery));
  const prime = await screen.findByText("Gizmo / GizmoPrime");
  await fireEvent.click(prime);
  expect(screen.queryAllByRole("complementary")).toHaveLength(0);
  const team = screen.getByText("Gizmo / Gizmo");
  await fireEvent.click(team);
  const inspector = screen.getByRole("complementary", inspectorQuery);
  expect(within(inspector).getByRole("heading", objectiveQuery)).toBeTruthy();
  expect(
    within(inspector).getAllByText("working")[0]?.getAttribute("data-state"),
  ).toBe("working");
  expect(
    within(inspector).getAllByText("Shared feature workspace"),
  ).toHaveLength(2);
  expect(within(inspector).queryAllByText("Git evidence")).toHaveLength(0);
});

it("restores the second activity origin after selecting another role in the open desktop inspector", async () => {
  const mediaQueries = new BrowserMediaQueries();
  const matchMedia: BrowserMediaQueries["matchMedia"] =
    mediaQueries.matchMedia.bind(mediaQueries);
  vi.stubGlobal("matchMedia", matchMedia);
  const first = new Fixture();
  const second = new Fixture();
  const agent: AgentId = { team: "Development", role: "RustDev" };
  second.task.common.id = "inspect-database";
  second.task.common.objective = "Inspect database";
  second.task.ownership = {
    kind: "Assigned",
    assignment: { agent, reports_to: { kind: "Gizmo", coordinator: "Gizmo" } },
  };
  second.contribution.worker = { kind: "recorded", agent };
  first.flow.tasks.records = [first.contribution, second.contribution];
  const props: ComponentProps<typeof Workflow> = {
    flow: first.flow,
    select: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  };
  render(Workflow, props);
  const firstExpandQuery: ByRoleOptions = {
    name: "Expand TypescriptDev tasks",
  };
  const secondExpandQuery: ByRoleOptions = { name: "Expand RustDev tasks" };
  const firstTaskQuery: ByRoleOptions = {
    name: "Build workflow Git worker Integrated",
  };
  const secondTaskQuery: ByRoleOptions = {
    name: "Inspect database Git worker Integrated",
  };
  const firstInspectorQuery: ByRoleOptions = { name: "TypescriptDev details" };
  const secondInspectorQuery: ByRoleOptions = { name: "RustDev details" };
  await userEvent.click(screen.getByRole("button", firstExpandQuery));
  const original = screen.getByRole("button", firstTaskQuery);
  await userEvent.click(original);
  expect(screen.getByRole("complementary", firstInspectorQuery)).toBeTruthy();
  const secondExpand = screen.getByRole("button", secondExpandQuery);
  expect(secondExpand.closest("[inert]")).toBeNull();
  await userEvent.click(secondExpand);
  const current = screen.getByRole("button", secondTaskQuery);
  await userEvent.click(current);
  expect(screen.getByRole("complementary", secondInspectorQuery)).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => {
    expect(
      screen.queryByRole("complementary", secondInspectorQuery),
    ).toBeNull();
    expect(document.activeElement).toBe(current);
  });
  expect(document.activeElement).not.toBe(original);
});
