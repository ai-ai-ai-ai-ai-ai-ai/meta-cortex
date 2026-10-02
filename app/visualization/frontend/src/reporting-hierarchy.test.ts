import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
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
import { FlowPresentation } from "./workflow";
import Workflow from "./Workflow.svelte";
afterEach(() => cleanup());

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
  expect(graph.nodes[0]?.data.activity).toBe(ActivityKind.Absent);
  expect(graph.nodes[0]?.data.tasks).toHaveLength(0);
  expect(graph.nodes[0]?.data.state).toBe("No activity on this page");
  expect(graph.nodes[1]?.data.state).toBe("integrated");
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
  expect(graph.nodes[0]?.data.tasks).toHaveLength(0);
  expect(graph.nodes[1]?.data.tasks).toEqual(tasks);
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
  const props: ComponentProps<typeof Workflow> = {
    flow: fixture.flow(),
    select: vi.fn(),
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
  const planningHeadingQuery: ByRoleOptions = {
    name: "Plan reporting hierarchy",
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
  expect(
    within(inspector).getByRole("heading", planningHeadingQuery),
  ).toBeTruthy();
  expect(planning.getAttribute("data-current")).toBe("true");
  await userEvent.click(implementation);
  expect(
    within(inspector).getByRole("heading", workingHeadingQuery),
  ).toBeTruthy();
  expect(implementation.getAttribute("data-current")).toBe("true");
});
it("uses the real Agents graph selection handler for prioritized own activity and leaves absent targets nonselectable", async () => {
  const fixture = new CoordinatorFixture();
  const props: ComponentProps<typeof Workflow> = {
    flow: fixture.flow(),
    select: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  };
  const graphQuery: ByRoleOptions = { name: "graph" };
  const inspectorQuery: ByRoleOptions = { name: "Team Gizmo details" };
  const objectiveQuery: ByRoleOptions = {
    name: "Implement reporting hierarchy",
  };
  render(Workflow, props);
  await userEvent.click(screen.getByRole("button", graphQuery));
  await userEvent.click(await screen.findByText("Gizmo / GizmoPrime"));
  expect(screen.queryAllByRole("complementary")).toHaveLength(0);
  await userEvent.click(screen.getByText("Gizmo / Gizmo"));
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
