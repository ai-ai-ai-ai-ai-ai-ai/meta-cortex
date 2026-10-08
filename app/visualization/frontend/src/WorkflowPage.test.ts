import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/svelte";
import type { RevisionLogEntry } from "./contracts";
import type { ComponentProps } from "svelte";
import WorkflowPage from "./WorkflowPage.svelte";
import { Fixture } from "./dashboard-fixture";
import { RecordedTime, WorkflowOpeningKind } from "./observability";
type WorkflowProps = ComponentProps<typeof WorkflowPage>;
type RoleQueryOptions = NonNullable<Parameters<typeof screen.getByRole>[1]>;
type TextQueryOptions = NonNullable<Parameters<typeof screen.getByText>[1]>;
beforeEach(() => {
  const show: PropertyDescriptor = {
    configurable: true,
    value(this: HTMLElement) {
      this.setAttribute("data-open", "true");
    },
  };
  const hide: PropertyDescriptor = {
    configurable: true,
    value(this: HTMLElement) {
      this.removeAttribute("data-open");
    },
  };
  Object.defineProperty(HTMLElement.prototype, "showPopover", show);
  Object.defineProperty(HTMLElement.prototype, "hidePopover", hide);
  const scroll: PropertyDescriptor = { configurable: true, value: () => {} };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scroll);
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
  Reflect.deleteProperty(HTMLElement.prototype, "hidePopover");
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
it("opens the feature's Feature log by default and retains it across workflow refresh", async () => {
  const fixture = new Fixture();
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow: fixture.workflow(),
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  const featureQuery: RoleQueryOptions = { name: "Feature log" };
  const rendered = render(WorkflowPage, props);
  expect(
    screen.getByRole("tab", featureQuery).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByRole("tabpanel", featureQuery)).toBeTruthy();
  const refreshed: WorkflowProps = { ...props, workflow: fixture.workflow() };
  await rendered.rerender(refreshed);
  expect(
    screen.getByRole("tab", featureQuery).getAttribute("aria-selected"),
  ).toBe("true");
});

it("opens an explicit task in Log with keyboard focus and scroll", () => {
  const fixture = new Fixture();
  const scroll = vi.fn();
  const boundary: PropertyDescriptor = { configurable: true, value: scroll };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", boundary);
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow: fixture.workflow(),
    opening: { kind: WorkflowOpeningKind.Task, task: "rust-release" },
    back: () => {},
  };
  const logQuery: RoleQueryOptions = { name: "Log" };
  render(WorkflowPage, props);
  expect(screen.getByRole("tab", logQuery).getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(document.activeElement?.id).toBe("heading-rust-release");
  expect(scroll).toHaveBeenCalled();
});
it("opens an outcome's original task Log with focus and scroll, keeping Feature log reachable", async () => {
  const fixture = new Fixture();
  const scroll = vi.fn();
  const boundary: PropertyDescriptor = { configurable: true, value: scroll };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", boundary);
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow: fixture.workflow(),
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  render(WorkflowPage, props);
  const featureQuery: RoleQueryOptions = { name: "Feature log" };
  const taskQuery: RoleQueryOptions = {
    name: "Open Log for task rust-release",
  };
  const panel = screen.getByRole("tabpanel", featureQuery);
  expect(within(panel).getAllByRole("button", taskQuery)).toHaveLength(2);
  for (const button of within(panel)
    .getAllByRole("button", taskQuery)
    .slice(0, 1)) {
    await fireEvent.click(button);
  }
  const logQuery: RoleQueryOptions = { name: "Log" };
  expect(screen.getByRole("tab", logQuery).getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(document.activeElement?.id).toBe("heading-rust-release");
  expect(scroll).toHaveBeenCalled();
  await fireEvent.click(screen.getByRole("tab", featureQuery));
  expect(
    screen.getByRole("tabpanel", featureQuery).querySelectorAll("article"),
  ).toHaveLength(2);
});
it("opens checkpoint and integration evidence at their exact Log revisions", async () => {
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  const scroll = vi.fn();
  const boundary: PropertyDescriptor = { configurable: true, value: scroll };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", boundary);
  render(WorkflowPage, props);
  const featureQuery: RoleQueryOptions = { name: "Feature log" };
  const logQuery: RoleQueryOptions = { name: "Log" };
  for (const entry of workflow.feature_log.slice(0, 1)) {
    const shortQuery: RoleQueryOptions = {
      name: `Open checkpoint evidence for task ${entry.task}, revision ${entry.checkpoint.recorded.revision}`,
    };
    for (const button of screen.getAllByRole("button", shortQuery).slice(0, 1))
      await fireEvent.click(button);
    const checkpoint = document.getElementById(
      `event-${entry.task}-r${entry.checkpoint.recorded.revision}`,
    );
    await waitFor(() => expect(checkpoint?.hasAttribute("open")).toBe(true));
    expect(document.activeElement).toBe(checkpoint?.querySelector("summary"));
    expect(
      screen.getByRole("tab", logQuery).getAttribute("aria-selected"),
    ).toBe("true");
    await fireEvent.click(screen.getByRole("tab", featureQuery));
    const evidenceQuery: TextQueryOptions = { selector: "summary span" };
    for (const row of screen
      .getByRole("tabpanel", featureQuery)
      .querySelectorAll("article"))
      await fireEvent.click(within(row).getByText("Evidence", evidenceQuery));
    const integrationQuery: RoleQueryOptions = {
      name: `Integration evidence · r${entry.integration.recorded.revision}`,
    };
    for (const button of screen
      .getAllByRole("button", integrationQuery)
      .slice(0, 1))
      await fireEvent.click(button);
    const integration = document.getElementById(
      `event-${entry.task}-r${entry.integration.recorded.revision}`,
    );
    await waitFor(() => expect(integration?.hasAttribute("open")).toBe(true));
    expect(document.activeElement).toBe(integration?.querySelector("summary"));
    expect(integration?.getAttribute("id")).not.toBe(
      checkpoint?.getAttribute("id"),
    );
  }
  expect(scroll).toHaveBeenCalled();
});
it("shows a missing-outcomes log without inferring rows from integrated task history", async () => {
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  workflow.feature_log = [];
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  render(WorkflowPage, props);
  expect(screen.getByText("No implementation outcomes recorded")).toBeTruthy();
  const featureQuery: RoleQueryOptions = { name: "Feature log" };
  expect(
    screen.getByRole("tabpanel", featureQuery).querySelectorAll("article"),
  ).toHaveLength(0);
  const logQuery: RoleQueryOptions = { name: "Log" };
  await fireEvent.click(screen.getByRole("tab", logQuery));
  expect(screen.getAllByText("Checkpoint recorded")).toHaveLength(2);
});
it("shows a terminal timestamp without inventing an unrecorded active range", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const windowPanelQuery: RoleQueryOptions = { name: "Time windows" };
  const acceptedEventQuery: RoleQueryOptions = {
    name: /Integrated · rust-release/,
  };
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  for (const group of workflow.timeline.groups) {
    group.windows = group.windows.filter(
      (window) => window.status === "integrated",
    );
    for (const window of group.windows)
      workflow.timeline.extent = {
        kind: "Recorded",
        started: window.start,
        finished: window.end,
      };
  }
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  await fireEvent.click(screen.getByRole("tab", windowTabQuery));
  const panel = screen.getByRole("tabpanel", windowPanelQuery);
  expect(panel.querySelectorAll(".time-axis time")).toHaveLength(1);
  const inlineTimes = panel.querySelectorAll(".task-bounds time");
  expect(inlineTimes).toHaveLength(0);
  for (const time of inlineTimes) {
    expect(time.getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  }
  expect(within(panel).getByRole("button", acceptedEventQuery)).toBeTruthy();
  expect(panel.textContent).toContain(
    "Recorded task states, aligned to their actual timestamps.",
  );
});
it("preserves per-event ownership after a chapter is reassigned", () => {
  const verifierHeadingQuery: RoleQueryOptions = { name: "Rust Verifier" };
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  for (const chapter of workflow.chapters) {
    chapter.task.ownership = {
      kind: "Assigned",
      assignment: {
        agent: Fixture.VERIFIER,
        reports_to: { kind: "Gizmo", coordinator: "Gizmo" },
      },
    };
    chapter.role = { kind: "Recorded", agent: Fixture.VERIFIER };
    for (const entry of chapter.entries) {
      entry.ownership = {
        kind: "Assigned",
        assignment: { agent: Fixture.RUST, reports_to: { kind: "Host" } },
      };
    }
  }
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Task, task: "rust-release" },
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  expect(screen.getByRole("heading", verifierHeadingQuery)).toBeTruthy();
  expect(screen.getAllByText("Assigned to Rust Dev")).toHaveLength(7);
  expect(screen.getAllByText("Reports to Host")).toHaveLength(7);
});
it("keeps same-time milestones separately reachable for zero-duration tasks", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const windowPanelQuery: RoleQueryOptions = { name: "Time windows" };
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  workflow.timeline.extent = {
    kind: "Recorded",
    started: Fixture.NOW,
    finished: Fixture.NOW,
  };
  for (const window of workflow.timeline.groups.flatMap(
    (group) => group.windows,
  )) {
    window.start = Fixture.NOW;
    window.end = Fixture.NOW;
    window.duration_ms = 0;
  }
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  await fireEvent.click(screen.getByRole("tab", windowTabQuery));
  const markers = screen
    .getByRole("tabpanel", windowPanelQuery)
    .querySelectorAll(".timeline-piece");
  expect(markers).toHaveLength(3);
  expect([...markers].map((marker) => marker.getAttribute("style"))).toEqual([
    "left: 0%; width: 0%;",
    "left: 0%; width: 0%;",
    "left: 0%; width: 0%;",
  ]);
});
it("shows a truthful empty timeline", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  workflow.chapters = [];
  workflow.timeline = {
    extent: { kind: "Empty" },
    groups: [],
    chapter_order: [],
  };
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  await fireEvent.click(screen.getByRole("tab", windowTabQuery));
  expect(
    screen.getByText("No recorded task lifetimes or events."),
  ).toBeTruthy();
});
it("preserves keyboard focus when a timeline event opens its task log", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const developerHeadingQuery: RoleQueryOptions = { name: "Rust Dev" };
  const scrollBoundary: PropertyDescriptor = {
    configurable: true,
    value: () => {},
  };
  Object.defineProperty(
    HTMLElement.prototype,
    "scrollIntoView",
    scrollBoundary,
  );
  const fixture = new Fixture();
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow: fixture.workflow(),
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  await fireEvent.click(screen.getByRole("tab", windowTabQuery));
  const acceptedEventQuery: RoleQueryOptions = {
    name: /Integrated · rust-release/,
  };
  const marker = screen.getByRole("button", acceptedEventQuery);
  marker.focus();
  await fireEvent.click(marker);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", developerHeadingQuery),
  );
});
it("labels recorded boxes with elapsed duration and presents human task context on focus", async () => {
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  for (const group of workflow.timeline.groups)
    group.windows = group.windows.slice(0, 1);
  for (const window of workflow.timeline.groups.flatMap(
    (group) => group.windows,
  )) {
    window.status = "working";
    window.state = {
      kind: "active",
      assignment: {
        agent: Fixture.RUST,
        attempt: 1,
        expires_at: Fixture.NOW,
        phase: { kind: "working" },
      },
    };
    window.objective = "Historical projected objective";
    window.summary = "Historical projected progress";
    window.start = fixture.ago(150);
    window.end = fixture.ago(130);
    window.duration_ms = 20 * Fixture.MINUTE;
  }
  for (const chapter of workflow.chapters) {
    chapter.task.common.objective =
      "Later task objective must not replace card";
    chapter.task.common.progress.summary =
      "Later completion must not replace card";
  }
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  const tabQuery: RoleQueryOptions = { name: "Time windows" };
  const stateQuery: RoleQueryOptions = { name: /Working · rust-release/ };
  render(WorkflowPage, props);
  await fireEvent.click(screen.getByRole("tab", tabQuery));
  const box = screen.getByRole("button", stateQuery);
  expect(box.textContent).toBe("20m");
  expect(box.hasAttribute("title")).toBe(false);
  await fireEvent.focus(box);
  const card = document.getElementById(
    box.getAttribute("aria-describedby") ?? "",
  );
  expect(card?.getAttribute("data-open")).toBe("true");
  expect(card?.textContent).toContain("Historical projected objective");
  expect(card?.textContent).toContain("Historical projected progress");
  expect(card?.textContent).not.toContain("Later completion");
  expect(card?.textContent).not.toContain("Later task objective");
  expect(card?.textContent).toContain("Recorded state · Working");
  expect(card?.textContent).toMatch(/Worker …[a-f\d]{8}/);
  expect(card?.textContent).not.toContain("1200s");
  const timing = card?.querySelector(".task-card-times");
  expect(
    Array.from(
      timing?.querySelectorAll("dt") ?? [],
      (term) => term.textContent,
    ),
  ).toEqual(["Started", "Ended", "Total"]);
  expect(
    Array.from(
      timing?.querySelectorAll("dd") ?? [],
      (value) => value.textContent,
    ),
  ).toEqual([
    new RecordedTime(fixture.ago(150)).clock(),
    new RecordedTime(fixture.ago(130)).clock(),
    "20 min",
  ]);
  expect(timing?.textContent).not.toContain(RecordedTime.ZONE_LABEL);
});
it("keeps overlapping worker tasks reachable in bounded keyboard lanes and opens the selected original task", async () => {
  const scrollBoundary: PropertyDescriptor = {
    configurable: true,
    value: () => {},
  };
  Object.defineProperty(
    HTMLElement.prototype,
    "scrollIntoView",
    scrollBoundary,
  );
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  const chapters = workflow.chapters.slice();
  workflow.chapters = [];
  for (const original of chapters) {
    for (const task of [
      "overlap-one",
      "overlap-two",
      "overlap-three",
      "overlap-four",
    ]) {
      const chapter = structuredClone(original);
      chapter.task.common.id = task;
      workflow.chapters.push(chapter);
    }
  }
  workflow.timeline.chapter_order = workflow.chapters.map(
    (chapter) => chapter.task.common.id,
  );
  for (const group of workflow.timeline.groups) {
    group.identity = {
      kind: "RecordedWorker",
      worker_id: "11111111-1111-4111-8111-111111111111",
    };
    group.tasks = workflow.timeline.chapter_order;
    const templates = group.windows.slice(0, 1);
    group.windows = [];
    for (const template of templates) {
      group.windows = group.tasks.map((task) => ({
        ...template,
        task,
        worker: {
          kind: "Recorded",
          worker_id: "11111111-1111-4111-8111-111111111111",
        },
      }));
    }
  }
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  const tabQuery: RoleQueryOptions = { name: "Time windows" };
  const markerQuery: RoleQueryOptions = { name: /Working · overlap-three/ };
  render(WorkflowPage, props);
  await fireEvent.click(screen.getByRole("tab", tabQuery));
  const lanes = document.querySelectorAll(".worker-lanes");
  expect(lanes).toHaveLength(1);
  for (const lane of lanes) {
    expect(lane.getAttribute("style")).toBe("height: 72px;");
    expect(lane.querySelectorAll(".duration-track")).toHaveLength(4);
    expect(lane.querySelectorAll(".timeline-piece")).toHaveLength(4);
  }
  expect(
    document.querySelectorAll(
      'summary small[aria-label="11111111-1111-4111-8111-111111111111"]',
    ),
  ).toHaveLength(2);
  await fireEvent.click(screen.getByRole("button", markerQuery));
  expect(document.activeElement?.id).toBe("heading-overlap-three");
});

