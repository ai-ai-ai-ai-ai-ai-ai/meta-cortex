import { expect, it } from "vitest";
import { Fixture } from "./dashboard-fixture";
import { TimelineScale } from "./timeline";
import { Elapsed } from "./observability";
import type { EventKind, FeedEntry, TaskState, TaskChapter } from "./contracts";
interface StateRecord {
  readonly at: number;
  readonly kind: EventKind;
  readonly state: TaskState;
}
class TimelineFixture {
  constructor(readonly chapter: TaskChapter) {
    chapter.entries = [];
  }
  record(record: StateRecord): void {
    const entry: FeedEntry = {
      ...record,
      actor: Fixture.RUST,
      worker: this.chapter.task.worker,
      ownership: this.chapter.task.ownership,
      revision: this.chapter.entries.length + 1,
      summary: "",
      checkpoint: { kind: "unrecorded" },
      evidence: [],
      note: "Waiting for review; this text must not override recorded Working",
    };
    this.chapter.entries.push(entry);
    this.chapter.task.common.last_update = record.at;
  }
  working(attempt: number): TaskState {
    return {
      kind: "active",
      assignment: {
        agent: Fixture.RUST,
        attempt,
        expires_at: 999999,
        phase: { kind: "working" },
      },
    };
  }
}
it("starts at recorded claim, retains Working despite waiting prose, and leaves requeue gaps empty", () => {
  const workflow = new Fixture().workflow();
  for (const chapter of workflow.chapters) {
    const fixture = new TimelineFixture(chapter);
    const records: ReadonlyArray<StateRecord> = [
      { at: 0, kind: "created", state: { kind: "queued" } },
      { at: 100, kind: "claimed", state: fixture.working(1) },
      { at: 200, kind: "heartbeat", state: fixture.working(1) },
      { at: 300, kind: "checkpoint", state: fixture.working(1) },
      { at: 400, kind: "requeued", state: { kind: "queued" } },
      { at: 600, kind: "claimed", state: fixture.working(2) },
      {
        at: 800,
        kind: "ready",
        state: { kind: "ready", agent: Fixture.RUST, attempt: 2 },
      },
      {
        at: 900,
        kind: "completed",
        state: { kind: "completed", agent: Fixture.RUST, attempt: 2 },
      },
    ];
    for (const record of records) fixture.record(record);
    const row = new TimelineScale(workflow).row(fixture.chapter);
    expect(row.pieces.map((piece) => piece.entry.at)).toEqual([
      100, 600, 800, 900,
    ]);
    expect(row.pieces.map((piece) => piece.end)).toEqual([400, 800, 900, 900]);
    expect(row.height).toBe("36px");
  }
});
it("renders recorded Blocked, Ready, Integrated and terminal states without deriving them from event kind", () => {
  const workflow = new Fixture().workflow();
  for (const chapter of workflow.chapters) {
    const fixture = new TimelineFixture(chapter);
    const records: ReadonlyArray<StateRecord> = [
      { at: 100, kind: "claimed", state: fixture.working(1) },
      {
        at: 200,
        kind: "progress",
        state: {
          kind: "active",
          assignment: {
            agent: Fixture.RUST,
            attempt: 1,
            expires_at: 999999,
            phase: {
              kind: "blocked",
              reason: "Waiting for verified checkpoint",
            },
          },
        },
      },
      {
        at: 400,
        kind: "heartbeat",
        state: {
          kind: "active",
          assignment: {
            agent: Fixture.RUST,
            attempt: 1,
            expires_at: 9999999,
            phase: {
              kind: "blocked",
              reason: "Waiting for verified checkpoint",
            },
          },
        },
      },
      {
        at: 500,
        kind: "ready",
        state: { kind: "ready", agent: Fixture.RUST, attempt: 1 },
      },
      {
        at: 600,
        kind: "integrated",
        state: { kind: "integrated", commit: "a".repeat(40) },
      },
      {
        at: 700,
        kind: "cancelled",
        state: { kind: "cancelled", reason: "Superseded" },
      },
      {
        at: 800,
        kind: "progress",
        state: { kind: "cancelled", reason: "Superseded" },
      },
    ];
    for (const record of records) fixture.record(record);
    const row = new TimelineScale(workflow).row(chapter);
    expect(row.pieces.map((piece) => piece.look.label())).toEqual([
      "Working",
      "Blocked",
      "Ready",
      "Integrated",
      "Cancelled",
    ]);
    expect(row.pieces.map((piece) => piece.end)).toEqual([
      200, 500, 600, 700, 700,
    ]);
    expect(row.pieces.map((piece) => piece.look.detail())).toContain(
      "Waiting for verified checkpoint",
    );
    expect(row.pieces.map((piece) => piece.width())).toEqual([
      "14.285714285714286%",
      "42.857142857142854%",
      "14.285714285714286%",
      "14.285714285714286%",
      "0%",
    ]);
  }
});
it("leaves unclaimed tasks empty and keeps only the final state at simultaneous timestamps", () => {
  const workflow = new Fixture().workflow();
  for (const chapter of workflow.chapters) {
    const fixture = new TimelineFixture(chapter);
    const queued: StateRecord = {
      at: 0,
      kind: "created",
      state: { kind: "queued" },
    };
    fixture.record(queued);
    expect(new TimelineScale(workflow).row(chapter).pieces).toHaveLength(0);
    const records: ReadonlyArray<StateRecord> = [
      { at: 100, kind: "claimed", state: fixture.working(1) },
      {
        at: 100,
        kind: "ready",
        state: { kind: "ready", agent: Fixture.RUST, attempt: 1 },
      },
      {
        at: 100,
        kind: "completed",
        state: { kind: "completed", agent: Fixture.RUST, attempt: 1 },
      },
    ];
    for (const record of records) fixture.record(record);
    const row = new TimelineScale(workflow).row(chapter);
    expect(row.pieces.map((piece) => piece.entry.revision)).toEqual([4]);
    expect(row.pieces.map((piece) => piece.end)).toEqual([100]);
  }
});
it("orders both timeline and index chapters by first recorded active state with unclaimed tasks last", () => {
  const workflow = new Fixture().workflow();
  for (const original of workflow.chapters) {
    const late: TaskChapter = structuredClone(original);
    const early: TaskChapter = structuredClone(original);
    const queued: TaskChapter = structuredClone(original);
    late.task.common.id = "late";
    early.task.common.id = "early";
    queued.task.common.id = "queued";
    const lateFixture = new TimelineFixture(late);
    const earlyFixture = new TimelineFixture(early);
    const queuedFixture = new TimelineFixture(queued);
    const lateClaim: StateRecord = {
      at: 600,
      kind: "claimed",
      state: lateFixture.working(1),
    };
    const earlyClaim: StateRecord = {
      at: 100,
      kind: "claimed",
      state: earlyFixture.working(1),
    };
    const creation: StateRecord = {
      at: 0,
      kind: "created",
      state: { kind: "queued" },
    };
    lateFixture.record(lateClaim);
    earlyFixture.record(earlyClaim);
    queuedFixture.record(creation);
    workflow.chapters = [queued, late, early];
    expect(
      new TimelineScale(workflow)
        .chapters()
        .map((chapter) => chapter.task.common.id),
    ).toEqual(["early", "late", "queued"]);
  }
});

