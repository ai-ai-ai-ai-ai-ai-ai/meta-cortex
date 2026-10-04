import type {
  FeatureWorkflow,
  RecordedRole,
  TaskChapter,
  TimelineGroup,
} from "./contracts";
import { AgentLook } from "./presentation";
import {
  TimelineScale,
  TimelinePiece,
  type TimelinePieceRequest,
} from "./timeline";
enum LaneFit {
  Available = "available",
  Overlapping = "overlapping",
}
class WorkerLook {
  constructor(readonly group: TimelineGroup) {}
  key(): string {
    switch (this.group.identity.kind) {
      case "RecordedWorker":
        return `worker-${this.group.identity.worker_id}`;
      case "RoleHistory":
        return `history-${this.roleKey(this.group.identity.role)}`;
    }
  }
  private roleKey(role: RecordedRole): string {
    switch (role.kind) {
      case "Recorded":
        return `${role.agent.team}-${role.agent.role}`;
      case "Unrecorded":
        return "unrecorded";
    }
  }
  private roleName(role: RecordedRole): string {
    switch (role.kind) {
      case "Recorded":
        return new AgentLook(role.agent).name();
      case "Unrecorded":
        return WorkerTimeline.TEXT.roleUnrecorded;
    }
  }
  role(): string {
    return this.group.roles.map((role) => this.roleName(role)).join(" / ");
  }
  shortDetail(): string {
    switch (this.group.identity.kind) {
      case "RecordedWorker":
        return `${WorkerTimeline.TEXT.workerPrefix} …${this.group.identity.worker_id.slice(-8)}`;
      case "RoleHistory":
        return this.detail();
    }
  }
  title(): string {
    switch (this.group.identity.kind) {
      case "RecordedWorker":
        return this.role();
      case "RoleHistory":
        return `${this.role()} ${WorkerTimeline.TEXT.history}`;
    }
  }
  detail(): string {
    switch (this.group.identity.kind) {
      case "RecordedWorker":
        return this.group.identity.worker_id;
      case "RoleHistory":
        return WorkerTimeline.TEXT.unrecorded;
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
    switch (request.piece.window.start - request.previous.end) {
      case 0:
        return this.boundaryFit(request);
      default:
        switch (request.piece.window.start > request.previous.end) {
          case true:
            return LaneFit.Available;
          case false:
            return LaneFit.Overlapping;
        }
    }
  }
  private boundaryFit(request: LaneComparison): LaneFit {
    switch (request.piece.window.task === request.previous.window.task) {
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
interface WorkerGroupRequest {
  readonly group: TimelineGroup;
  readonly workflow: FeatureWorkflow;
  readonly scale: TimelineScale;
}
class WorkerGroup {
  readonly look: WorkerLook;
  readonly pieces: ReadonlyArray<TimelinePiece>;
  constructor(readonly request: WorkerGroupRequest) {
    this.look = new WorkerLook(request.group);
    this.pieces = request.group.windows.map((window) => {
      const pieceRequest: TimelinePieceRequest = {
        window,
        scale: request.scale,
      };
      return new TimelinePiece(pieceRequest);
    });
  }
  taskCount(): string {
    switch (this.request.group.tasks.length) {
      case 1:
        return `1 ${WorkerTimeline.TEXT.task}`;
      default:
        return `${this.request.group.tasks.length} ${WorkerTimeline.TEXT.tasks}`;
    }
  }
  laneLabel(count: number): string {
    return `${this.look.title()} · ${count} ${WorkerTimeline.TEXT.lanes}`;
  }
  chapters(): ReadonlyArray<TaskChapter> {
    return this.request.group.tasks.flatMap((task) =>
      this.request.workflow.chapters.filter(
        (chapter) => chapter.task.common.id === task,
      ),
    );
  }
  lanes(): ReadonlyArray<WorkerLane> {
    const lanes: WorkerLane[] = [];
    for (const piece of this.pieces
      .slice()
      .sort((left, right) => left.window.start - right.window.start)) {
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
  private readonly groups: ReadonlyArray<WorkerGroup>;
  constructor(workflow: FeatureWorkflow) {
    const scale = new TimelineScale(workflow);
    this.groups = workflow.timeline.groups.map((group) => {
      const request: WorkerGroupRequest = { group, workflow, scale };
      return new WorkerGroup(request);
    });
  }
  rows(): ReadonlyArray<WorkerGroup> {
    return this.groups;
  }
}
