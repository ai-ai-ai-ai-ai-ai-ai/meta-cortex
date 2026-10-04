import { afterEach, expect, it } from "vitest";
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
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
it("shows readable tick guides, visible task bounds and recorded milestones", async () => {
  const windowTabQuery: RoleQueryOptions = { name: "Time windows" };
  const windowPanelQuery: RoleQueryOptions = { name: "Time windows" };
  const createdEventQuery: RoleQueryOptions = {
    name: /Task created · rust-release/,
  };
  const acceptedEventQuery: RoleQueryOptions = {
    name: /Activity accepted · rust-release/,
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
  expect(panel.querySelectorAll(".time-axis time")).toHaveLength(7);
  const inlineTimes = panel.querySelectorAll(
    ".duration-bar .inline-task-bounds time",
  );
  expect(inlineTimes).toHaveLength(2);
  for (const time of inlineTimes) {
    expect(time.getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  }
  expect(within(panel).getAllByText("Created")).toHaveLength(2);
  expect(within(panel).getAllByText("Last update")).toHaveLength(2);
  expect(within(panel).getByRole("button", createdEventQuery)).toBeTruthy();
  expect(within(panel).getByRole("button", acceptedEventQuery)).toBeTruthy();
  expect(panel.textContent).toContain("Recorded task lifetimes and events");
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
    .querySelectorAll(".timeline-milestone");
  expect(markers).toHaveLength(2);
  const expectedPositions: ReadonlyArray<string> = [
    "left: 0%; top: 4px;",
    "left: 0%; top: 32px;",
  ];
  expect([...markers].map((marker) => marker.getAttribute("style"))).toEqual(
    expectedPositions,
  );
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
  const createdEventQuery: RoleQueryOptions = {
    name: /Task created · rust-release/,
  };
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
  const marker = screen.getByRole("button", createdEventQuery);
  marker.focus();
  await fireEvent.click(marker);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", developerHeadingQuery),
  );
});
