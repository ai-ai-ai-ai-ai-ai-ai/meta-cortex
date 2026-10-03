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
import Workflow from "./Workflow.svelte";
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
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
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
  expect(evidence.changes).toHaveLength(2);
  expect(evidence.changes.map((change) => change.events.length)).toEqual([
    2, 2,
  ]);
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
it("keeps the overview compact and passes complete evidence through keyboard selection", async () => {
  const fixture = new Fixture();
  fixture.flow.counts = [{ state: "integrated", count: 1 }];
  fixture.flow.tasks.end = "Complete";
  fixture.contribution.integrations[0]!.commit = "a".repeat(40);
  fixture.task.common.progress.findings = ["Built an expandable agent tree"];
  fixture.task.common.progress.checks = [
    { command: "bun run test", outcome: "passed", evidence: "42 tests pass" },
  ];
  const select = vi.fn();
  render(Workflow, { flow: fixture.flow, select });
  await userEvent.click(
    screen.getByRole("button", { name: "Browse contributions by status" }),
  );
  const contribution = screen.getByRole("article", {
    name: "Contribution implement",
  });
  expect(within(contribution).getByText("TypescriptDev")).toBeTruthy();
  expect(within(contribution).getByText("Graph completed")).toBeTruthy();
  expect(within(contribution).getByText("1 passed")).toBeTruthy();
  expect(within(contribution).getByText("1 commit")).toBeTruthy();
  expect(
    within(contribution).queryByText("Built an expandable agent tree"),
  ).toBeNull();
  expect(within(contribution).queryByText("Show recorded work")).toBeNull();
  expect(within(contribution).queryByText("42 tests pass")).toBeNull();
  expect(within(contribution).getAllByRole("button")).toHaveLength(1);
  within(contribution)
    .getByRole("button", { name: "Open task implement" })
    .focus();
  await userEvent.keyboard("{Enter}");
  expect(select).toHaveBeenCalledWith(fixture.contribution);
});
it("prioritizes blocked work without treating queued or cancelled work as achievements", async () => {
  const finished = new Fixture();
  const blocked = new Fixture();
  blocked.task.common.id = "blocked-task";
  blocked.task.state = {
    kind: "active",
    assignment: {
      agent: { team: "Development", role: "RustDev" },
      attempt: 1,
      expires_at: 5000,
      phase: { kind: "blocked", reason: "Waiting for the storage contract" },
    },
  };
  const queued = new Fixture();
  queued.task.common.id = "queued-task";
  queued.task.state = { kind: "queued" };
  const cancelled = new Fixture();
  cancelled.task.common.id = "cancelled-task";
  cancelled.task.state = { kind: "cancelled", reason: "Superseded scope" };
  finished.flow.tasks.records.push(
    cancelled.contribution,
    queued.contribution,
    blocked.contribution,
  );
  render(Workflow, { flow: finished.flow, select: vi.fn() });
  await userEvent.click(
    screen.getByRole("button", { name: "Browse contributions by status" }),
  );
  expect(
    screen
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label")),
  ).toEqual([
    "Contribution blocked-task",
    "Contribution queued-task",
    "Contribution implement",
    "Contribution cancelled-task",
  ]);
  const attention = screen.getByRole("region", { name: "Needs attention" });
  expect(
    within(attention).getByText("Waiting for the storage contract"),
  ).toBeTruthy();
  expect(
    within(
      screen.getByRole("region", { name: "What was achieved" }),
    ).getAllByRole("article"),
  ).toHaveLength(1);
  expect(screen.getByText(/This page contains 4 of 101 tasks/)).toBeTruthy();
});
it("keeps full requirements, findings and check output in the selected main-area task page", async () => {
  const fixture = new Fixture();
  fixture.task.common.acceptance = [
    "First criterion",
    "Second criterion",
    "Third criterion",
  ];
  fixture.task.common.progress.findings = [
    "First finding",
    "Second finding",
    "Third finding",
  ];
  fixture.task.common.progress.next_steps = ["Integrate and publish"];
  fixture.task.common.progress.checks = [
    {
      command: "cargo test",
      outcome: "failed",
      evidence: "Recorded failure output",
    },
  ];
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Browse contributions by status",
    }),
  );
  await screen.findByText("1 failed");
  expect(screen.queryByText("Third criterion")).toBeNull();
  expect(screen.queryByText("Third finding")).toBeNull();
  expect(screen.queryByText("Integrate and publish")).toBeNull();
  await userEvent.click(
    screen.getAllByRole("button", { name: "Open task implement" })[0]!,
  );
  const inspector = await screen.findByRole("region", { name: "implement" });
  await userEvent.click(
    within(inspector).getByRole("button", { name: "Acceptance (3)" }),
  );
  expect(within(inspector).getByText("Third criterion")).toBeTruthy();
  await userEvent.click(
    within(inspector).getByRole("button", { name: "Findings (3)" }),
  );
  expect(within(inspector).getByText("Third finding")).toBeTruthy();
  await userEvent.click(
    within(inspector).getByRole("button", { name: "Next steps (1)" }),
  );
  expect(within(inspector).getByText("Integrate and publish")).toBeTruthy();
  await userEvent.click(
    within(inspector).getByRole("tab", { name: "Checks (1)" }),
  );
  await userEvent.click(
    within(inspector).getByRole("button", { name: "failed · cargo test" }),
  );
  expect(within(inspector).getByText("Recorded failure output")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: "Back to workflow" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Back to workflow" }),
    ).toBeNull(),
  );
  await waitFor(() =>
    expect(document.body.style.pointerEvents).not.toBe("none"),
  );
});
it("expands only the requested contribution section in a large workflow", async () => {
  const fixture = new Fixture();
  const finished = Array.from({ length: 4 }, (_, index) => {
    const item = new Fixture();
    item.task.common.id = `finished-${index}`;
    return item.contribution;
  });
  const queued = Array.from({ length: 4 }, (_, index) => {
    const item = new Fixture();
    item.task.common.id = `queued-${index}`;
    item.task.state = { kind: "queued" };
    return item.contribution;
  });
  fixture.flow.tasks.records = [...finished, ...queued];
  render(Workflow, { flow: fixture.flow, select: vi.fn() });
  await userEvent.click(
    screen.getByRole("button", { name: "Browse contributions by status" }),
  );
  const achieved = screen.getByRole("region", { name: "What was achieved" });
  const upcoming = screen.getByRole("region", { name: "Up next" });
  expect(within(achieved).getAllByRole("article")).toHaveLength(3);
  expect(within(upcoming).getAllByRole("article")).toHaveLength(3);
  await userEvent.click(
    within(achieved).getByRole("button", { name: /Show more/ }),
  );
  expect(within(achieved).getAllByRole("article")).toHaveLength(4);
  expect(within(upcoming).getAllByRole("article")).toHaveLength(3);
});
it("finds a historical worker and keeps missing commit evidence explicit", async () => {
  const fixture = new Fixture();
  const other = new Fixture();
  other.task.common.id = "review";
  fixture.task.ownership = { kind: "Unrecorded" };
  fixture.contribution.worker = {
    kind: "recorded",
    agent: { team: "Development", role: "RustDev" },
  };
  fixture.contribution.checkpoints = [];
  fixture.contribution.integrations = [];
  fixture.contribution.history_end = "More";
  fixture.flow.tasks.records.push(other.contribution);
  render(Workflow, { flow: fixture.flow, select: vi.fn() });
  await userEvent.click(
    screen.getByRole("button", { name: "Browse contributions by status" }),
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: "Find a contribution" }),
    "RustDev",
  );
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText("0 commits (recent)")).toBeTruthy();
  expect(screen.queryAllByText("aaaaaaaa")).toHaveLength(0);
});
it("keeps contribution rows during refresh and returns focus after inspecting a task", async () => {
  const fixture = new Fixture();
  const late = Deferred.makeUnsafe<DesktopReply>();
  const transport = Effect.runPromise(Deferred.await(late));
  native.invoke
    .mockResolvedValueOnce(fixture.workflowReply())
    .mockResolvedValueOnce(fixture.featuresReply())
    .mockReturnValueOnce(transport);
  render(App);
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Browse contributions by status",
    }),
  );
  const contribution = await screen.findByRole("article", {
    name: "Contribution implement",
  });
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByRole("status");
  expect(screen.getByRole("article", { name: "Contribution implement" })).toBe(
    contribution,
  );
  Effect.runSync(Deferred.succeed(late, fixture.workflowReply()));
  await transport;
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  const row = within(contribution).getByRole("button", {
    name: "Open task implement",
  });
  await userEvent.click(row);
  const inspector = await screen.findByRole("region", { name: "implement" });
  expect(within(inspector).getByText("Graph completed")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: "Back to workflow" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Back to workflow" }),
    ).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(row));
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
it("opens a full-width task page with recorded fields, checks, raw extensions and full history", async () => {
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
  const page = await screen.findByRole("region", { name: "implement" });
  await waitFor(() => expect(page.contains(document.activeElement)).toBe(true));
  expect(within(page).getByText("Graph completed")).toBeTruthy();
  const fields = within(page).getByRole("table", { name: "Task fields" });
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
  expect(within(page).getByText("Team Gizmo")).toBeTruthy();
  const workspace = within(page).getByRole("row", {
    name: /Workspace detail/,
  });
  expect(workspace.textContent).toContain("codex/worker");
  expect(workspace.textContent).toContain("/fixture");
  expect(within(fields).getByText("a".repeat(40))).toBeTruthy();
  expect(within(fields).getByText("b".repeat(40))).toBeTruthy();
  await userEvent.click(
    within(page).getByRole("button", { name: "Findings (1)" }),
  );
  expect(within(page).getByText("Native findings")).toBeTruthy();
  await userEvent.click(
    within(page).getByRole("button", { name: "Next steps (1)" }),
  );
  expect(within(page).getByText("Next recorded step")).toBeTruthy();
  await userEvent.click(
    within(page).getByRole("button", { name: "Acceptance (1)" }),
  );
  expect(within(page).getByText("Show recorded work")).toBeTruthy();
  await userEvent.click(within(page).getByRole("tab", { name: "Checks (1)" }));
  await userEvent.click(
    within(page).getByRole("button", { name: "passed · bun run test" }),
  );
  expect(within(page).getByText("Recorded check evidence")).toBeTruthy();
  await userEvent.click(within(page).getByRole("tab", { name: "Raw" }));
  const raw = within(page).getByText(/native-contract-v2/);
  expect(raw.textContent).toContain('"ownership"');
  expect(raw.textContent).toContain('"extensions"');
  expect(raw.textContent).toContain('"revision": 5');
  await userEvent.click(within(page).getByRole("tab", { name: "History" }));
  const historyPanel = within(page).getByRole("tabpanel", { name: "History" });
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
    within(page).getByRole("button", { name: "Open full history" }),
  );
  const checkpoint = await within(page).findByRole("button", {
    name: /checkpoint · Development \/ RustDev · attempt 1 · revision 5/,
  });
  await userEvent.click(checkpoint);
  expect(within(page).getByText("Native history details")).toBeTruthy();
  expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
    request: {
      kind: "History",
      query: { feature: "dashboard", task: "implement" },
      page: 0,
    },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Back to workflow" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Back to workflow" }),
    ).toBeNull(),
  );
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
  const initialPage = await screen.findByRole("region", { name: "implement" });
  await waitFor(() =>
    expect(initialPage.contains(document.activeElement)).toBe(true),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Back to workflow" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Back to workflow" }),
    ).toBeNull(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Expand TypescriptDev" }),
  );
  const review = screen.getByRole("button", {
    name: "Open task review",
  });
  await waitFor(() =>
    expect(getComputedStyle(review).pointerEvents).not.toBe("none"),
  );
  await userEvent.click(review);
  const secondPage = await screen.findByRole("region", { name: "review" });
  await waitFor(() =>
    expect(secondPage.contains(document.activeElement)).toBe(true),
  );
  await userEvent.click(
    within(secondPage).getByRole("tab", { name: "History" }),
  );
  const historyRead = Deferred.makeUnsafe<DesktopReply, DesktopFailure>();
  native.invoke.mockReturnValueOnce(
    Effect.runPromise(Deferred.await(historyRead)),
  );
  await userEvent.click(
    within(secondPage).getByRole("button", { name: "Open full history" }),
  );
  const loadingPage = await screen.findByRole("region", { name: "review" });
  expect(within(loadingPage).getByText("Reading recorded work…")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "implement" })).toBeNull();
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
    await within(loadingPage).findByText("Review history unavailable"),
  ).toBeTruthy();
  expect(screen.getByRole("region", { name: "review" })).toBe(loadingPage);
  const retry = Deferred.makeUnsafe<DesktopReply>();
  native.invoke.mockReturnValueOnce(Effect.runPromise(Deferred.await(retry)));
  await userEvent.click(
    within(loadingPage).getByRole("button", { name: "Retry" }),
  );
  expect(within(loadingPage).getByText("Reading recorded work…")).toBeTruthy();
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
  const eventButton = await within(loadingPage).findByRole("button", {
    name: /integrated · Delivery \/ IntegrationAgent · attempt 1 · revision 5/,
  });
  await userEvent.click(eventButton);
  expect(
    within(loadingPage).getByText("Full review history evidence"),
  ).toBeTruthy();
  const raw = within(loadingPage).getByText(/review-history/);
  expect(raw.textContent).toContain('"id": "review"');
  expect(raw.textContent).toContain('"objective": "Review workflow"');
  expect(raw.textContent).toContain('"ownership"');
  expect(raw.textContent).toContain('"workspace"');
  expect(raw.textContent).toContain("a".repeat(40));
  expect(raw.textContent).toContain("b".repeat(40));
  expect(screen.getByRole("region", { name: "review" })).toBe(loadingPage);
  expect(screen.queryByRole("region", { name: "implement" })).toBeNull();
  await userEvent.click(
    within(loadingPage).getByRole("button", { name: "View task snapshot" }),
  );
  expect(screen.getByRole("region", { name: "review" })).toBe(loadingPage);
  expect(within(loadingPage).getByText("Review workflow")).toBeTruthy();
  const snapshot = within(loadingPage).getByRole("table", {
    name: "Task fields",
  });
  expect(within(snapshot).queryByRole("row", { name: /^Worker/ })).toBeNull();
  expect(
    within(snapshot).getByRole("row", {
      name: "Assignment Development / TypescriptDev",
    }),
  ).toBeTruthy();
  await userEvent.click(within(loadingPage).getByRole("tab", { name: "Raw" }));
  const snapshotRaw = within(loadingPage).getByText(/review-history/);
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
it("uses library DataTable keyboard expansion and main-area Back navigation with focus restoration", async () => {
  const fixture = new Fixture();
  const other = new Fixture();
  other.task.common.id = "review";
  fixture.flow.tasks.records.push(other.contribution);
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Browse contributions by status",
    }),
  );
  const filter = await screen.findByRole("textbox", {
    name: "Find a contribution",
  });
  await userEvent.type(filter, "implement");
  const table = screen.getByRole("table", {
    name: "Recorded reporting and activities",
  });
  const team = await screen.findByRole("button", {
    name: "Collapse Team Gizmo",
  });
  team.focus();
  await userEvent.keyboard("{Enter}");
  expect(team.getAttribute("aria-expanded")).toBe("false");
  expect(
    within(table).queryByRole("button", { name: "Open task implement" }),
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
  const page = await screen.findByRole("region", { name: "implement" });
  expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  expect(
    screen.queryAllByRole("region", { name: "Workflow overview" }),
  ).toHaveLength(0);
  expect(
    screen.getByRole("navigation", { name: "Workflow navigation" }),
  ).toBeTruthy();
  await waitFor(() => expect(page.contains(document.activeElement)).toBe(true));
  await userEvent.click(
    screen.getByRole("button", { name: "Back to workflow" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Back to workflow" }),
    ).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(activity));
  expect(screen.getByRole("textbox", { name: "Find a contribution" })).toBe(
    filter,
  );
  expect(filter).toHaveProperty("value", "implement");
  expect(team.getAttribute("aria-expanded")).toBe("true");
  expect(worker.getAttribute("aria-expanded")).toBe("true");
});
it.each(["Task", "History"] as const)(
  "opens a native %s target in the main area and returns to its workflow",
  async (kind) => {
    const fixture = new Fixture();
    const query = { feature: "dashboard", task: "implement" };
    const initial: DesktopReply = fixture.taskReply();
    switch (kind) {
      case "Task":
        break;
      case "History":
        initial.selection.view = { kind, query };
        initial.content = { kind, value: { records: [], end: "Complete" } };
        break;
    }
    native.invoke
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(fixture.featuresReply())
      .mockResolvedValue(fixture.workflowReply());
    render(App);
    const page = await screen.findByRole("region", { name: "implement" });
    expect(page.closest("main")).toBeTruthy();
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
    await userEvent.click(
      within(page).getByRole("button", { name: "Back to workflow" }),
    );
    expect(
      await screen.findByRole("region", { name: "Workflow overview" }),
    ).toBeTruthy();
    expect(screen.queryAllByRole("region", { name: "implement" })).toHaveLength(
      0,
    );
    expect(native.invoke).toHaveBeenLastCalledWith("dashboard_read", {
      request: { kind: "Workflow", feature: "dashboard", page: 0 },
    });
  },
);
it("allows sidebar navigation during a history read and ignores the old reply", async () => {
  const fixture = new Fixture();
  native.invoke
    .mockResolvedValue(fixture.featuresReply())
    .mockResolvedValueOnce(fixture.workflowReply());
  render(App);
  await userEvent.click(
    await screen.findByRole("button", { name: "Open task implement" }),
  );
  await userEvent.click(screen.getByRole("tab", { name: "History" }));
  const read = Deferred.makeUnsafe<DesktopReply>();
  native.invoke.mockReturnValueOnce(Effect.runPromise(Deferred.await(read)));
  await userEvent.click(
    screen.getByRole("button", { name: "Open full history" }),
  );
  expect(await screen.findByRole("status")).toHaveProperty(
    "textContent",
    "Reading recorded work…",
  );
  await userEvent.click(screen.getByRole("button", { name: "All workflows" }));
  expect(
    await screen.findByRole("heading", { name: "All workflows" }),
  ).toBeTruthy();
  Effect.runSync(Deferred.succeed(read, fixture.taskReply()));
  await waitFor(() =>
    expect(screen.queryAllByRole("region", { name: "implement" })).toHaveLength(
      0,
    ),
  );
  expect(screen.getByRole("heading", { name: "All workflows" })).toBeTruthy();
});
