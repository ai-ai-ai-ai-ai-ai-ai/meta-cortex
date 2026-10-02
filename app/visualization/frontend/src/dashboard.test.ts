import { afterEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import {
  cleanup,
  render,
  screen,
  within,
  type ByRoleOptions,
} from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import TaskDetail from "./TaskDetail.svelte";
import Workflow from "./Workflow.svelte";
import ProgressSummary from "./ProgressSummary.svelte";
import App from "./App.svelte";
import { Progress } from "$lib/components/ui/progress";
import type { ComponentProps } from "svelte";
import { DashboardApi, ReadFailureKind } from "./api";
import { FlowPresentation } from "./workflow";
import type {
  AgentId,
  DesktopSelection,
  DesktopRead,
  DesktopReply,
  DesktopFailure,
  FeatureFlow,
  TaskV2,
  TaskFlow,
} from "./contracts";
const initialRead: DesktopRead = { kind: "Initial" };
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
});
class Fixture {
  task: TaskV2 = {
    version: 2,
    ownership: {
      kind: "Assigned",
      assignment: {
        agent: { team: "Development", role: "TypescriptDev" },
        reports_to: { kind: "Gizmo", coordinator: "Gizmo" },
      },
    },
    workspace: { kind: "git", branch: "codex/worker", path: "/fixture" },
    state: { kind: "integrated", commit: "b".repeat(40) },
    common: {
      id: "implement",
      feature: "dashboard",
      attempt: 1,
      revision: 5,
      objective: "Build workflow",
      acceptance: ["Show recorded work"],
      dependencies: [],
      created_at: 1000,
      last_update: 2000,
      last_progress: 1500,
      checkpoint: { kind: "git", commit: "a".repeat(40) },
      progress: {
        summary: "Graph completed",
        findings: [],
        next_steps: [],
        checks: [],
        extensions: { artifact: "native-contract-v2" },
      },
    },
  };
  contribution: TaskFlow = {
    task: this.task,
    created_by: { kind: "recorded", agent: { team: "Gizmo", role: "Gizmo" } },
    worker: {
      kind: "recorded",
      agent: { team: "Development", role: "TypescriptDev" },
    },
    checkpoints: [
      {
        commit: "a".repeat(40),
        actor: { team: "Development", role: "TypescriptDev" },
        at: 1500,
        revision: 3,
      },
    ],
    integrations: [
      {
        commit: "b".repeat(40),
        actor: { team: "Delivery", role: "IntegrationAgent" },
        at: 2000,
        revision: 5,
      },
    ],
    milestones: [],
    history_end: "Complete",
  };
  flow: FeatureFlow = {
    feature: {
      id: "dashboard",
      branch: "codex/feature",
      objective: "Build workflow",
      version: 1,
      worktree: "/feature",
    },
    counts: [{ state: "integrated", count: 101 }],
    tasks: { end: "More", records: [this.contribution] },
    observed_at: 2000,
  };
}
it("uses full feature totals while graph contributions remain paged", () => {
  const fixture = new Fixture();
  const presentation = new FlowPresentation(fixture.flow);
  expect(presentation.total()).toBe(101);
  expect(presentation.agents().nodes.map((node) => node.data.title)).toEqual([
    "Gizmo / Gizmo",
    "Development / TypescriptDev",
  ]);
  expect(presentation.git().edges[0]?.label).toBe("integrated bbbbbbbb");
  expect(presentation.git().nodes[0]?.data.title).toBe("codex/feature");
});
it("does not invent merges or assignments", () => {
  const fixture = new Fixture();
  fixture.contribution.integrations = [];
  fixture.contribution.worker = { kind: "unrecorded" };
  fixture.task.ownership = { kind: "Unrecorded" };
  const presentation = new FlowPresentation(fixture.flow);
  expect(presentation.git().edges).toHaveLength(0);
  expect(presentation.agents().edges[0]?.label).toBe("created · unassigned");
});
it("keeps full-feature counts and progress visible independently of loaded agent tasks", async () => {
  const fixture = new Fixture();
  fixture.flow.counts = [
    { state: "integrated", count: 3 },
    { state: "working", count: 1 },
    { state: "queued", count: 1 },
  ];
  const refresh = vi.fn();
  render(Workflow, {
    flow: fixture.flow,
    select: vi.fn(),
    history: vi.fn(),
    refresh,
  });
  expect(screen.getByText("3 integrated")).toBeTruthy();
  expect(screen.getByText("1 working")).toBeTruthy();
  expect(screen.getByText("1 queued")).toBeTruthy();
  expect(screen.getByText("60%")).toBeTruthy();
  const totals = screen.getAllByRole("progressbar", {
    name: "Finished tasks",
  });
  expect(totals[0]?.getAttribute("aria-valuenow")).toBe("3");
  expect(totals[0]?.getAttribute("aria-valuemax")).toBe("5");
  expect(totals[1]?.getAttribute("aria-valuemax")).toBe("1");
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(refresh).toHaveBeenCalledOnce();
});
it("exposes raw completed task quantities through the generated progress primitive", () => {
  const props: ComponentProps<typeof Progress> = {
    value: 3,
    max: 5,
    "aria-label": "Recorded task completion",
  };
  render(Progress, props);
  const query: ByRoleOptions = {
    name: "Recorded task completion",
  };
  const meter = screen.getByRole("progressbar", query);
  expect(meter.getAttribute("aria-valuenow")).toBe("3");
  expect(meter.getAttribute("aria-valuemax")).toBe("5");
  expect(meter.getAttribute("aria-valuemin")).toBe("0");
  expect(meter.innerHTML).toContain("translateX(-40%)");
});
it("opens history through the Svelte task view", async () => {
  const fixture = new Fixture();
  const history = vi.fn();
  const back = vi.fn();
  render(TaskDetail, { task: fixture.task, history, back });
  await userEvent.click(
    screen.getByRole("button", { name: "History & attempts" }),
  );
  expect(history).toHaveBeenCalledOnce();
  expect(screen.getByText("Graph completed")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "← Workflow" }));
  expect(back).toHaveBeenCalledOnce();
});
it("validates the native reply before use", async () => {
  native.invoke.mockResolvedValueOnce({
    content: { kind: "Features", value: { records: [], end: "Complete" } },
    selection: { view: { kind: "Features" }, page: 0 },
  });
  const reply = await Effect.runPromise(new DashboardApi().read(initialRead));
  expect(reply.content.kind).toBe("Features");
  expect(native.invoke).toHaveBeenCalledWith("dashboard_read", {
    request: { kind: "Initial" },
  });
  native.invoke.mockResolvedValueOnce({ content: "invalid" });
  const result = await Effect.runPromise(
    Effect.result(new DashboardApi().read(initialRead)),
  );
  expect(result._tag).toBe("Failure");
});

