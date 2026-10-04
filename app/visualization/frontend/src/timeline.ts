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
    legend: "Recorded event legend",
    read: "Read",
    recordedLifetime: "log; recorded lifetime",
    note: "Neutral bars show creation to last recorded update. Icons mark individual recorded events; creation, claims and heartbeats are neutral. Gaps and overlapping lifetimes do not measure execution duration or idle time. Select an event or lifetime to read its task log.",
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
interface TimelineMarker {
  readonly entry: FeedEntry;
  readonly left: string;
  readonly top: string;
}
export class TimelineRow {
  readonly markers: ReadonlyArray<TimelineMarker>;
  readonly height: string;
  constructor(request: TimelineRowRequest) {
    const lanes: number[] = [];
    const markers: TimelineMarker[] = [];
    for (const entry of request.chapter.entries) {
      const position = parseFloat(request.scale.position(entry.at));
      let lane = lanes.findIndex((previous) => position - previous >= 5);
      switch (lane) {
        case -1:
          lane = lanes.length;
          break;
        default:
          break;
      }
      lanes[lane] = position;
      const marker: TimelineMarker = {
        entry,
        left: request.scale.position(entry.at),
        top: `${lane * 28 + 4}px`,
      };
      markers.push(marker);
    }
    this.markers = markers;
    this.height = `${Math.max(66, lanes.length * 28 + 30)}px`;
  }
}
