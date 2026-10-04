import { expect, it } from "vitest";
import { Fixture } from "./dashboard-fixture";
import { WorkerTimeline } from "./worker-timeline";

it("packs supplied overlapping windows into separate visual lanes without changing their times", () => {
  const workflow = new Fixture().workflow();
  for (const group of workflow.timeline.groups) {
    const templates = group.windows.slice(0, 1);
    group.windows = [];
    for (const template of templates) {
      group.windows = ["one", "two", "three", "four"].map((task) => ({
        ...template,
        task,
        start: 100,
        end: 300,
        duration_ms: 200,
      }));
    }
  }
  for (const row of new WorkerTimeline(workflow).rows()) {
    expect(row.lanes()).toHaveLength(4);
    expect(row.pieces.map((piece) => [piece.window.start, piece.end])).toEqual([
      [100, 300],
      [100, 300],
      [100, 300],
      [100, 300],
    ]);
  }
});