it("rejects unknown native enums, forbidden fields, nulls, and wrong scalar types", async () => {
  const reply: DesktopReply = {
    content: { kind: "Features", value: { records: [], end: "Complete" } },
    selection: { view: { kind: "Features" }, page: 0 },
  };
  for (const raw of [
    { ...reply, content: { kind: "Unknown", value: reply.content.value } },
    {
      ...reply,
      content: { kind: "Features", value: { records: [], end: "Unknown" } },
    },
    {
      ...reply,
      selection: { view: { kind: "Features", unexpected: true }, page: 0 },
    },
    { ...reply, content: null },
    { ...reply, selection: { ...reply.selection, page: "0" } },
  ]) {
    native.invoke.mockResolvedValueOnce(raw);
    const result = await Effect.runPromise(
      Effect.result(new DashboardApi().read(initialRead)),
    );
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { kind: ReadFailureKind.InvalidReply, cause: raw },
    });
  }
});

it("preserves Unicode, empty prose, and schema-permitted extra native fields", async () => {
  const fixture = new Fixture();
  fixture.task.common.objective = "🚀 日本語 e\u0301";
  fixture.task.common.progress.summary = "";
  const reply: DesktopReply = {
    content: { kind: "Task", value: fixture.task, extra: "allowed by schema" },
    selection: { view: { kind: "Features" }, page: 0 },
    extra: "allowed by schema",
  };
  native.invoke.mockResolvedValueOnce(reply);
  expect(await Effect.runPromise(new DashboardApi().read(initialRead))).toEqual(
    reply,
  );
});

