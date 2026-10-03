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
import RecordedTask from "./RecordedTask.svelte";
import { Progress } from "$lib/components/ui/progress";
import { TaskPresentation } from "./task-presentation";
import { ProgressSummary } from "./progress-presentation";
import { WorkflowEvidence } from "./workflow-evidence";
import type { AgentId, DesktopFailure, DesktopReply, Event } from "./contracts";
import {
  Fixture,
  BrowserMediaQueries,
  renderedClientRects,
} from "./dashboard-fixture";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
beforeEach(() => {
  const media = new BrowserMediaQueries();
  vi.stubGlobal("matchMedia", media.matchMedia.bind(media));
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
it("navigates from the searchable sidebar and keeps the selected workflow explicit", async () => {
  const fixture = new Fixture();
  const other = new Fixture();
  other.flow.feature.id = "storage-review";
  const features = fixture.featuresReply();
  switch (features.content.kind) {
    case "Features":
      features.content.value.records.push(other.flow.feature);
      break;
    case "History":
    case "Task":
    case "Workflow":
      throw new Error("Expected features fixture");
  }
  native.invoke
    .mockResolvedValueOnce(features)
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  const navigation = await screen.findByRole("navigation", {
    name: "Workflow navigation",
  });
  await within(navigation).findByRole("button", { name: "storage-review" });
  await userEvent.type(
    screen.getByRole("textbox", { name: "Search workflows" }),
    "dashboard",
  );
  expect(
    within(navigation).queryByRole("button", { name: "storage-review" }),
  ).toBeNull();
  await userEvent.click(
    within(navigation).getByRole("button", { name: "dashboard" }),
  );
  await screen.findByRole("region", { name: "Workflow overview" });
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
    request: { kind: "Workflow", feature: "dashboard", page: 0 },
  });
  expect(
    within(navigation)
      .getByRole("button", { name: "dashboard" })
      .getAttribute("data-active"),
  ).toBe("true");
  expect(screen.queryByRole("combobox", { name: "Features" })).toBeNull();
});
it("keeps Git and activity provenance when identical commits appear in different tasks", () => {
  const first = new Fixture();
  const second = new Fixture();
  second.task.common.id = "review";
  second.contribution.history_end = "More";
  second.contribution.integrations[0]!.at = 3000;
  first.contribution.milestones = [
    {
      actor: { team: "Development", role: "TypescriptDev" },
      kind: "claimed",
      attempt: 1,
      revision: 1,
      note: "Started implementation",
      at: 1000,
    },
  ];
  second.contribution.milestones = [
    {
      actor: { team: "Development", role: "TypescriptVerifier" },
      kind: "completed",
      attempt: 2,
      revision: 7,
      note: "Review completed",
      at: 2500,
    },
  ];
  const evidence = new WorkflowEvidence([
    first.contribution,
    second.contribution,
  ]);
  expect(evidence.commits).toHaveLength(4);
  expect(evidence.commits[0]?.flow.task.common.id).toBe("review");
  expect(
    evidence.commits.filter((entry) => entry.record.commit === "b".repeat(40)),
  ).toHaveLength(2);
  expect(evidence.activity.map((entry) => entry.record.note)).toEqual([
    "Review completed",
    "Started implementation",
  ]);
  expect(evidence.partial).toBe(true);
});
it("keeps the selected workflow view visible during refresh and opens Git task details in place", async () => {
  const fixture = new Fixture();
  const late = Deferred.makeUnsafe<DesktopReply>();
  const transport = Effect.runPromise(Deferred.await(late));
  native.invoke
    .mockResolvedValueOnce(fixture.workflowReply())
    .mockResolvedValueOnce(fixture.featuresReply())
    .mockReturnValueOnce(transport);
  render(App);
  await userEvent.click(
    await screen.findByRole("tab", { name: "Commits (2)" }),
  );
  const commits = screen.getByRole("table", { name: "Workflow commits" });
  expect(within(commits).getAllByRole("row")[1]?.textContent).toContain(
    "Integration",
  );
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByRole("status");
  expect(screen.getByRole("table", { name: "Workflow commits" })).toBe(commits);
  Effect.runSync(Deferred.succeed(late, fixture.workflowReply()));
  await transport;
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  expect(
    screen
      .getByRole("tab", { name: "Commits (2)" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  await userEvent.click(
    within(commits).getAllByRole("button", { name: "implement" })[0]!,
  );
  const inspector = await screen.findByRole("dialog", { name: "implement" });
  expect(within(inspector).getByText("Graph completed")).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("table", { name: "Workflow commits" })).toBe(commits);
});
it("keeps native feature totals and Git integration evidence separate from loaded activity", () => {
  const fixture = new Fixture();
  expect(new ProgressSummary(fixture.flow.counts).total).toBe(101);
  expect(TaskPresentation.counts(fixture.flow.tasks.records)).toEqual([
    { state: "integrated", count: 1 },
  ]);
  expect(fixture.contribution.integrations[0]?.commit).toBe("b".repeat(40));
  expect(fixture.contribution.integrations[0]?.actor).toEqual({
    team: "Delivery",
    role: "IntegrationAgent",
  });
  expect(TaskPresentation.describe(fixture.task).checkpoint).toBe(
    "a".repeat(40),
  );
  expect(TaskPresentation.describe(fixture.task).integration).toBe(
    "b".repeat(40),
  );
  fixture.contribution.integrations = [];
  fixture.contribution.worker = { kind: "unrecorded" };
  fixture.task.ownership = { kind: "Unrecorded" };
  expect(fixture.contribution.integrations).toHaveLength(0);
  expect(TaskPresentation.describe(fixture.task).actor).toBe("Unrecorded");
});
it("shows full-feature quantities independently of loaded descendant progress", async () => {
  const fixture = new Fixture();
  fixture.flow.counts = [
    { state: "integrated", count: 3 },
    { state: "working", count: 1 },
    { state: "queued", count: 1 },
  ];
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  await screen.findByRole("table", {
    name: "Recorded reporting and activities",
  });
  const feature = screen.getByRole("progressbar", { name: "Feature progress" });
  expect(feature.getAttribute("aria-valuenow")).toBe("3");
  expect(feature.getAttribute("aria-valuemax")).toBe("5");
  const team = screen.getByRole("row", { name: /Team Gizmo/ });
  expect(within(team).getByText("Team · 1/1 finished")).toBeTruthy();
  expect(within(team).getByText("Reporting only")).toBeTruthy();
  expect(screen.getByText(/3\/5 finished/)).toBeTruthy();
  expect(
    screen.getByRole("columnheader", {
      name: "Progress",
    }),
  ).toBeTruthy();
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
    name: "Open task implement",
  });
  await userEvent.click(activity);
  const sheet = await screen.findByRole("dialog", { name: "implement" });
  await waitFor(() =>
    expect(sheet.contains(document.activeElement)).toBe(true),
  );
  expect(within(sheet).getByText("Graph completed")).toBeTruthy();
  const fields = within(sheet).getByRole("table", { name: "Task fields" });
  expect(
    within(fields).getByRole("row", {
      name: "Worker Development / TypescriptDev",
    }),
  ).toBeTruthy();
  expect(
    within(fields).getByRole("row", {
      name: "Assignment Development / TypescriptDev",
    }),
  ).toBeTruthy();
  expect(within(sheet).getByText("Team Gizmo")).toBeTruthy();
  const workspace = within(sheet).getByRole("row", {
    name: /Workspace detail/,
  });
  expect(workspace.textContent).toContain("codex/worker");
  expect(workspace.textContent).toContain("/fixture");
  expect(within(fields).getByText("a".repeat(40))).toBeTruthy();
  expect(within(fields).getByText("b".repeat(40))).toBeTruthy();
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
  const activity = await screen.findByRole("button", {
    name: "Open task implement",
  });
  await waitFor(() =>
    expect(getComputedStyle(activity).pointerEvents).not.toBe("none"),
  );
  await userEvent.click(activity);
  const initialSheet = await screen.findByRole("dialog", { name: "implement" });
  await waitFor(() =>
    expect(initialSheet.contains(document.activeElement)).toBe(true),
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  const expandWorker = screen.getByRole("button", {
    name: "Expand TypescriptDev",
  });
  await waitFor(() =>
    expect(getComputedStyle(expandWorker).pointerEvents).not.toBe("none"),
  );
  await userEvent.click(expandWorker);
  await userEvent.click(
    screen.getByRole("button", { name: "Open task review" }),
  );
  const secondSheet = await screen.findByRole("dialog", { name: "review" });
  await waitFor(() =>
    expect(secondSheet.contains(document.activeElement)).toBe(true),
  );
  await userEvent.click(
    within(secondSheet).getByRole("tab", { name: "History" }),
  );
  const historyRead = Deferred.makeUnsafe<DesktopReply, DesktopFailure>();
  native.invoke.mockReturnValueOnce(
    Effect.runPromise(Deferred.await(historyRead)),
  );
  await userEvent.click(
    within(secondSheet).getByRole("button", { name: "Open full history" }),
  );
  const loadingSheet = await screen.findByRole("dialog", { name: "review" });
  expect(within(loadingSheet).getByText("Reading recorded work…")).toBeTruthy();
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
  expect(within(loadingSheet).getByText("Reading recorded work…")).toBeTruthy();
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
  await userEvent.click(
    within(loadingSheet).getByRole("button", { name: "View task snapshot" }),
  );
  expect(screen.getByRole("dialog", { name: "review" })).toBe(loadingSheet);
  expect(within(loadingSheet).getByText("Review workflow")).toBeTruthy();
  const snapshot = within(loadingSheet).getByRole("table", {
    name: "Task fields",
  });
  expect(within(snapshot).queryByRole("row", { name: /^Worker/ })).toBeNull();
  expect(
    within(snapshot).getByRole("row", {
      name: "Assignment Development / TypescriptDev",
    }),
  ).toBeTruthy();
  await userEvent.click(within(loadingSheet).getByRole("tab", { name: "Raw" }));
  const snapshotRaw = within(loadingSheet).getByText(/review-history/);
  expect(snapshotRaw.textContent).toContain('"id": "review"');
  expect(snapshotRaw.textContent).not.toContain('"worker"');
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
  expect(
    within(screen.getByRole("row", { name: "Workspace Read only" })).getByText(
      "Read only",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Host")).toBeTruthy();
  expect(
    within(
      screen.getByRole("row", { name: "Checkpoint Unrecorded" }),
    ).getByText("Unrecorded"),
  ).toBeTruthy();
  expect(
    within(
      screen.getByRole("row", { name: "Integration Unrecorded" }),
    ).getByText("Unrecorded"),
  ).toBeTruthy();
  expect(screen.queryByText("a".repeat(40))).toBeNull();
  expect(screen.queryByText("b".repeat(40))).toBeNull();
  expect(fixture.contribution.integrations).toHaveLength(0);
  expect(TaskPresentation.describe(fixture.task).checkpoint).toBe("Unrecorded");
  expect(TaskPresentation.describe(fixture.task).integration).toBe(
    "Unrecorded",
  );
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
  expect(
    within(
      screen.getByRole("row", { name: "Workspace Shared feature workspace" }),
    ).getByText("Shared feature workspace"),
  ).toBeTruthy();
  expect(screen.getByText("Gizmo Prime")).toBeTruthy();
  expect(screen.getAllByText("Development / TypescriptVerifier")).toHaveLength(
    2,
  );
  expect(fixture.contribution.checkpoints).toHaveLength(0);
  expect(fixture.contribution.integrations).toHaveLength(0);
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
  expect(
    within(
      screen.getByRole("row", { name: "Worker Development / RustDev" }),
    ).getByText("Development / RustDev"),
  ).toBeTruthy();
  expect(
    within(
      screen.getByRole("row", { name: "Assignment Unrecorded" }),
    ).getByText("Unrecorded"),
  ).toBeTruthy();
  expect(
    within(
      screen.getByRole("row", { name: "Reports to Unrecorded" }),
    ).getByText("Unrecorded"),
  ).toBeTruthy();
  const fields = screen.getByRole("table", { name: "Task fields" });
  expect(within(fields).getByText("a".repeat(40))).toBeTruthy();
  expect(within(fields).getByText("b".repeat(40))).toBeTruthy();
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
  expect(
    within(
      screen.getByRole("row", { name: "Assignment Unrecorded" }),
    ).getByText("Unrecorded"),
  ).toBeTruthy();
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
  await screen.findByRole("heading", { name: "All workflows" });
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
      request: { kind: "Features", page: 1 },
    }),
  );
  await screen.findByRole("heading", { name: "All workflows" });
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
    request: { kind: "Features", page: 1 },
  });
});
it("uses library DataTable keyboard expansion and stock Sheet dismissal with focus restoration", async () => {
  const fixture = new Fixture();
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  const team = await screen.findByRole("button", {
    name: "Collapse Team Gizmo",
  });
  team.focus();
  await userEvent.keyboard("{Enter}");
  expect(team.getAttribute("aria-expanded")).toBe("false");
  expect(
    screen.queryByRole("button", { name: "Open task implement" }),
  ).toBeNull();
  await userEvent.keyboard(" ");
  expect(team.getAttribute("aria-expanded")).toBe("true");
  const worker = screen.getByRole("button", { name: "Expand TypescriptDev" });
  await userEvent.click(worker);
  const row = screen.getByRole("row", { name: /implement/ });
  const activity = within(row).getByRole("button", {
    name: "Open task implement",
  });
  await userEvent.click(activity);
  const sheet = await screen.findByRole("dialog", { name: "implement" });
  await waitFor(() =>
    expect(sheet.contains(document.activeElement)).toBe(true),
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  await waitFor(() => expect(document.activeElement).toBe(activity));
});
