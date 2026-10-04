import { AgentLook } from "./presentation";
import type {
  FeatureWorkflow,
  TaskChapter,
  RecordedWindow,
  Phase,
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
export class TimelineScale {
  static readonly TEXT = {
    title: WorkflowView.Windows,
    description: "Recorded task states, aligned to their actual timestamps.",
    scrollRegion: "Recorded state timeline",
    to: "to",
    legend: "Recorded state legend",
    meanings: "State meanings",
    state: "State",
    meaning: "Meaning",
    evidence: "Evidence",
    nextStep: "Next step",
    note: "Color shows the recorded task state from a claim or update through the next state or last evidence. Queued intervals stay empty. A recorded claim is caller-supplied ledger evidence, not a measured execution start or proof of a host agent launch. Notes, checkpoints and recording actors remain in the Log.",
  };
  static readonly FRACTIONS = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];
  constructor(readonly workflow: FeatureWorkflow) {}
  chapters(): ReadonlyArray<TaskChapter> {
    return this.workflow.timeline.chapter_order.flatMap((task) =>
      this.workflow.chapters.filter(
        (chapter) => chapter.task.common.id === task,
      ),
    );
  }
  first(): number {
    switch (this.workflow.timeline.extent.kind) {
      case "Empty":
        return 0;
      case "Recorded":
        return this.workflow.timeline.extent.started;
    }
  }
  last(): number {
    switch (this.workflow.timeline.extent.kind) {
      case "Empty":
        return 0;
      case "Recorded":
        return this.workflow.timeline.extent.finished;
    }
  }
  ticks(): ReadonlyArray<RecordedTime> {
    switch (this.workflow.timeline.extent.kind) {
      case "Empty":
        return [];
      case "Recorded":
        return this.recordedTicks();
    }
  }
  private recordedTicks(): ReadonlyArray<RecordedTime> {
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
  constructor(readonly window: RecordedWindow) {}
  tone(): StateTone {
    switch (this.window.status) {
      case "queued":
        return StateTone.Queued;
      case "working":
        return StateTone.Working;
      case "blocked":
        return StateTone.Blocked;
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
  label(): string {
    return RecordedStateLook.LABELS[this.tone()];
  }
  detail(): string {
    switch (this.window.state.kind) {
      case "active":
        return this.phaseDetail(this.window.state.assignment.phase);
      case "cancelled":
        return this.window.state.reason;
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
        return "";
    }
  }
  private phaseDetail(phase: Phase): string {
    switch (phase.kind) {
      case "working":
        return "";
      case "blocked":
        return phase.reason;
    }
  }
}
export interface TimelinePieceRequest {
  readonly window: RecordedWindow;
  readonly scale: TimelineScale;
}
export class TimelinePiece {
  readonly window: RecordedWindow;
  readonly look: RecordedStateLook;
  readonly left: string;
  readonly end: number;
  constructor(private readonly request: TimelinePieceRequest) {
    this.window = request.window;
    this.look = new RecordedStateLook(this.window);
    this.left = request.scale.position(this.window.start);
    this.end = this.window.end;
  }
  width(): string {
    return this.request.scale.width(this.window.duration_ms);
  }
  duration(): string {
    return new Elapsed(this.window.duration_ms).compact();
  }
  summary(): string {
    switch (this.window.summary) {
      case "":
        return TimelinePiece.TEXT.noSummary;
      default:
        return this.window.summary;
    }
  }
  assignment(): string {
    return `${this.role()} · ${this.window.task}`;
  }
  private role(): string {
    switch (this.window.role.kind) {
      case "Recorded":
        return new AgentLook(this.window.role.agent).name();
      case "Unrecorded":
        return TimelinePiece.TEXT.roleUnrecorded;
    }
  }
  worker(): string {
    switch (this.window.worker.kind) {
      case "Recorded":
        return `${TimelinePiece.TEXT.worker} …${this.window.worker.worker_id.slice(-8)}`;
      case "Unrecorded":
        return TimelinePiece.TEXT.unrecorded;
    }
  }
  times(): string {
    return `${new RecordedTime(this.window.start).clock()}–${new RecordedTime(this.window.end).clock()} · ${RecordedTime.ZONE_LABEL}`;
  }
  label(): string {
    return `${this.look.label()} · ${this.window.task} · ${this.window.objective}`;
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
