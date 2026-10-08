import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import FeedCard from "./FeedCard.svelte";
import { Fixture } from "./dashboard-fixture";
import { ActionLook } from "./observability";
import type { ComponentProps } from "svelte";
import type { FeedEntry, TaskOwnership } from "./contracts";
type FeedProps = ComponentProps<typeof FeedCard>;
afterEach(cleanup);
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