it("keeps a focused trigger card open after pointer leave until focus also leaves", async () => {
  vi.useFakeTimers();
  const fixture = new Fixture();
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow: fixture.workflow(),
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  const tabQuery: RoleQueryOptions = { name: "Time windows" };
  const markerQuery: RoleQueryOptions = { name: /Integrated · rust-release/ };
  render(WorkflowPage, props);
  await fireEvent.click(screen.getByRole("tab", tabQuery));
  const marker = screen.getByRole("button", markerQuery);
  marker.focus();
  await fireEvent.pointerLeave(marker);
  await vi.advanceTimersByTimeAsync(200);
  const card = document.getElementById(
    marker.getAttribute("aria-describedby") ?? "",
  );
  expect(card?.getAttribute("data-open")).toBe("true");
  marker.blur();
  await vi.advanceTimersByTimeAsync(200);
  expect(card?.hasAttribute("data-open")).toBe(false);
  vi.useRealTimers();
});

it("renders supplied feature revisions without sorting or renumbering and retains selection on refresh", async () => {
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  const records: RevisionLogEntry[] = [];
  for (const record of workflow.revision_log.slice(0, 1)) {
    const committed: RevisionLogEntry = {
      ...record,
      sequence: 90,
      provenance: "CommittedAppend",
      entry: { ...record.entry, revision: 7, note: "First supplied record" },
    };
    const legacy: RevisionLogEntry = {
      ...record,
      sequence: 41,
      provenance: "LegacyStorageOrder",
      entry: { ...record.entry, revision: 2, note: "Second supplied record" },
    };
    records.push(committed, legacy);
  }
  workflow.revision_log = records;
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    opening: { kind: WorkflowOpeningKind.Feature },
    back: () => {},
  };
  const tabQuery: RoleQueryOptions = { name: "Revision log" };
  const panelQuery: RoleQueryOptions = { name: "Revision log" };
  const rendered = render(WorkflowPage, props);
  await fireEvent.click(screen.getByRole("tab", tabQuery));
  const panel = screen.getByRole("tabpanel", panelQuery);
  expect(
    [...panel.querySelectorAll("article")].map((article) =>
      article.getAttribute("aria-label"),
    ),
  ).toEqual(["Feature R90", "Feature R41"]);
  expect(panel.textContent).toContain("Task r7");
  expect(panel.textContent).toContain("Task r2");
  expect(panel.textContent).toContain("Legacy storage order");
  expect(panel.textContent).toContain("Committed append");
  const refreshed: WorkflowProps = {
    ...props,
    workflow: structuredClone(workflow),
  };
  await rendered.rerender(refreshed);
  expect(screen.getByRole("tab", tabQuery).getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(
    screen.getByRole("tabpanel", panelQuery).querySelectorAll("article"),
  ).toHaveLength(2);
});
it("supports arrow and boundary keys for workflow tabs and opens the original revision task", async () => {
  const scrollBoundary: PropertyDescriptor = {
    configurable: true,
    value: () => {},
  };
  Object.defineProperty(
    HTMLElement.prototype,
    "scrollIntoView",
    scrollBoundary,
  );
  const fixture = new Fixture();
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow: fixture.workflow(),
    opening: { kind: WorkflowOpeningKind.Task, task: "rust-release" },
    back: () => {},
  };
  const logQuery: RoleQueryOptions = { name: "Log" };
  const featureQuery: RoleQueryOptions = { name: "Feature log" };
  const revisionQuery: RoleQueryOptions = { name: "Revision log" };
  const openQuery: RoleQueryOptions = { name: "Open task log" };
  const endKey: KeyboardEventInit = { key: "End" };
  const homeKey: KeyboardEventInit = { key: "Home" };
  const previousKey: KeyboardEventInit = { key: "ArrowLeft" };
  render(WorkflowPage, props);
  const log = screen.getByRole("tab", logQuery);
  log.focus();
  await fireEvent.keyDown(log, endKey);
  const revisions = screen.getByRole("tab", revisionQuery);
  expect(document.activeElement).toBe(revisions);
  expect(revisions.getAttribute("tabindex")).toBe("0");
  await fireEvent.keyDown(revisions, homeKey);
  const featureLog = screen.getByRole("tab", featureQuery);
  expect(document.activeElement).toBe(featureLog);
  expect(featureLog.getAttribute("aria-selected")).toBe("true");
  await fireEvent.keyDown(featureLog, previousKey);
  expect(document.activeElement).toBe(revisions);
  const panel = screen.getByRole("tabpanel", revisionQuery);
  for (const button of within(panel)
    .getAllByRole("button", openQuery)
    .slice(0, 1))
    await fireEvent.click(button);
  expect(document.activeElement?.id).toBe("heading-rust-release");
});
