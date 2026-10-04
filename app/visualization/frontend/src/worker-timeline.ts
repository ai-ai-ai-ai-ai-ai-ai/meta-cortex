import type {
  FeedEntry,
  FeatureWorkflow,
  RecordedRole,
  TaskChapter,
  WorkerIdentity,
} from "./contracts";
import { AgentLook } from "./presentation";
import { TimelineScale, type TimelinePiece } from "./timeline";

enum LaneFit {
  Available = "available",
  Overlapping = "overlapping",
}
interface WorkerGroupRequest {
  readonly identity: WorkerIdentity;
  readonly role: RecordedRole;
}
class WorkerLook {
  private readonly roles = new Set<string>();
  constructor(readonly request: WorkerGroupRequest) {
    this.record(request);
  }
  record(request: WorkerGroupRequest): void {
    switch (request.role.kind) {
      case "Recorded":
        this.roles.add(new AgentLook(request.role.agent).name());
        break;
      case "Unrecorded":
        this.roles.add(WorkerTimeline.TEXT.roleUnrecorded);
        break;
    }
  }
  key(): string {
    switch (this.request.identity.kind) {
      case "Recorded":
        return `worker-${this.request.identity.worker_id}`;
      case "Unrecorded":
        return `history-${this.roleKey()}`;
    }
  }
  private roleKey(): string {
    switch (this.request.role.kind) {
      case "Recorded":
        return `${this.request.role.agent.team}-${this.request.role.agent.role}`;
      case "Unrecorded":
        return "unrecorded";
    }
  }
  role(): string {
    return [...this.roles].join(" / ");
  }
  shortDetail(): string {
    switch (this.request.identity.kind) {
      case "Recorded":
        return `${WorkerTimeline.TEXT.workerPrefix} …${this.request.identity.worker_id.slice(-8)}`;
      case "Unrecorded":
        return this.detail();
    }
  }
  title(): string {
    switch (this.request.identity.kind) {
      case "Recorded":
        return this.role();
      case "Unrecorded":
        return `${this.role()} ${WorkerTimeline.TEXT.history}`;
    }
  }
  detail(): string {
    switch (this.request.identity.kind) {
      case "Recorded":
        return this.request.identity.worker_id;
      case "Unrecorded":
        return WorkerTimeline.TEXT.unrecorded;
    }
  }
}
class HistoricalWorker {
  constructor(readonly entry: FeedEntry) {}
  group(): WorkerGroupRequest {
    return { identity: this.entry.worker, role: this.role() };
  }
  private role(): RecordedRole {
    switch (this.entry.state.kind) {
      case "active":
        return { kind: "Recorded", agent: this.entry.state.assignment.agent };
      case "ready":
      case "completed":
        return { kind: "Recorded", agent: this.entry.state.agent };
      case "queued":
      case "integrated":
      case "cancelled":
        return this.assignedRole();
    }
  }
  private assignedRole(): RecordedRole {
    switch (this.entry.ownership.kind) {
      case "Assigned":
        return {
          kind: "Recorded",
          agent: this.entry.ownership.assignment.agent,
        };
      case "Unrecorded":
        return { kind: "Unrecorded" };
    }
  }
}
interface LaneComparison {
  readonly previous: TimelinePiece;
  readonly piece: TimelinePiece;
}
class WorkerLane {
  readonly pieces: TimelinePiece[] = [];
  fit(piece: TimelinePiece): LaneFit {
    for (const previous of this.pieces.slice(-1)) {
      const comparison: LaneComparison = { previous, piece };
      return this.compare(comparison);
    }
    return LaneFit.Available;
  }
  private compare(request: LaneComparison): LaneFit {
    switch (request.piece.entry.at - request.previous.end) {
      case 0:
        return this.boundaryFit(request);
      default:
        switch (request.piece.entry.at > request.previous.end) {
          case true:
            return LaneFit.Available;
          case false:
            return LaneFit.Overlapping;
        }
    }
  }
  private boundaryFit(request: LaneComparison): LaneFit {
    switch (
      request.piece.chapter.task.common.id ===
      request.previous.chapter.task.common.id
    ) {
      case true:
        return LaneFit.Available;
      case false:
        return LaneFit.Overlapping;
    }
  }
  add(piece: TimelinePiece): void {
    this.pieces.push(piece);
  }
}
class WorkerGroup {
  readonly look: WorkerLook;
  readonly pieces: TimelinePiece[] = [];
  private readonly tasks = new Map<string, TaskChapter>();
  constructor(request: WorkerGroupRequest) {
    this.look = new WorkerLook(request);
  }
  include(chapter: TaskChapter): void {
    this.tasks.set(chapter.task.common.id, chapter);
  }
  add(piece: TimelinePiece): void {
    this.pieces.push(piece);
    this.include(piece.chapter);
  }
  taskCount(): string {
    switch (this.tasks.size) {
      case 1:
        return `1 ${WorkerTimeline.TEXT.task}`;
      default:
        return `${this.tasks.size} ${WorkerTimeline.TEXT.tasks}`;
    }
  }
  laneLabel(count: number): string {
    return `${this.look.title()} · ${count} ${WorkerTimeline.TEXT.lanes}`;
  }
  chapters(): ReadonlyArray<TaskChapter> {
    return [...this.tasks.values()];
  }
  first(): number {
    return Math.min(...this.pieces.map((piece) => piece.entry.at));
  }
  lanes(): ReadonlyArray<WorkerLane> {
    const lanes: WorkerLane[] = [];
    for (const piece of this.pieces
      .slice()
      .sort((left, right) => left.entry.at - right.entry.at)) {
      const request: LaneRequest = { piece, lanes };
      this.place(request);
    }
    return lanes;
  }
  private place(request: LaneRequest): void {
    for (const lane of request.lanes) {
      switch (lane.fit(request.piece)) {
        case LaneFit.Available:
          lane.add(request.piece);
          return;
        case LaneFit.Overlapping:
          break;
      }
    }
    const lane = new WorkerLane();
    lane.add(request.piece);
    request.lanes.push(lane);
  }
}
interface LaneRequest {
  readonly piece: TimelinePiece;
  readonly lanes: WorkerLane[];
}
export class WorkerTimeline {
  static readonly TEXT = {
    title: "Workers & role histories",
    task: "task",
    tasks: "tasks",
    roleUnrecorded: "Role unrecorded",
    workerPrefix: "Worker",
    history: "history",
    lanes:
      "recorded lanes; tab through boxes or scroll for overlapping task records",
    unrecorded: "Worker ID unrecorded",
    note: "Recorded worker IDs group one worker across tasks. Role histories have no recorded worker ID and do not establish a single worker. Overlapping records use scrollable lanes; every box opens its original task.",
  };
  private readonly groups: WorkerGroup[] = [];
  constructor(workflow: FeatureWorkflow) {
    const scale = new TimelineScale(workflow);
    for (const chapter of scale.chapters()) {
      const request: ChapterRequest = { chapter, scale };
      this.addChapter(request);
    }
  }
  private addChapter(request: ChapterRequest): void {
    const pieces = request.scale.row(request.chapter).pieces;
    for (const piece of pieces)
      this.group(new HistoricalWorker(piece.entry).group()).add(piece);
    switch (pieces.length) {
      case 0: {
        const requestGroup: WorkerGroupRequest = {
          identity: request.chapter.task.worker,
          role: request.chapter.role,
        };
        this.group(requestGroup).include(request.chapter);
        break;
      }
      default:
        break;
    }
  }
  private group(request: WorkerGroupRequest): WorkerGroup {
    const look = new WorkerLook(request);
    for (const group of this.groups.filter(
      (group) => group.look.key() === look.key(),
    )) {
      group.look.record(request);
      return group;
    }
    const group = new WorkerGroup(request);
    this.groups.push(group);
    return group;
  }
  rows(): ReadonlyArray<WorkerGroup> {
    return this.groups
      .slice()
      .sort((left, right) => left.first() - right.first());
  }
}
interface ChapterRequest {
  readonly chapter: TaskChapter;
  readonly scale: TimelineScale;
}
