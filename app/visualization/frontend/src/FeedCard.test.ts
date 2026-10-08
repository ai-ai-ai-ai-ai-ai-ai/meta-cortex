import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import FeedCard from "./FeedCard.svelte";
import { Fixture } from "./dashboard-fixture";
import { ActionLook, RecordedEventNavigation } from "./observability";
import type { ComponentProps } from "svelte";
import type { FeedEntry, TaskOwnership } from "./contracts";
import type { EvidenceSelection } from "./feature-log";
type FeedProps = ComponentProps<typeof FeedCard>;
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
class FeedScenario {
  verifyIcon(container: HTMLElement): void {
    const icons = container.querySelectorAll(".event-icon svg");
    expect(icons).toHaveLength(1);
    for (const icon of icons) {
      expect(icon.getAttribute("stroke")).toBe("currentColor");
      expect(icon.getAttribute("width")).toBe("16");
      expect(icon.children.length).toBeGreaterThan(0);
    }
  }

  entry(ownership: TaskOwnership): FeedEntry {
    return {
      objective: "Historical task",
      actor: Fixture.PRIME,
      worker: { kind: "Unrecorded" },
      ownership,
      kind: "assigned",
      state: { kind: "queued" },
      at: Fixture.NOW,
      revision: 1,
      note: "Task assigned",
      summary: "",
      checkpoint: { kind: "unrecorded" },
      evidence: [],
      outcomes: [],
    };
  }
}
it("keeps the historical assignment and reporting line distinct from the recording actor", () => {
  const ownership: TaskOwnership = {
    kind: "Assigned",
    assignment: {
      agent: Fixture.RUST,
      reports_to: { kind: "Gizmo", coordinator: "Gizmo" },
    },
  };
  const entry = new FeedScenario().entry(ownership);
  const feedProps: FeedProps = { entry, task: "implementation" };
  render(FeedCard, feedProps);
  expect(screen.getByText("Recorded by Gizmo Prime")).toBeTruthy();
  expect(screen.getByText("Assigned to Rust Dev")).toBeTruthy();
  expect(screen.getByText("Reports to Team Gizmo")).toBeTruthy();
  expect(screen.getByText("implementation")).toBeTruthy();
});
it("labels historical missing ownership without deriving a recipient from the actor", () => {
  const ownership: TaskOwnership = { kind: "Unrecorded" };
  const feedProps: FeedProps = {
    entry: new FeedScenario().entry(ownership),
    task: "old-record",
  };
  render(FeedCard, feedProps);
  expect(screen.getByText("Assigned to Unrecorded")).toBeTruthy();
  expect(screen.getByText("Reports to Unrecorded")).toBeTruthy();
});
it("gives exact task revisions stable event anchors and opens their recorded evidence", () => {
  const ownership: TaskOwnership = { kind: "Unrecorded" };
  const entry = new FeedScenario().entry(ownership);
  const first: FeedProps = { entry, task: "first-task" };
  const second: FeedProps = { entry, task: "second-task" };
  render(FeedCard, first);
  render(FeedCard, second);
  const target: EvidenceSelection = {
    task: "second-task",
    revision: entry.revision,
  };
  const navigation = new RecordedEventNavigation(target);
  const scroll = vi.fn();
  const boundary: PropertyDescriptor = { configurable: true, value: scroll };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", boundary);
  navigation.open();
  expect(
    document.getElementById("event-first-task-r1")?.hasAttribute("open"),
  ).toBe(false);
  expect(document.getElementById(navigation.id())?.hasAttribute("open")).toBe(
    true,
  );
  expect(document.activeElement).toBe(
    document.getElementById(navigation.id())?.querySelector("summary"),
  );
  expect(scroll).toHaveBeenCalled();
});
it("renders a nonempty stroked Lucide icon for every typed event kind", () => {
  for (const appearance of Object.values(ActionLook.LOOKS)) {
    const ownership: TaskOwnership = { kind: "Unrecorded" };
    const entry = new FeedScenario().entry(ownership);
    const feedProps: FeedProps = {
      entry: { ...entry, kind: appearance.kind },
      task: "icon-test",
    };
    const rendered = render(FeedCard, feedProps);
    new FeedScenario().verifyIcon(rendered.container);
    cleanup();
  }
});
