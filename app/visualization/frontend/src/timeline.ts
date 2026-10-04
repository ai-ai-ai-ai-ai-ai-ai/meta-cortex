import type {
  FeatureWorkflow,
  TaskChapter,
  FeedEntry,
  EventKind,
} from "./contracts";
import { ActionLook, RecordedTime, WorkflowView } from "./observability";
enum MilestoneTone {
  Neutral = "neutral",
  Assignment = "assignment",
  Progress = "progress",
  Checkpoint = "checkpoint",
  Ready = "ready",
  Integrated = "integrated",
  Completed = "completed",
  Requeued = "requeued",
  Cancelled = "cancelled",
}
export class TimelineScale {
  static readonly TEXT = {
    title: WorkflowView.Windows,
    description:
      "Recorded task lifetimes and events, including parallel records.",
    scrollRegion: "Recorded timeline; scroll horizontally for time guides",
    created: "Created",
    lastUpdate: "Last update",
    to: "to",
    legend: "Recorded event legend",
    read: "Read",
    recordedLifetime: "log; recorded lifetime",
    note: "Colored pieces connect meaningful recorded events to the next meaningful record. Terminal marks end at their recorded time. These recorded phases do not measure continuous execution or idle time. Creation, assignment, claim and heartbeat records remain in the Log.",
  };
  row(chapter: TaskChapter): TimelineRow {
    const request: TimelineRowRequest = { chapter, scale: this };
    return new TimelineRow(request);
  }
  static readonly FRACTIONS = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];
  constructor(readonly workflow: FeatureWorkflow) {}
  first(): number {
    return Math.min(
      ...this.workflow.chapters.map(
        (chapter) => chapter.task.common.created_at,
      ),
    );
  }
  last(): number {
    return Math.max(
      ...this.workflow.chapters.map(
        (chapter) => chapter.task.common.last_update,
      ),
    );
  }
  ticks(): ReadonlyArray<RecordedTime> {
    switch (this.last() - this.first()) {
      case 0:
        return [new RecordedTime(this.first())];
      default:
        break;
    }
    return TimelineScale.FRACTIONS.map(
      (fraction) =>
        new RecordedTime(
          this.first() + fraction * (this.last() - this.first()),
        ),
    );
  }
  position(at: number): string {
    return `${Math.min(100, Math.max(0, (100 * (at - this.first())) / Math.max(1, this.last() - this.first())))}%`;
  }
}
export class MilestoneLook {
  static readonly PHASES: ReadonlyArray<EventKind> = [
    "progress",
    "checkpoint",
    "ready",
    "integrated",
    "requeued",
    "completed",
    "cancelled",
  ];
  static readonly TONES: Record<EventKind, MilestoneTone> = {
    created: MilestoneTone.Neutral,
    assigned: MilestoneTone.Assignment,
    claimed: MilestoneTone.Neutral,
    heartbeat: MilestoneTone.Neutral,
    progress: MilestoneTone.Progress,
    checkpoint: MilestoneTone.Checkpoint,
    ready: MilestoneTone.Ready,
    integrated: MilestoneTone.Integrated,
    completed: MilestoneTone.Completed,
    requeued: MilestoneTone.Requeued,
    cancelled: MilestoneTone.Cancelled,
  };
  constructor(readonly entry: FeedEntry) {}
  tone(): MilestoneTone {
    return MilestoneLook.TONES[this.entry.kind];
  }
  label(task: TaskChapter): string {
    return `${new ActionLook(this.entry).label()} · ${task.task.common.id} · ${new RecordedTime(this.entry.at).full()} · ${ActionLook.TEXT.revision} ${this.entry.revision}`;
  }
}
interface TimelineRowRequest {
  readonly chapter: TaskChapter;
  readonly scale: TimelineScale;
}
interface TimelinePiece {
  readonly entry: FeedEntry;
  readonly left: string;
  readonly width: string;
  readonly end: number;
}
export class TimelineRow {
  readonly pieces: ReadonlyArray<TimelinePiece>;
  readonly height = "28px";
  constructor(request: TimelineRowRequest) {
    const meaningful = request.chapter.entries.filter((entry) => {
      switch (entry.kind) {
        case "created":
        case "assigned":
        case "claimed":
        case "heartbeat":
          return false;
        case "progress":
        case "checkpoint":
        case "ready":
        case "integrated":
        case "completed":
        case "requeued":
        case "cancelled":
          return true;
      }
    });
    const phases = meaningful.filter((entry, index) =>
      meaningful.slice(index + 1).every((later) => later.at !== entry.at),
    );
    const pieces: TimelinePiece[] = [];
    for (const [index, entry] of phases.entries()) {
      let end = entry.at;
      for (const next of phases.slice(index + 1, index + 2)) end = next.at;
      switch (entry.kind) {
        case "completed":
        case "cancelled":
          end = entry.at;
          break;
        case "created":
        case "assigned":
        case "claimed":
        case "heartbeat":
        case "progress":
        case "checkpoint":
        case "ready":
        case "integrated":
        case "requeued":
          break;
      }
      const piece: TimelinePiece = {
        entry,
        end,
        left: request.scale.position(entry.at),
        width: `${(100 * (end - entry.at)) / Math.max(1, request.scale.last() - request.scale.first())}%`,
      };
      pieces.push(piece);
    }
    this.pieces = pieces;
  }
}