it("classifies valid native failures separately from malformed transport failures", async () => {
  const failures: DesktopFailure[] = [
    { kind: "Ledger", message: "台帳 🚀" },
    { kind: "Runtime", message: "" },
    {
      kind: "Native",
      message: "Native unavailable",
      extra: "allowed by schema",
    },
  ];
  for (const failure of failures) {
    native.invoke.mockRejectedValueOnce(failure);
    expect(
      await Effect.runPromise(
        Effect.result(new DashboardApi().read(initialRead)),
      ),
    ).toMatchObject({
      _tag: "Failure",
      failure,
    });
  }
  for (const cause of [
    { kind: "Unknown", message: "Unrecognized native kind" },
    { kind: "Ledger", message: null },
    { kind: "Ledger" },
  ]) {
    native.invoke.mockRejectedValueOnce(cause);
    expect(
      await Effect.runPromise(
        Effect.result(new DashboardApi().read(initialRead)),
      ),
    ).toMatchObject({
      _tag: "Failure",
      failure: { kind: ReadFailureKind.Transport, cause },
    });
  }
});

it("keeps the team heading and progress visible while collapsing its tasks", async () => {
  const fixture = new Fixture();
  render(Workflow, {
    flow: fixture.flow,
    select: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  });
  const team = screen.getByRole("button", { name: "Team Gizmo" });
  expect(team.getAttribute("aria-expanded")).toBe("true");
  expect(team.textContent).toContain("1 recorded tasks");
  await userEvent.click(team);
  expect(team.getAttribute("aria-expanded")).toBe("false");
  expect(
    screen.queryByRole("button", { name: "Expand TypescriptDev tasks" }),
  ).toBeNull();
  expect(
    screen.getAllByRole("progressbar", { name: "Finished tasks" }),
  ).toHaveLength(2);
  await userEvent.keyboard("{Enter}");
  expect(team.getAttribute("aria-expanded")).toBe("true");
  expect(
    screen.getByRole("button", { name: "Expand TypescriptDev tasks" }),
  ).toBeTruthy();
});
it("expands real tasks and opens a closable agent inspector", async () => {
  const fixture = new Fixture();
  const select = vi.fn();
  const history = vi.fn();
  render(Workflow, {
    flow: fixture.flow,
    select,
    history,
    refresh: vi.fn(),
  });
  const expand = screen.getByRole("button", {
    name: "Expand TypescriptDev tasks",
  });
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  await userEvent.click(expand);
  expect(expand.getAttribute("aria-expanded")).toBe("true");
  const task = screen.getByRole("button", {
    name: "Build workflow Integrated",
  });
  await userEvent.click(task);
  const inspector = screen.getByRole("complementary", {
    name: "TypescriptDev details",
  });
  expect(within(inspector).getByText("Git evidence")).toBeTruthy();
  expect(within(inspector).getByText("codex/worker")).toBeTruthy();
  expect(document.activeElement).toBe(
    within(inspector).getByRole("button", { name: "Close agent details" }),
  );
  await userEvent.click(
    within(inspector).getByRole("button", { name: "↶ Open full history" }),
  );
  expect(history).toHaveBeenCalledWith(fixture.task);
  await userEvent.keyboard("{Escape}");
  expect(
    screen.queryByRole("complementary", { name: "TypescriptDev details" }),
  ).toBeNull();
  expect(document.activeElement).toBe(task);
});
it("retries a native read failure without issuing coordination commands", async () => {
  native.invoke
    .mockRejectedValueOnce({ kind: "Ledger", message: "Database busy" })
    .mockResolvedValueOnce({
      content: { kind: "Features", value: { records: [], end: "Complete" } },
      selection: { view: { kind: "Features" }, page: 0 },
    });
  render(App);
  await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(
    await screen.findByRole("heading", { name: "Choose a feature" }),
  ).toBeTruthy();
  expect(native.invoke.mock.calls).toEqual([
    ["dashboard_read", { request: { kind: "Initial" } }],
    ["dashboard_read", { request: { kind: "Initial" } }],
  ]);
});

