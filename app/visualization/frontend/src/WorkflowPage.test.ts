import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import WorkflowPage from "./WorkflowPage.svelte";
import { Fixture } from "./dashboard-fixture";
type WorkflowProps = ComponentProps<typeof WorkflowPage>;
type RoleQueryOptions = NonNullable<Parameters<typeof screen.getByRole>[1]>;
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
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
  Reflect.deleteProperty(HTMLElement.prototype, "hidePopover");
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
it("shows a terminal timestamp without inventing an unrecorded active range", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const windowPanelQuery: RoleQueryOptions = { name: "Time windows" };
  const acceptedEventQuery: RoleQueryOptions = {
    name: /Completed · rust-release/,
  };
  const fixture = new Fixture();
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow: fixture.workflow(),
    initialTask: "",
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
    initialTask: "",
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  expect(screen.getByRole("heading", verifierHeadingQuery)).toBeTruthy();
  expect(screen.getAllByText("Assigned to Rust Dev")).toHaveLength(2);
  expect(screen.getAllByText("Reports to Host")).toHaveLength(2);
});
it("keeps same-time milestones separately reachable for zero-duration tasks", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const windowPanelQuery: RoleQueryOptions = { name: "Time windows" };
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  for (const chapter of workflow.chapters) {
    chapter.task.common.last_update = chapter.task.common.created_at;
    for (const entry of chapter.entries) {
      entry.at = chapter.task.common.created_at;
    }
  }
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    initialTask: "",
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  await fireEvent.click(screen.getByRole("tab", windowTabQuery));
  const markers = screen
    .getByRole("tabpanel", windowPanelQuery)
    .querySelectorAll(".timeline-piece");
  expect(markers).toHaveLength(1);
  expect([...markers].map((marker) => marker.getAttribute("style"))).toEqual([
    "left: 0%; width: 0%;",
  ]);
});
it("shows a truthful empty timeline", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  workflow.chapters = [];
  const workflowProps: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    initialTask: "",
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
    initialTask: "",
    back: () => {},
  };
  render(WorkflowPage, workflowProps);
  await fireEvent.click(screen.getByRole("tab", windowTabQuery));
  const acceptedEventQuery: RoleQueryOptions = {
    name: /Completed · rust-release/,
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
  for (const entry of workflow.chapters.flatMap((chapter) => chapter.entries)) {
    switch (entry.kind) {
      case "created":
        entry.kind = "claimed";
        entry.state = {
          kind: "active",
          assignment: {
            agent: Fixture.RUST,
            attempt: 1,
            expires_at: Fixture.NOW,
            phase: { kind: "working" },
          },
        };
        break;
      case "assigned":
      case "claimed":
      case "heartbeat":
      case "progress":
      case "checkpoint":
      case "ready":
      case "integrated":
      case "requeued":
      case "completed":
      case "cancelled":
        break;
    }
  }
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    initialTask: "",
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
  expect(card?.textContent).toContain("Implement the release");
  expect(card?.textContent).toContain("Recorded state · Working");
  expect(card?.textContent).toContain("Worker ID unrecorded");
  expect(card?.textContent).not.toContain("1200s");
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
  for (const entry of workflow.chapters.flatMap((chapter) => chapter.entries))
    entry.worker = {
      kind: "Recorded",
      worker_id: "11111111-1111-4111-8111-111111111111",
    };
  const props: WorkflowProps = {
    summary: fixture.summary,
    workflow,
    initialTask: "",
    back: () => {},
  };
  const tabQuery: RoleQueryOptions = { name: "Time windows" };
  const markerQuery: RoleQueryOptions = { name: /Completed · overlap-three/ };
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
    initialTask: "",
    back: () => {},
  };
  const tabQuery: RoleQueryOptions = { name: "Time windows" };
  const markerQuery: RoleQueryOptions = { name: /Completed · rust-release/ };
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