it("puts compact elapsed durations in timeline boxes while retaining precise duration evidence", () => {
  expect(new Elapsed(11 * 60000).compact()).toBe("11m");
  expect(new Elapsed(27 * 60000).compact()).toBe("27m");
  expect(new Elapsed(2 * 60000).compact()).toBe("2m");
  expect(new Elapsed(12450).compact()).toBe("12s");
  expect(new Elapsed(12450).exact()).toBe("12.45s");
});

it("keeps coalesced progress within its historical state and excludes later completion summaries", () => {
  const workflow = new Fixture().workflow();
  for (const chapter of workflow.chapters) {
    const fixture = new TimelineFixture(chapter);
    const records: ReadonlyArray<StateRecord> = [
      { at: 100, kind: "claimed", state: fixture.working(1) },
      { at: 200, kind: "progress", state: fixture.working(1) },
      {
        at: 300,
        kind: "completed",
        state: { kind: "completed", agent: Fixture.RUST, attempt: 1 },
      },
    ];
    for (const record of records) fixture.record(record);
    const summaries = [
      "Starting implementation",
      "Implementation in progress",
      "All work accepted",
    ];
    chapter.entries.forEach((entry, index) => {
      entry.summary = summaries[index] ?? "";
    });
    const pieces = new TimelineScale(workflow).row(chapter).pieces;
    expect(pieces.map((piece) => piece.summary())).toEqual([
      "Implementation in progress",
      "All work accepted",
    ]);
    expect(pieces.map((piece) => piece.look.label())).toEqual([
      "Working",
      "Completed",
    ]);
    expect(pieces.map((piece) => [piece.entry.at, piece.end])).toEqual([
      [100, 300],
      [300, 300],
    ]);
  }
});
