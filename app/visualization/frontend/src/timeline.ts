import { AgentLook } from "./presentation";
import type {
  FeatureWorkflow,
  TaskChapter,
  FeedEntry,
  TaskState,
  Phase,
  WorkerIdentity,
} from "./contracts";
import { RecordedTime, WorkflowView, Elapsed } from "./observability";
export enum StateTone {
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
  readonly chapter: TaskChapter;
}
export class TimelinePiece {
  readonly chapter: TaskChapter;
  readonly entry: FeedEntry;
  readonly look: RecordedStateLook;
  readonly left: string;
  end: number;
  private latest: FeedEntry;
  constructor(private readonly request: TimelinePieceRequest) {
    this.chapter = request.chapter;
    this.entry = request.entry;
    this.latest = request.entry;
    this.look = new RecordedStateLook(this.entry.state);
    this.left = request.scale.position(this.entry.at);
    this.end = this.entry.at;
  }
  continuation(entry: FeedEntry): StateContinuation {
    switch (
      this.workerKey(this.entry.worker) === this.workerKey(entry.worker)
    ) {
      case true:
        return this.look.continuation(entry.state);
      case false:
        return StateContinuation.NewState;
    }
  }
  private workerKey(worker: WorkerIdentity): string {
    switch (worker.kind) {
      case "Recorded":
        return worker.worker_id;
      case "Unrecorded":
        return "unrecorded";
    }
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
  duration(): string {
    return new Elapsed(this.end - this.entry.at).compact();
  }
  record(entry: FeedEntry): void {
    switch (entry.summary.trim()) {
      case "":
        break;
      default:
        this.latest = entry;
    }
  }
  summary(): string {
    switch (this.latest.summary.trim()) {
      case "":
        return TimelinePiece.TEXT.noSummary;
      default:
        return this.latest.summary;
    }
  }
  assignment(): string {
    return `${this.role()} · ${this.chapter.task.common.id}`;
  }
  private role(): string {
    switch (this.entry.state.kind) {
      case "active":
        return new AgentLook(this.entry.state.assignment.agent).name();
      case "ready":
      case "completed":
        return new AgentLook(this.entry.state.agent).name();
      case "queued":
      case "integrated":
      case "cancelled":
        return this.assignedRole();
    }
  }
  private assignedRole(): string {
    switch (this.entry.ownership.kind) {
      case "Assigned":
        return new AgentLook(this.entry.ownership.assignment.agent).name();
      case "Unrecorded":
        return TimelinePiece.TEXT.roleUnrecorded;
    }
  }
  worker(): string {
    switch (this.entry.worker.kind) {
      case "Recorded":
        return `${TimelinePiece.TEXT.worker} …${this.entry.worker.worker_id.slice(-8)}`;
      case "Unrecorded":
        return TimelinePiece.TEXT.unrecorded;
    }
  }
  times(): string {
    return `${new RecordedTime(this.entry.at).clock()}–${new RecordedTime(this.end).clock()} · ${RecordedTime.ZONE_LABEL}`;
  }
  label(): string {
    return `${this.look.label()} · ${this.chapter.task.common.id} · ${this.chapter.task.common.objective}`;
  }
  static readonly TEXT = {
    worker: "Worker",
    roleUnrecorded: "Role unrecorded",
    unrecorded: "Worker ID unrecorded",
    recorded: "Recorded state",
    progress: "Recorded progress",
    blocked: "Blocked reason",
    noSummary: "No progress summary recorded for this state.",
    open: "Open task log",
  };
}
export class TimelineRow {
  readonly pieces: ReadonlyArray<TimelinePiece>;
  readonly height = "36px";
  constructor(request: TimelineRowRequest) {
    const spans: TimelinePiece[] = [];
    const entries = request.chapter.entries.filter((entry, index, all) =>
      all.slice(index + 1).every((later) => later.at !== entry.at),
    );
    for (const entry of entries) {
      const previous = spans.slice(-1);
      let continuation = StateContinuation.NewState;
      for (const piece of previous) {
        piece.extend(entry.at);
        continuation = piece.continuation(entry);
      }
      switch (continuation) {
        case StateContinuation.SameState:
          previous.forEach((piece) => piece.record(entry));
          break;
        case StateContinuation.NewState: {
          const pieceRequest: TimelinePieceRequest = {
            entry,
            scale: request.scale,
            chapter: request.chapter,
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
}