it("includes completed activity in terminal progress while preserving integrated counts", () => {
  const finishedTasksQuery: ByRoleOptions = { name: "Finished tasks" };
  const props: ComponentProps<typeof ProgressSummary> = {
    counts: [
      { state: "integrated", count: 1 },
      { state: "completed", count: 1 },
      { state: "queued", count: 1 },
    ],
  };
  render(ProgressSummary, props);
  expect(screen.getByText("1 integrated")).toBeTruthy();
  expect(screen.getByText("1 completed")).toBeTruthy();
  const meter = screen.getByRole("progressbar", finishedTasksQuery);
  expect(meter.getAttribute("aria-valuenow")).toBe("2");
  expect(meter.getAttribute("aria-valuemax")).toBe("3");
  expect(screen.getByText("67%")).toBeTruthy();
});

it("renders completed read-only ownership and reporting without inventing Git evidence", async () => {
  const expandTechWriterVerifierTasksQuery: ByRoleOptions = {
    name: "Expand TechWriterVerifier tasks",
  };
  const buildWorkflowCompletedQuery: ByRoleOptions = {
    name: "Build workflow Completed",
  };
  const techWriterVerifierDetailsQuery: ByRoleOptions = {
    name: "TechWriterVerifier details",
  };
  const fixture = new Fixture();
  const agent = {
    team: "Ai",
    role: "TechWriterVerifier",
  } satisfies AgentId;
  fixture.task.workspace = { kind: "read_only" };
  fixture.task.state = { kind: "completed", agent, attempt: 1 };
  fixture.task.ownership = {
    kind: "Assigned",
    assignment: { agent, reports_to: { kind: "Host" } },
  };
  fixture.task.common.checkpoint = { kind: "unrecorded" };
  fixture.contribution.worker = { kind: "recorded", agent };
  fixture.contribution.checkpoints = [];
  fixture.contribution.integrations = [];
  fixture.flow.counts = [{ state: "completed", count: 1 }];
  fixture.contribution.milestones = [
    {
      actor: agent,
      at: 2000,
      attempt: 1,
      kind: "completed",
      note: "Review finished",
      revision: 5,
    },
  ];
  const props: ComponentProps<typeof Workflow> = {
    flow: fixture.flow,
    select: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  };
  render(Workflow, props);
  expect(screen.getAllByText("1 completed").length).toBeGreaterThan(0);
  await userEvent.click(
    screen.getByRole("button", expandTechWriterVerifierTasksQuery),
  );
  await userEvent.click(
    screen.getByRole("button", buildWorkflowCompletedQuery),
  );
  const inspector = screen.getByRole(
    "complementary",
    techWriterVerifierDetailsQuery,
  );
  expect(within(inspector).getByText("Host")).toBeTruthy();
  expect(within(inspector).getByText("Read only")).toBeTruthy();
  expect(within(inspector).getAllByText("Unrecorded")).toHaveLength(2);
  expect(within(inspector).getByText("Completed task")).toBeTruthy();
  expect(within(inspector).getByText(/native-contract-v2/)).toBeTruthy();
  const presentation = new FlowPresentation(fixture.flow);
  expect(presentation.git().edges).toHaveLength(0);
  expect(presentation.git().nodes).toHaveLength(1);
});

