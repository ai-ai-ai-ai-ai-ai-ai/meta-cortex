import { expect, it } from "vitest";
import { Fixture } from "./dashboard-fixture";
import { TimelineScale } from "./timeline";
import type { EventKind, FeedEntry } from "./contracts";
it("keeps dense phases bounded, omits lifecycle records and selects the final simultaneous state", () => {
  const fixture = new Fixture();
  const workflow = fixture.workflow();
  const kinds: ReadonlyArray<EventKind> = [
    "created",
    "assigned",
    "claimed",
    "heartbeat",
    "progress",
    "checkpoint",
    "ready",
    "completed",
  ];
  for (const chapter of workflow.chapters) {
    chapter.entries = kinds.map(
      (kind, index): FeedEntry => ({
        kind,
        actor: Fixture.PRIME,
        ownership: chapter.task.ownership,
        state: chapter.task.state,
        note: "",
        summary: "",
        at: chapter.task.common.created_at + Math.min(index, 6) * 1000,
        revision: index + 1,
        checkpoint: { kind: "unrecorded" },
        evidence: [],
      }),
    );
    const row = new TimelineScale(workflow).row(chapter);
    expect(row.height).toBe("28px");
    expect(row.pieces.map((piece) => piece.entry.kind)).toEqual([
      "progress",
      "checkpoint",
      "completed",
    ]);
    expect(row.pieces.map((piece) => piece.width)).toEqual([
      "0.08333333333333333%",
      "0.08333333333333333%",
      "0%",
    ]);
    expect(row.pieces.map((piece) => piece.entry.revision)).toEqual([5, 6, 8]);
  }
});
