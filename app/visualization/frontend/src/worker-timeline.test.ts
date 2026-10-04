import { expect, it } from "vitest";
import type {
  FeedEntry,
  FeatureWorkflow,
  TaskChapter,
  WorkerIdentity,
} from "./contracts";
import { Fixture } from "./dashboard-fixture";
import { WorkerTimeline } from "./worker-timeline";

interface WindowRequest {
  readonly task: string;
  readonly worker: WorkerIdentity;
  readonly start: number;
  readonly end: number;
}
class WorkerFixture {
  static readonly FIRST: WorkerIdentity = {
    kind: "Recorded",
    worker_id: "11111111-1111-4111-8111-111111111111",
  };
  static readonly SECOND: WorkerIdentity = {
    kind: "Recorded",
    worker_id: "22222222-2222-4222-8222-222222222222",
  };
  readonly workflow: FeatureWorkflow = new Fixture().workflow();
  readonly original: TaskChapter;
  constructor() {
    this.original = this.template();
    this.workflow.chapters = [];
  }
  private template(): TaskChapter {
    for (const chapter of this.workflow.chapters)
      return structuredClone(chapter);
    throw new Error("Worker fixture requires a task chapter");
  }
  window(request: WindowRequest): TaskChapter {
    const chapter = structuredClone(this.original);
    chapter.task.common.id = request.task;
    chapter.task.common.last_update = request.end;
    const entry: FeedEntry = {
      objective: "Historical test task",
      ...chapter.entries[0],
      at: request.start,
      worker: request.worker,
      actor: Fixture.RUST,
      ownership: chapter.task.ownership,
      revision: 1,
      kind: "claimed",
      summary: "Synthetic worker identity regression",
      checkpoint: { kind: "unrecorded" },
      evidence: [],
      note: "",
      state: {
        kind: "active",
        assignment: {
          agent: Fixture.RUST,
          attempt: 1,
          expires_at: request.end + 100,
          phase: { kind: "working" },
        },
      },
    };
    chapter.entries = [
      entry,
      {
        ...entry,
        revision: 2,
        at: request.end,
        kind: "requeued",
        state: { kind: "queued" },
      },
    ];
    this.workflow.chapters.push(chapter);
    return chapter;
  }
}
it("groups resumes and tasks by worker UUID, keeps same-role workers distinct and preserves true gaps and original task selection", () => {
  const fixture = new WorkerFixture();
  const firstWindow: WindowRequest = {
    task: "first",
    worker: WorkerFixture.FIRST,
    start: 100,
    end: 200,
  };
  fixture.window(firstWindow);
  const resumedWindow: WindowRequest = {
    task: "resumed",
    worker: WorkerFixture.FIRST,
    start: 400,
    end: 500,
  };
  fixture.window(resumedWindow);
  const separateWindow: WindowRequest = {
    task: "separate",
    worker: WorkerFixture.SECOND,
    start: 150,
    end: 350,
  };
  fixture.window(separateWindow);
  const rows = new WorkerTimeline(fixture.workflow).rows();
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.look.detail())).toEqual([
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ]);
  expect(
    rows[0]?.pieces.map((piece) => [
      piece.chapter.task.common.id,
      piece.entry.at,
      piece.end,
    ]),
  ).toEqual([
    ["first", 100, 200],
    ["resumed", 400, 500],
  ]);
  expect(rows[0]?.lanes()).toHaveLength(1);
});
it("splits reassigned same-state history at the recorded identity boundary", () => {
  const fixture = new WorkerFixture();
  const reassignment: WindowRequest = {
    task: "reassigned",
    worker: WorkerFixture.FIRST,
    start: 100,
    end: 400,
  };
  const chapter = fixture.window(reassignment);
  for (const entry of chapter.entries.slice(0, 1)) {
    const reassignedEntry: FeedEntry = {
      ...entry,
      worker: WorkerFixture.SECOND,
      at: 250,
      revision: 3,
    };
    chapter.entries.splice(1, 0, reassignedEntry);
  }
  const rows = new WorkerTimeline(fixture.workflow).rows();
  const windows = [];
  for (const row of rows)
    windows.push(
      row.pieces.map((piece) => [
        piece.entry.at,
        piece.end,
        piece.chapter.task.common.id,
      ]),
    );
  expect(windows).toEqual([
    [[100, 250, "reassigned"]],
    [[250, 400, "reassigned"]],
  ]);
});
it("retains every overlapping task lane and separates explicit legacy role histories from recorded workers", () => {
  const fixture = new WorkerFixture();
  for (const task of ["one", "two", "three", "four"]) {
    const overlapWindow: WindowRequest = {
      task,
      worker: WorkerFixture.FIRST,
      start: 100,
      end: 300,
    };
    fixture.window(overlapWindow);
  }
  const legacyWindow: WindowRequest = {
    task: "legacy",
    worker: { kind: "Unrecorded" },
    start: 120,
    end: 250,
  };
  fixture.window(legacyWindow);
  const rows = new WorkerTimeline(fixture.workflow).rows();
  expect(rows).toHaveLength(2);
  expect(rows[0]?.lanes()).toHaveLength(4);
  expect(rows[0]?.chapters()).toHaveLength(4);
  expect(rows[1]?.look.title()).toBe("Rust Dev history");
  expect(rows[1]?.look.detail()).toBe("Worker ID unrecorded");
});
