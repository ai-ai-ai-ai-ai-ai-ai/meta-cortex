import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { Deferred, Effect } from "effect";
import App from "./App.svelte";
import Workflow from "./Workflow.svelte";
import RecordedTask from "./RecordedTask.svelte";
import { Progress } from "$lib/components/ui/progress";
import { FlowPresentation } from "./workflow";
import { TaskPresentation } from "./task-presentation";
import { summarizeCounts } from "./progress-presentation";
import type { AgentId, DesktopFailure, DesktopReply, Event } from "./contracts";
import {
  Fixture,
  BrowserMediaQueries,
  BrowserResizeObserver,
  renderedClientRects,
} from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
beforeEach(() => {
  const media = new BrowserMediaQueries();
  vi.stubGlobal("matchMedia", media.matchMedia.bind(media));
  vi.stubGlobal("ResizeObserver", BrowserResizeObserver);
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
    renderedClientRects,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  native.invoke.mockReset();
  vi.unstubAllGlobals();
});
it("keeps native feature totals and graph integration provenance separate from loaded activity", () => {
  const fixture = new Fixture();
  const graph = new FlowPresentation(fixture.flow);
  expect(summarizeCounts(fixture.flow.counts).total).toBe(101);
  expect(graph.agents().nodes.map((node) => node.data.title)).toEqual([
    "Gizmo / Gizmo",
    "Development / TypescriptDev",
  ]);
  expect(graph.git().edges[0]?.label).toBe("integrated bbbbbbbb");
  expect(graph.git().nodes[0]?.data.title).toBe("codex/feature");
  fixture.contribution.integrations = [];
  fixture.contribution.worker = { kind: "unrecorded" };
  fixture.task.ownership = { kind: "Unrecorded" };
  expect(graph.git().edges).toHaveLength(0);
  expect(graph.agents().edges[0]?.label).toBe(
    "created by · reporting unrecorded",
  );
});
it("shows full-feature quantities independently of loaded descendant progress", () => {
  const fixture = new Fixture();
  fixture.flow.counts = [
    { state: "integrated", count: 3 },
    { state: "working", count: 1 },
    { state: "queued", count: 1 },
  ];
  render(Workflow, { flow: fixture.flow, select: vi.fn(), history: vi.fn() });
  const meters = screen.getAllByRole("progressbar", {
    name: "Finished activities",
  });
  expect(meters[0]?.getAttribute("aria-valuenow")).toBe("3");
  expect(meters[0]?.getAttribute("aria-valuemax")).toBe("5");
  expect(meters[1]?.getAttribute("aria-valuemax")).toBe("1");
  expect(screen.getByText("3 finished / 5 activities")).toBeTruthy();
});
it("preserves stock Progress raw completion values", () => {
  render(Progress, {
    value: 3,
    max: 5,
    "aria-label": "Recorded task completion",
  });
  const meter = screen.getByRole("progressbar", {
    name: "Recorded task completion",
  });
  expect(meter.getAttribute("aria-valuenow")).toBe("3");
  expect(meter.getAttribute("aria-valuemax")).toBe("5");
  expect(meter.getAttribute("aria-valuemin")).toBe("0");
  expect(meter.innerHTML).toContain("translateX(-40%)");
});
it("opens one stock Sheet with recorded fields, checks, raw extensions and full history", async () => {
  const fixture = new Fixture();
  fixture.task.common.progress.findings = ["Native findings"];
  fixture.task.common.progress.next_steps = ["Next recorded step"];
  fixture.task.common.progress.checks = [
    {
      command: "bun run test",
      outcome: "passed",
      evidence: "Recorded check evidence",
    },
  ];
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  const activity = await screen.findByRole("button", {
    name: "Build workflow",
  });
  await userEvent.click(activity);
  const sheet = await screen.findByRole("dialog", { name: "implement" });
  await waitFor(() =>
    expect(sheet.contains(document.activeElement)).toBe(true),
  );
  expect(within(sheet).getByText("Graph completed")).toBeTruthy();
  expect(
    within(sheet).getAllByText("Development / TypescriptDev"),
  ).toHaveLength(2);
  expect(within(sheet).getByText("Team Gizmo")).toBeTruthy();
  expect(within(sheet).getByText("codex/worker")).toBeTruthy();
  expect(within(sheet).getByText("/fixture")).toBeTruthy();
  expect(within(sheet).getByText("a".repeat(40))).toBeTruthy();
  expect(within(sheet).getByText("b".repeat(40))).toBeTruthy();
  await userEvent.click(
    within(sheet).getByRole("button", { name: "Findings (1)" }),
  );
  expect(within(sheet).getByText("Native findings")).toBeTruthy();
  await userEvent.click(
    within(sheet).getByRole("button", { name: "Next steps (1)" }),
  );
  expect(within(sheet).getByText("Next recorded step")).toBeTruthy();
  await userEvent.click(
    within(sheet).getByRole("button", { name: "Acceptance (1)" }),
  );
  expect(within(sheet).getByText("Show recorded work")).toBeTruthy();
  await userEvent.click(within(sheet).getByRole("tab", { name: "Checks (1)" }));
  await userEvent.click(
    within(sheet).getByRole("button", { name: "passed · bun run test" }),
  );
  expect(within(sheet).getByText("Recorded check evidence")).toBeTruthy();
  await userEvent.click(within(sheet).getByRole("tab", { name: "Raw" }));
  const raw = within(sheet).getByText(/native-contract-v2/);
  expect(raw.textContent).toContain('"ownership"');
  expect(raw.textContent).toContain('"extensions"');
  expect(raw.textContent).toContain('"revision": 5');
  await userEvent.click(within(sheet).getByRole("tab", { name: "History" }));
  const historyPanel = within(sheet).getByRole("tabpanel", { name: "History" });
  expect(within(historyPanel).getByText(/a{40}/)).toBeTruthy();
  expect(within(historyPanel).getByText(/b{40}/)).toBeTruthy();
  const event: Event = {
    version: 1,
    kind: "checkpoint",
    actor: { team: "Development", role: "RustDev" },
    note: "Native history details",
    task: fixture.task,
  };
  const history: DesktopReply = {
    content: { kind: "History", value: { records: [event], end: "Complete" } },
    selection: {
      view: {
        kind: "History",
        query: { feature: "dashboard", task: "implement" },
      },
      page: 0,
    },
  };
  native.invoke.mockResolvedValueOnce(history);
  await userEvent.click(
    within(sheet).getByRole("button", { name: "Open full history" }),
  );
  const checkpoint = await within(sheet).findByRole("button", {
    name: /checkpoint · Development \/ RustDev · attempt 1 · revision 5/,
  });
  await userEvent.click(checkpoint);
  expect(within(sheet).getByText("Native history details")).toBeTruthy();
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
    request: {
      kind: "History",
      query: { feature: "dashboard", task: "implement" },
      page: 0,
    },
  });
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
});
it("keeps cross-task history identity consistent through loading, failure and recorded event fields", async () => {
  const first = new Fixture();
  const second = new Fixture();
  second.task.common.id = "review";
  second.task.common.objective = "Review workflow";
  second.task.common.progress.extensions = { artifact: "review-history" };
  second.contribution.milestones = [
    {
      kind: "integrated",
      actor: { team: "Delivery", role: "IntegrationAgent" },
      attempt: 1,
      revision: 5,
      at: 2000,
      note: "Review integration recorded",
    },
  ];
  first.flow.tasks.records.push(second.contribution);
  native.invoke
    .mockResolvedValue(first.featuresReply())
    .mockResolvedValueOnce(first.workflowReply());
  render(App);
  await userEvent.click(
    await screen.findByRole("button", { name: "Build workflow" }),
  );
  const initialSheet = await screen.findByRole("dialog", { name: "implement" });
  await waitFor(() =>
    expect(initialSheet.contains(document.activeElement)).toBe(true),
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  const historyTab = screen.getByRole("tab", { name: "history" });
  await waitFor(() =>
    expect(getComputedStyle(historyTab).pointerEvents).not.toBe("none"),
  );
  await userEvent.click(historyTab);
  const historyRead = Deferred.makeUnsafe<DesktopReply, DesktopFailure>();
  native.invoke.mockReturnValueOnce(
    Effect.runPromise(Deferred.await(historyRead)),
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: /integrated · review · IntegrationAgent/,
    }),
  );
  const loadingSheet = await screen.findByRole("dialog", { name: "review" });
  expect(
    within(loadingSheet).getByText("Reading recorded history…"),
  ).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "implement" })).toBeNull();
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
    request: {
      kind: "History",
      query: { feature: "dashboard", task: "review" },
      page: 0,
    },
  });
  const failure: DesktopFailure = {
    kind: "Ledger",
    message: "Review history unavailable",
  };
  Effect.runSync(Deferred.fail(historyRead, failure));
  expect(
    await within(loadingSheet).findByText("Review history unavailable"),
  ).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "review" })).toBe(loadingSheet);
  const retry = Deferred.makeUnsafe<DesktopReply>();
  native.invoke.mockReturnValueOnce(Effect.runPromise(Deferred.await(retry)));
  await userEvent.click(
    within(loadingSheet).getByRole("button", { name: "Retry" }),
  );
  expect(
    within(loadingSheet).getByText("Reading recorded history…"),
  ).toBeTruthy();
  const event: Event = {
    version: 1,
    kind: "integrated",
    actor: { team: "Delivery", role: "IntegrationAgent" },
    note: "Full review history evidence",
    task: second.task,
  };
  const reply: DesktopReply = {
    selection: {
      view: {
        kind: "History",
        query: { feature: "dashboard", task: "review" },
      },
      page: 0,
    },
    content: { kind: "History", value: { records: [event], end: "Complete" } },
  };
  Effect.runSync(Deferred.succeed(retry, reply));
  const eventButton = await within(loadingSheet).findByRole("button", {
    name: /integrated · Delivery \/ IntegrationAgent · attempt 1 · revision 5/,
  });
  await userEvent.click(eventButton);
  expect(
    within(loadingSheet).getByText("Full review history evidence"),
  ).toBeTruthy();
  const raw = within(loadingSheet).getByText(/review-history/);
  expect(raw.textContent).toContain('"id": "review"');
  expect(raw.textContent).toContain('"objective": "Review workflow"');
  expect(raw.textContent).toContain('"ownership"');
  expect(raw.textContent).toContain('"workspace"');
  expect(raw.textContent).toContain("a".repeat(40));
  expect(raw.textContent).toContain("b".repeat(40));
  expect(screen.getByRole("dialog", { name: "review" })).toBe(loadingSheet);
  expect(screen.queryByRole("dialog", { name: "implement" })).toBeNull();
});
it("renders Completed read-only evidence and queued feature assignments without fabricated Git", () => {
  const fixture = new Fixture();
  const agent: AgentId = { team: "Ai", role: "TechWriterVerifier" };
  fixture.task.workspace = { kind: "read_only" };
  fixture.task.state = { kind: "completed", agent, attempt: 1 };
  fixture.task.common.checkpoint = { kind: "unrecorded" };
  fixture.task.ownership = {
    kind: "Assigned",
    assignment: { agent, reports_to: { kind: "Host" } },
  };
  fixture.contribution.worker = { kind: "recorded", agent };
  fixture.contribution.checkpoints = [];
  fixture.contribution.integrations = [];
  fixture.flow.counts = [{ state: "completed", count: 1 }];
  render(RecordedTask, {
    task: fixture.task,
    flow: fixture.contribution,
    history: vi.fn(),
  });
  expect(screen.getByText("Completed")).toBeTruthy();
  expect(screen.getByText("Read only")).toBeTruthy();
  expect(screen.getByText("Host")).toBeTruthy();
  expect(screen.queryAllByText("Checkpoint")).toHaveLength(0);
  expect(screen.queryAllByText("Integration")).toHaveLength(0);
  expect(new FlowPresentation(fixture.flow).git().edges).toHaveLength(0);
  cleanup();
  const queuedAgent: AgentId = {
    team: "Development",
    role: "TypescriptVerifier",
  };
  fixture.task.state = { kind: "queued" };
  fixture.task.workspace = { kind: "feature" };
  fixture.task.ownership = {
    kind: "Assigned",
    assignment: {
      agent: queuedAgent,
      reports_to: { kind: "Gizmo", coordinator: "GizmoPrime" },
    },
  };
  fixture.contribution.worker = { kind: "recorded", agent: queuedAgent };
  render(RecordedTask, {
    task: fixture.task,
    flow: fixture.contribution,
    history: vi.fn(),
  });
  expect(screen.getByText("Queued")).toBeTruthy();
  expect(screen.getByText("Shared feature workspace")).toBeTruthy();
  expect(screen.getByText("Gizmo Prime")).toBeTruthy();
  expect(screen.getAllByText("Development / TypescriptVerifier")).toHaveLength(
    2,
  );
  expect(new FlowPresentation(fixture.flow).git().nodes).toHaveLength(1);
});
it("retains migrated native history worker while payload-only assignment stays unrecorded", async () => {
  const fixture = new Fixture();
  fixture.task.ownership = { kind: "Unrecorded" };
  fixture.contribution.worker = {
    kind: "recorded",
    agent: { team: "Development", role: "RustDev" },
  };
  fixture.contribution.milestones = [
    {
      kind: "claimed",
      actor: { team: "Development", role: "RustDev" },
      at: 1400,
      attempt: 1,
      revision: 2,
      note: "History worker evidence",
    },
    {
      kind: "integrated",
      actor: { team: "Delivery", role: "IntegrationAgent" },
      at: 2000,
      attempt: 1,
      revision: 5,
      note: "Recorded integration",
    },
  ];
  render(RecordedTask, {
    task: fixture.task,
    flow: fixture.contribution,
    history: vi.fn(),
  });
  expect(screen.getByText("Worker").nextElementSibling?.textContent).toBe(
    "Development / RustDev",
  );
  expect(screen.getByText("Assignment").nextElementSibling?.textContent).toBe(
    "Unrecorded",
  );
  expect(screen.getByText("Reports to").nextElementSibling?.textContent).toBe(
    "Unrecorded",
  );
  expect(screen.getByText("a".repeat(40))).toBeTruthy();
  expect(screen.getByText("b".repeat(40))).toBeTruthy();
  await userEvent.click(screen.getByRole("tab", { name: "History" }));
  expect(screen.getByText(/claimed · Development \/ RustDev/)).toBeTruthy();
  expect(
    screen.getByText(/integrated · Delivery \/ IntegrationAgent/),
  ).toBeTruthy();
  await userEvent.click(screen.getByRole("tab", { name: "Raw" }));
  expect(screen.getByText(/native-contract-v2/).textContent).toContain(
    '"role": "RustDev"',
  );
  cleanup();
  render(RecordedTask, { task: fixture.task, history: vi.fn() });
  expect(TaskPresentation.describe(fixture.task).actor).toBe("Unrecorded");
  expect(screen.queryAllByText("Worker")).toHaveLength(0);
  expect(screen.getByText("Assignment").nextElementSibling?.textContent).toBe(
    "Unrecorded",
  );
});
it("retries failed native reads and keeps feature paging/manual refresh on native requests", async () => {
  const fixture = new Fixture();
  const features = fixture.featuresReply();
  switch (features.content.kind) {
    case "Features":
      features.content.value.end = "More";
      break;
    case "Workflow":
    case "Task":
    case "History":
      break;
  }
  native.invoke
    .mockRejectedValueOnce({ kind: "Ledger", message: "Database busy" })
    .mockResolvedValue(features);
  render(App);
  await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await screen.findByRole("heading", { name: "Choose a feature" });
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
      request: { kind: "Features", page: 1 },
    }),
  );
  await screen.findByRole("heading", { name: "Choose a feature" });
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
    request: { kind: "Features", page: 1 },
  });
});
it("uses stock Collapsible and Tabs keyboard interactions and stock Sheet dismissal", async () => {
  const fixture = new Fixture();
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  const team = await screen.findByRole("button", { name: "Team Gizmo" });
  team.focus();
  await userEvent.keyboard("{Enter}");
  expect(team.getAttribute("aria-expanded")).toBe("false");
  await userEvent.keyboard(" ");
  expect(team.getAttribute("aria-expanded")).toBe("true");
  const history = screen.getByRole("tab", { name: "history" });
  await userEvent.click(history);
  await userEvent.keyboard("{Home}");
  expect(
    screen.getByRole("tab", { name: "tree" }).getAttribute("aria-selected"),
  ).toBe("true");
  await userEvent.keyboard("{End}");
  expect(history.getAttribute("aria-selected")).toBe("true");
  await userEvent.click(screen.getByRole("tab", { name: "tree" }));
  const activity = screen.getByRole("button", { name: "Build workflow" });
  await userEvent.click(activity);
  const sheet = await screen.findByRole("dialog", { name: "implement" });
  await waitFor(() =>
    expect(sheet.contains(document.activeElement)).toBe(true),
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  expect(document.activeElement).toBe(activity);
});