it("renders a queued assigned worker and feature workspace before any claim history", async () => {
  const teamGizmoQuery: ByRoleOptions = { name: "Team Gizmo" };
  const expandTypescriptVerifierTasksQuery: ByRoleOptions = {
    name: "Expand TypescriptVerifier tasks",
  };
  const buildWorkflowQueuedQuery: ByRoleOptions = {
    name: "Build workflow Queued",
  };
  const typescriptVerifierDetailsQuery: ByRoleOptions = {
    name: "TypescriptVerifier details",
  };
  const fixture = new Fixture();
  const agent = {
    team: "Development",
    role: "TypescriptVerifier",
  } satisfies AgentId;
  fixture.task.workspace = { kind: "feature" };
  fixture.task.state = { kind: "queued" };
  fixture.task.ownership = {
    kind: "Assigned",
    assignment: {
      agent,
      reports_to: { kind: "Gizmo", coordinator: "GizmoPrime" },
    },
  };
  fixture.task.common.checkpoint = { kind: "unrecorded" };
  fixture.contribution.worker = { kind: "recorded", agent };
  fixture.contribution.checkpoints = [];
  fixture.contribution.integrations = [];
  fixture.contribution.milestones = [
    {
      actor: { team: "Gizmo", role: "Gizmo" },
      at: 1500,
      attempt: 0,
      kind: "assigned",
      note: "Review assigned",
      revision: 2,
    },
  ];
  fixture.flow.counts = [{ state: "queued", count: 1 }];
  const props: ComponentProps<typeof Workflow> = {
    flow: fixture.flow,
    select: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  };
  render(Workflow, props);
  expect(screen.getByRole("button", teamGizmoQuery)).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", expandTypescriptVerifierTasksQuery),
  );
  await userEvent.click(screen.getByRole("button", buildWorkflowQueuedQuery));
  const inspector = screen.getByRole(
    "complementary",
    typescriptVerifierDetailsQuery,
  );
  expect(within(inspector).getByText("Gizmo Prime")).toBeTruthy();
  expect(within(inspector).getByText("Feature workspace")).toBeTruthy();
  expect(within(inspector).getByText("Recorded assignment")).toBeTruthy();
  expect(new FlowPresentation(fixture.flow).git().edges).toHaveLength(0);
});

it("accepts completed feature work and retains native history worker fallback for unrecorded ownership", async () => {
  const fixture = new Fixture();
  const agent = {
    team: "Development",
    role: "TypescriptDev",
  } satisfies AgentId;
  fixture.task.workspace = { kind: "feature" };
  fixture.task.state = { kind: "completed", agent, attempt: 1 };
  fixture.task.ownership = { kind: "Unrecorded" };
  fixture.task.common.checkpoint = { kind: "unrecorded" };
  fixture.contribution.checkpoints = [];
  fixture.contribution.integrations = [];
  fixture.flow.counts = [{ state: "completed", count: 1 }];
  const reply: DesktopReply = {
    content: { kind: "Workflow", value: fixture.flow },
    selection: { view: { kind: "Tasks", feature: "dashboard" }, page: 0 },
  };
  native.invoke.mockResolvedValueOnce(reply);
  expect(await Effect.runPromise(new DashboardApi().read(initialRead))).toEqual(
    reply,
  );
  const presentation = new FlowPresentation(fixture.flow);
  expect(presentation.agents().nodes.map((node) => node.data.title)).toContain(
    "Development / TypescriptDev",
  );
  expect(presentation.git().edges).toHaveLength(0);
  expect(presentation.git().nodes).toHaveLength(1);
  const props: ComponentProps<typeof TaskDetail> = {
    task: fixture.task,
    history: vi.fn(),
    back: vi.fn(),
  };
  render(TaskDetail, props);
  expect(screen.getByText("Feature workspace")).toBeTruthy();
  expect(screen.getAllByText("Unrecorded")).toHaveLength(3);
  expect(screen.getByText(/native-contract-v2/)).toBeTruthy();
});

