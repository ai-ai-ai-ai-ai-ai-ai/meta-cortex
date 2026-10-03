import type {
  AgentId,
  FlowState,
  FlowCount,
  RecordedActor,
  TaskFlow,
  TaskV2,
  ReportingTarget,
} from "./contracts";
import { TaskPresentation } from "./task-presentation";
import { summarizeCounts } from "./progress-presentation";
export enum SelectionKind {
  Task = "task",
  Activity = "activity",
}
export type TaskSelection =
  | { kind: SelectionKind.Task; task: TaskV2 }
  | { kind: SelectionKind.Activity; task: TaskFlow };
export class AgentContribution {
  private static readonly priority: Record<FlowState, number> = {
    blocked: 0,
    working: 1,
    ready: 2,
    queued: 3,
    integrated: 4,
    completed: 5,
    cancelled: 6,
  };
  constructor(
    readonly actor: RecordedActor,
    readonly tasks: readonly [TaskFlow, ...TaskFlow[]],
  ) {}
  name(): string {
    switch (this.actor.kind) {
      case "unrecorded":
        return "Assignment unrecorded";
      case "recorded":
        return TaskPresentation.agentName(this.actor.agent);
    }
  }
  first(): TaskFlow {
    return this.tasks[0];
  }
  status(): FlowState {
    return TaskPresentation.describe(this.latest().task).status;
  }

  summary(): string {
    const progress = summarizeCounts(this.counts());
    return `${progress.byState.integrated} integrated · ${progress.byState.completed} completed · ${progress.byState.ready} ready · ${progress.total} tasks`;
  }
  counts(): ReadonlyArray<FlowCount> {
    return TaskPresentation.counts(this.tasks);
  }
  latest(): TaskFlow {
    return (
      [...this.tasks].sort((left, right) => {
        const leftState = TaskPresentation.describe(left.task).status;
        const rightState = TaskPresentation.describe(right.task).status;
        const priority =
          AgentContribution.priority[leftState] -
          AgentContribution.priority[rightState];
        switch (priority) {
          case 0:
            return right.task.common.last_update - left.task.common.last_update;
          default:
            return priority;
        }
      })[0] ?? this.first()
    );
  }
  adding(task: TaskFlow): AgentContribution {
    return new AgentContribution(this.actor, [...this.tasks, task]);
  }
}
export class Delegation {
  readonly workers = new Map<string, AgentContribution>();
  constructor(readonly actor: RecordedActor) {}
  name(): string {
    switch (this.actor.kind) {
      case "recorded":
        return TaskPresentation.agentName(this.actor.agent);
      case "unrecorded":
        return "Task creator unrecorded";
    }
  }
  add(task: TaskFlow): void {
    const key = TaskPresentation.actorKey(task.worker);
    const worker = this.workers.get(key);
    switch (worker) {
      case undefined:
        this.workers.set(key, new AgentContribution(task.worker, [task]));
        break;
      default:
        this.workers.set(key, worker.adding(task));
    }
  }
}
export enum ActivityKind {
  Recorded = "recorded",
  Absent = "absent",
}
export type NodeActivity =
  | { kind: ActivityKind.Recorded; group: AgentContribution }
  | { kind: ActivityKind.Absent };
