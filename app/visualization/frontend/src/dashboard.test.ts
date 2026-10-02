import { afterEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import TaskDetail from "./TaskDetail.svelte";
import Workflow from "./Workflow.svelte";
import App from "./App.svelte";
import { DashboardApi } from "./api";
import { FlowPresentation } from "./workflow";
import type { FeatureFlow, Task, TaskFlow } from "./contracts";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
});
class Fixture {
  task: Task = {
    id: "implement",
    feature: "dashboard",
    version: 1,
    attempt: 1,
    revision: 5,
    objective: "Build workflow",
    acceptance: ["Show recorded work"],
    dependencies: [],
    created_at: 1000,
    last_update: 2000,
    last_progress: 1500,
    workspace: { kind: "git", branch: "codex/worker", path: "/fixture" },
    checkpoint: { kind: "git", commit: "a".repeat(40) },
    state: { kind: "integrated", commit: "b".repeat(40) },
    progress: {
      summary: "Graph completed",
      findings: [],
      next_steps: [],
      checks: [],
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
    name: "Integrated tasks",
  });
  expect(totals[0]?.getAttribute("value")).toBe("3");
  expect(totals[0]?.getAttribute("max")).toBe("5");
  expect(totals[1]?.getAttribute("max")).toBe("1");
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(refresh).toHaveBeenCalledOnce();
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
  const reply = await Effect.runPromise(
    new DashboardApi().read({ kind: "Initial" }),
  );
  expect(reply.content.kind).toBe("Features");
  expect(native.invoke).toHaveBeenCalledWith("dashboard_read", {
    request: { kind: "Initial" },
  });
  native.invoke.mockResolvedValueOnce({ content: "invalid" });
  const result = await Effect.runPromise(
    Effect.result(new DashboardApi().read({ kind: "Initial" })),
  );
  expect(result._tag).toBe("Failure");
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
    name: "Build workflow Completed",
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