it("shows the native history worker of a migrated integrated task without inventing reporting ownership", async () => {
  const expandTypescriptDevTasksQuery: ByRoleOptions = {
    name: "Expand TypescriptDev tasks",
  };
  const buildWorkflowIntegratedQuery: ByRoleOptions = {
    name: "Build workflow Integrated",
  };
  const typescriptDevDetailsQuery: ByRoleOptions = {
    name: "TypescriptDev details",
  };
  const fixture = new Fixture();
  fixture.task.ownership = { kind: "Unrecorded" };
  fixture.contribution.milestones = [
    {
      actor: { team: "Development", role: "TypescriptDev" },
      at: 1200,
      attempt: 1,
      kind: "claimed",
      note: "Recorded before ownership migration",
      revision: 2,
    },
    {
      actor: { team: "Delivery", role: "IntegrationAgent" },
      at: 2000,
      attempt: 1,
      kind: "integrated",
      note: "Recorded integration",
      revision: 5,
    },
  ];
  const props: ComponentProps<typeof Workflow> = {
    flow: fixture.flow,
    select: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  };
  render(Workflow, props);
  await userEvent.click(
    screen.getByRole("button", expandTypescriptDevTasksQuery),
  );
  await userEvent.click(
    screen.getByRole("button", buildWorkflowIntegratedQuery),
  );
  const inspector = screen.getByRole(
    "complementary",
    typescriptDevDetailsQuery,
  );
  expect(
    within(inspector).getByText("Development / TypescriptDev"),
  ).toBeTruthy();
  expect(within(inspector).getByText("Unrecorded")).toBeTruthy();
  expect(within(inspector).getByTitle("a".repeat(40))).toBeTruthy();
  expect(within(inspector).getByTitle("b".repeat(40))).toBeTruthy();
  expect(within(inspector).getByText("Claimed attempt 1")).toBeTruthy();
  expect(within(inspector).getByText("Recorded integration")).toBeTruthy();
  expect(within(inspector).getByText(/native-contract-v2/)).toBeTruthy();
  cleanup();
  const detail: ComponentProps<typeof TaskDetail> = {
    task: fixture.task,
    history: vi.fn(),
    back: vi.fn(),
  };
  render(TaskDetail, detail);
  expect(screen.getByText("Worker").nextElementSibling?.textContent).toBe(
    "Unrecorded",
  );
  expect(screen.getByText("Reports to").nextElementSibling?.textContent).toBe(
    "Unrecorded",
  );
});

it("rejects legacy, future, flattened, and malformed ownership TaskV2 replies", async () => {
  const fixture = new Fixture();
  const selection = {
    view: { kind: "Features" },
    page: 0,
  } satisfies DesktopSelection;
  for (const task of [
    { ...fixture.task, version: 1 },
    { ...fixture.task, version: 3 },
    {
      ...fixture.task.common,
      version: 2,
      ownership: fixture.task.ownership,
      workspace: fixture.task.workspace,
      state: fixture.task.state,
    },
    { ...fixture.task, common: { ...fixture.task.common, unexpected: true } },
    {
      ...fixture.task,
      ownership: {
        kind: "Assigned",
        assignment: {
          agent: { team: "Ai", role: "TypescriptVerifier" },
          reports_to: { kind: "Host" },
        },
      },
    },
    {
      ...fixture.task,
      ownership: {
        kind: "Assigned",
        assignment: {
          agent: { team: "Development", role: "TypescriptDev" },
          reports_to: { kind: "Gizmo" },
        },
      },
    },
  ]) {
    native.invoke.mockResolvedValueOnce({
      content: { kind: "Task", value: task },
      selection,
    });
    const result = await Effect.runPromise(
      Effect.result(new DashboardApi().read(initialRead)),
    );
    expect(result._tag).toBe("Failure");
    switch (result._tag) {
      case "Failure":
        expect(result.failure.kind).toBe(ReadFailureKind.InvalidReply);
        break;
      case "Success":
        break;
    }
  }
});
