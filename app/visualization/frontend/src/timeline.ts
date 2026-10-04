import type {
  FeatureWorkflow,
  TaskChapter,
  FeedEntry,
  TaskState,
  Phase,
} from "./contracts";
import { ActionLook, RecordedTime, WorkflowView } from "./observability";
enum StateTone {
  Queued = "queued",
  Working = "working",
  Blocked = "blocked",
  Ready = "ready",
  Integrated = "integrated",
  Completed = "completed",
  Cancelled = "cancelled",
}
enum StateContinuation {
  SameState = "same-state",
  NewState = "new-state",
}
export class TimelineScale {
  static readonly TEXT = {
    title: WorkflowView.Windows,
    description: "Recorded task states, aligned to their actual timestamps.",
    scrollRegion: "Recorded state timeline",
    firstActive: "First active",
    lastRecorded: "Last recorded",
    noActive: "No recorded active state",
    to: "to",
    legend: "Recorded state legend",
    note: "Color shows the recorded task state from a claim or update through the next state or last evidence. Queued intervals stay empty. A recorded claim is caller-supplied ledger evidence, not a measured execution start or proof of a host agent launch. Notes, checkpoints and recording actors remain in the Log.",
  };
  static readonly FRACTIONS = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];
  constructor(readonly workflow: FeatureWorkflow) {}
  row(chapter: TaskChapter): TimelineRow {
    const request: TimelineRowRequest = { chapter, scale: this };
    return new TimelineRow(request);
  }
  chapters(): ReadonlyArray<TaskChapter> {
    return this.workflow.chapters
      .slice()
      .sort((left, right) => this.activeOrder(left) - this.activeOrder(right));
  }
  private activeOrder(chapter: TaskChapter): number {
    return Math.min(
      ...chapter.entries
        .filter((entry) => entry.state.kind === "active")
        .map((entry) => entry.at),
      this.last() + 1,
    );
  }
  first(): number {
    const recorded = this.workflow.chapters.flatMap((chapter) =>
      chapter.entries.filter((entry) => entry.state.kind !== "queued"),
    );
    switch (recorded.length) {
      case 0:
        return this.last();
      default:
        return Math.min(...recorded.map((entry) => entry.at));
    }
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
        return TimelineScale.FRACTIONS.map(
          (fraction) =>
            new RecordedTime(
              this.first() + fraction * (this.last() - this.first()),
            ),
        );
    }
  }
  position(at: number): string {
    return `${Math.min(100, Math.max(0, (100 * (at - this.first())) / Math.max(1, this.last() - this.first())))}%`;
  }
  width(duration: number): string {
    return `${(100 * duration) / Math.max(1, this.last() - this.first())}%`;
  }
}
export class RecordedStateLook {
  static readonly LEGEND = [
    StateTone.Working,
    StateTone.Blocked,
    StateTone.Ready,
    StateTone.Integrated,
    StateTone.Completed,
    StateTone.Cancelled,
  ];
  static readonly LABELS: Record<StateTone, string> = {
    queued: "Queued",
    working: "Working",
    blocked: "Blocked",
    ready: "Ready",
    integrated: "Integrated",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  constructor(readonly state: TaskState) {}
  tone(): StateTone {
    switch (this.state.kind) {
      case "queued":
        return StateTone.Queued;
      case "active":
        return this.activeTone(this.state.assignment.phase);
      case "ready":
        return StateTone.Ready;
      case "integrated":
        return StateTone.Integrated;
      case "completed":
        return StateTone.Completed;
      case "cancelled":
        return StateTone.Cancelled;
    }
  }
  private activeTone(phase: Phase): StateTone {
    switch (phase.kind) {
      case "working":
        return StateTone.Working;
      case "blocked":
        return StateTone.Blocked;
    }
  }
  label(): string {
    return RecordedStateLook.LABELS[this.tone()];
  }
  detail(): string {
    switch (this.state.kind) {
      case "active":
        return this.activeDetail(this.state.assignment.phase);
      case "cancelled":
        return this.state.reason;
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
        return "";
    }
  }
  private activeDetail(phase: Phase): string {
    switch (phase.kind) {
      case "working":
        return "";
      case "blocked":
        return phase.reason;
    }
  }
  continuation(state: TaskState): StateContinuation {
    switch (this.key() === new RecordedStateLook(state).key()) {
      case true:
        return StateContinuation.SameState;
      case false:
        return StateContinuation.NewState;
    }
  }
  private key(): string {
    switch (this.state.kind) {
      case "active":
        return `${this.tone()}/${this.state.assignment.agent.team}/${this.state.assignment.agent.role}/${this.state.assignment.attempt}/${this.detail()}`;
      case "ready":
      case "completed":
        return `${this.state.kind}/${this.state.agent.team}/${this.state.agent.role}/${this.state.attempt}`;
      case "queued":
      case "integrated":
      case "cancelled":
        return `${this.state.kind}/${this.detail()}`;
    }
  }
}
interface TimelineRowRequest {
  readonly chapter: TaskChapter;
  readonly scale: TimelineScale;
}
interface TimelinePieceRequest {
  readonly entry: FeedEntry;
  readonly scale: TimelineScale;
}
class TimelinePiece {
  readonly entry: FeedEntry;
  readonly look: RecordedStateLook;
  readonly left: string;
  end: number;
  constructor(private readonly request: TimelinePieceRequest) {
    this.entry = request.entry;
    this.look = new RecordedStateLook(this.entry.state);
    this.left = request.scale.position(this.entry.at);
    this.end = this.entry.at;
  }
  extend(at: number): void {
    switch (this.entry.state.kind) {
      case "completed":
      case "cancelled":
        break;
      case "queued":
      case "active":
      case "ready":
      case "integrated":
        this.end = at;
    }
  }
  width(): string {
    return this.request.scale.width(this.end - this.entry.at);
  }
  label(chapter: TaskChapter): string {
    return `${this.look.label()} · ${chapter.task.common.id} · ${new RecordedTime(this.entry.at).full()} ${TimelineScale.TEXT.to} ${new RecordedTime(this.end).full()} · ${ActionLook.TEXT.revision} ${this.entry.revision} · ${this.look.detail()} · ${this.entry.note}`;
  }
}
export class TimelineRow {
  readonly pieces: ReadonlyArray<TimelinePiece>;
  readonly height = "28px";
  constructor(readonly request: TimelineRowRequest) {
    const spans: TimelinePiece[] = [];
    const entries = request.chapter.entries.filter((entry, index, all) =>
      all.slice(index + 1).every((later) => later.at !== entry.at),
    );
    for (const entry of entries) {
      const previous = spans.slice(-1);
      let continuation = StateContinuation.NewState;
      for (const piece of previous) {
        piece.extend(entry.at);
        continuation = piece.look.continuation(entry.state);
      }
      switch (continuation) {
        case StateContinuation.SameState:
          break;
        case StateContinuation.NewState: {
          const pieceRequest: TimelinePieceRequest = {
            entry,
            scale: request.scale,
          };
          spans.push(new TimelinePiece(pieceRequest));
        }
      }
    }
    for (const piece of spans.slice(-1))
      piece.extend(request.chapter.task.common.last_update);
    this.pieces = spans.filter(
      (piece) => piece.look.tone() !== StateTone.Queued,
    );
  }
  firstActive(): ReadonlyArray<RecordedTime> {
    return this.request.chapter.entries
      .filter((entry) => entry.state.kind === "active")
      .slice(0, 1)
      .map((entry) => new RecordedTime(entry.at));
  }
}