interface ReportingIdentity {
  id: string;
  name: string;
  actor: RecordedActor;
}
interface ReportingEdge {
  source: string;
  target: string;
  tasks: ReadonlyArray<TaskFlow>;
}
export class ReportingNode {
  private ownActivity: NodeActivity = { kind: ActivityKind.Absent };
  private readonly reportingChildren = new Map<string, ReportingNode>();
  constructor(private readonly identity: ReportingIdentity) {}
  id(): string {
    return this.identity.id;
  }
  name(): string {
    return this.identity.name;
  }
  actor(): RecordedActor {
    return this.identity.actor;
  }
  get activity(): NodeActivity {
    return this.ownActivity;
  }
  get children(): ReadonlyArray<ReportingNode> {
    return Array.from(this.reportingChildren.values());
  }
  add(task: TaskFlow): void {
    switch (this.ownActivity.kind) {
      case ActivityKind.Absent: {
        const tasks: readonly [TaskFlow] = [task];
        const group = new AgentContribution(this.actor(), tasks);
        this.ownActivity = { kind: ActivityKind.Recorded, group };
        return;
      }
      case ActivityKind.Recorded:
        this.ownActivity = {
          kind: ActivityKind.Recorded,
          group: this.ownActivity.group.adding(task),
        };
    }
  }
  attach(child: ReportingNode): void {
    this.reportingChildren.set(child.id(), child);
  }
  ownTasks(): ReadonlyArray<TaskFlow> {
    switch (this.ownActivity.kind) {
      case ActivityKind.Absent:
        return [];
      case ActivityKind.Recorded:
        return this.ownActivity.group.tasks;
    }
  }
  descendantCounts(): ReadonlyArray<FlowCount> {
    const tasks = this.descendantTasks();
    return TaskPresentation.counts(tasks);
  }
  subtreeCounts(): ReadonlyArray<FlowCount> {
    const collected: ReadonlyArray<TaskFlow> = [
      ...this.ownTasks(),
      ...this.descendantTasks(),
    ];
    const tasks = this.uniqueTasks(collected);
    return TaskPresentation.counts(tasks);
  }
  private descendantTasks(): ReadonlyArray<TaskFlow> {
    const pending = [...this.children];
    const reached: ReportingNode[] = [];
    const seen = new Set<string>([this.id()]);
    for (const node of pending) {
      switch (seen.has(node.id())) {
        case true:
          continue;
        case false:
          seen.add(node.id());
          reached.push(node);
          pending.push(...node.children);
      }
    }

    const ownIds = new Set(this.ownTasks().map((task) => task.task.common.id));
    const tasks = reached.flatMap((node) => node.ownTasks());
    return this.uniqueTasks(tasks).filter(
      (task) => !ownIds.has(task.task.common.id),
    );
  }
  private uniqueTasks(tasks: ReadonlyArray<TaskFlow>): ReadonlyArray<TaskFlow> {
    const unique = new Map<string, TaskFlow>();
    for (const task of tasks) {
      unique.set(task.task.common.id, task);
    }
    return Array.from(unique.values());
  }
}
export class ReportingHierarchy {
  private readonly identities = new Map<string, ReportingNode>();
  private readonly links = new Map<string, ReportingEdge>();
  private readonly history = new Map<string, Delegation>();
  constructor(tasks: ReadonlyArray<TaskFlow>) {
    for (const task of tasks) {
      this.record(task);
    }
  }
  roots(): ReadonlyArray<ReportingNode> {
    const children = new Set(this.edges().map((edge) => edge.target));
    return this.nodes().filter((node) => !children.has(node.id()));
  }
  nodes(): ReadonlyArray<ReportingNode> {
    return Array.from(this.identities.values());
  }
  edges(): ReadonlyArray<ReportingEdge> {
    return Array.from(this.links.values());
  }
  historical(): ReadonlyArray<Delegation> {
    return Array.from(this.history.values());
  }
  private record(task: TaskFlow): void {
    switch (task.task.ownership.kind) {
      case "Unrecorded":
        this.recordHistory(task);
        return;
      case "Assigned": {
        const { agent, reports_to } = task.task.ownership.assignment;
        const parent = this.target(reports_to);
        const worker = this.agent(agent);
        worker.add(task);
        parent.attach(worker);
        this.recordEdge({
          source: parent.id(),
          target: worker.id(),
          tasks: [task],
        });
      }
    }
  }
  private recordHistory(task: TaskFlow): void {
    const key = TaskPresentation.actorKey(task.created_by);
    const group = this.history.get(key) ?? new Delegation(task.created_by);
    group.add(task);
    this.history.set(key, group);
  }

  private recordEdge(edge: ReportingEdge): void {
    const key = `${edge.source}->${edge.target}`;
    const previous = this.links.get(key);
    switch (previous) {
      case undefined:
        this.links.set(key, edge);
        break;
      default:
        previous.tasks = [...previous.tasks, ...edge.tasks];
    }
  }

  private agent(agent: AgentId): ReportingNode {
    const actor: RecordedActor = { kind: "recorded", agent };
    const identity: ReportingIdentity = {
      id: TaskPresentation.actorKey(actor),
      name: TaskPresentation.agentName(agent),
      actor,
    };
    return this.obtain(identity);
  }
  private target(target: ReportingTarget): ReportingNode {
    switch (target.kind) {
      case "Host": {
        const actor: RecordedActor = { kind: "unrecorded" };
        const identity: ReportingIdentity = {
          id: "host",
          name: "Host",
          actor,
        };
        return this.obtain(identity);
      }
      case "Gizmo": {
        const agent: AgentId = { team: "Gizmo", role: target.coordinator };
        return this.agent(agent);
      }
    }
  }
  private obtain(identity: ReportingIdentity): ReportingNode {
    const previous = this.identities.get(identity.id);
    switch (previous) {
      case undefined: {
        const node = new ReportingNode(identity);
        this.identities.set(identity.id, node);
        return node;
      }
      default:
        return previous;
    }
  }
}
