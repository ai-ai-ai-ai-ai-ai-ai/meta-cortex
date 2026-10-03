import type {
  AgentId,
  FlowState,
  FlowCount,
  RecordedActor,
  TaskFlow,
  ReportingTarget,
} from "./contracts";
import { TaskPresentation } from "./task-presentation";
import { summarizeCounts } from "./progress-presentation";
export interface AgentSelection {
  group: AgentContribution;
  task: TaskFlow;
  origin: string;
}
enum IdentityMatch {
  Same = "same",
  Different = "different",
}
export class ReportingNodeId {
  private constructor(private readonly value: string) {}
  static actor(actor: RecordedActor): ReportingNodeId {
    switch (actor.kind) {
      case "unrecorded":
        return new ReportingNodeId("unrecorded");
      case "recorded":
        return new ReportingNodeId(`${actor.agent.team}:${actor.agent.role}`);
    }
  }
  static host(): ReportingNodeId {
    return new ReportingNodeId("host");
  }
  match(other: ReportingNodeId): IdentityMatch {
    switch (this.value === other.value) {
      case true:
        return IdentityMatch.Same;
      case false:
        return IdentityMatch.Different;
    }
  }
  // String identity is required only at DOM and graph rendering boundaries.
  serialize(): string {
    return this.value;
  }
}
enum VisitKind {
  FirstVisit = "first-visit",
  AlreadyVisited = "already-visited",
}
interface ReportingVisit {
  seen: ReadonlySet<ReportingNodeId>;
  id: ReportingNodeId;
}
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
    const states = this.tasks
      .map((item) => new TaskPresentation(item.task).status())
      .sort(
        (left, right) =>
          AgentContribution.priority[left] - AgentContribution.priority[right],
      );
    return states[0] ?? new TaskPresentation(this.first().task).status();
  }
  summary(): string {
    const progress = summarizeCounts(this.counts());
    return `${progress.byState.integrated} integrated · ${progress.byState.completed} completed · ${progress.byState.ready} ready · ${progress.total} tasks`;
  }
  counts(): ReadonlyArray<FlowCount> {
    return new ContributionProgress(this.tasks).counts();
  }
  latest(): TaskFlow {
    return (
      [...this.tasks].sort((left, right) => {
        const leftState = new TaskPresentation(left.task).status();
        const rightState = new TaskPresentation(right.task).status();
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
  checkpoint(): string {
    return new TaskPresentation(this.latest().task).checkpoint();
  }
  adding(task: TaskFlow): AgentContribution {
    return new AgentContribution(this.actor, [...this.tasks, task]);
  }
}
export class Delegation {
  readonly workers = new Map<ReportingNodeId, AgentContribution>();
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
    const requested = ReportingNodeId.actor(task.worker);
    // Array.find requires a boolean; the value owner retains identity meaning.
    const key = Array.from(this.workers.keys()).find(
      (id) => id.match(requested) === IdentityMatch.Same,
    );
    switch (key) {
      case undefined:
        this.workers.set(requested, new AgentContribution(task.worker, [task]));
        return;
      default:
        break;
    }
    const worker = this.workers.get(key);
    switch (worker) {
      case undefined:
        this.workers.set(key, new AgentContribution(task.worker, [task]));
        return;
      default:
        this.workers.set(key, worker.adding(task));
    }
  }
  tasks(): ReadonlyArray<TaskFlow> {
    return Array.from(this.workers.values()).flatMap((worker) => worker.tasks);
  }
  integrated(): number {
    return this.tasks().filter((item) => item.task.state.kind === "integrated")
      .length;
  }
  counts(): ReadonlyArray<FlowCount> {
    return new ContributionProgress(this.tasks()).counts();
  }
}
class ContributionProgress {
  constructor(private readonly tasks: ReadonlyArray<TaskFlow>) {}
  counts(): ReadonlyArray<FlowCount> {
    const counts = new Map<FlowState, number>();
    for (const item of this.tasks) {
      const state = new TaskPresentation(item.task).status();
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    return Array.from(counts, ([state, count]) => ({ state, count }));
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
  id: ReportingNodeId;
  name: string;
  actor: RecordedActor;
}
interface ReportingEdge {
  source: ReportingNodeId;
  target: ReportingNodeId;
  tasks: ReadonlyArray<TaskFlow>;
}
export class ReportingNode {
  private ownActivity: NodeActivity = { kind: ActivityKind.Absent };
  private readonly reportingChildren = new Map<
    ReportingNodeId,
    ReportingNode
  >();
  constructor(private readonly identity: ReportingIdentity) {}
  id(): ReportingNodeId {
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
    return new ContributionProgress(tasks).counts();
  }
  subtreeCounts(): ReadonlyArray<FlowCount> {
    const collected: ReadonlyArray<TaskFlow> = [
      ...this.ownTasks(),
      ...this.descendantTasks(),
    ];
    const tasks = this.uniqueTasks(collected);
    return new ContributionProgress(tasks).counts();
  }
  private descendantTasks(): ReadonlyArray<TaskFlow> {
    const pending = [...this.children];
    const reached: ReportingNode[] = [];
    const initialIds: ReadonlyArray<ReportingNodeId> = [this.id()];
    const seen = new Set<ReportingNodeId>(initialIds);
    for (const node of pending) {
      const visit: ReportingVisit = { seen, id: node.id() };
      switch (this.visit(visit)) {
        case VisitKind.AlreadyVisited:
          break;
        case VisitKind.FirstVisit:
          seen.add(node.id());
          reached.push(node);
          pending.push(...node.children);
          break;
      }
    }
    const ownIds = new Set(this.ownTasks().map((task) => task.task.common.id));
    const tasks = reached.flatMap((node) => node.ownTasks());
    return this.uniqueTasks(tasks).filter(
      (task) => !ownIds.has(task.task.common.id),
    );
  }
  private visit(visit: ReportingVisit): VisitKind {
    switch (visit.seen.has(visit.id)) {
      case true:
        return VisitKind.AlreadyVisited;
      case false:
        return VisitKind.FirstVisit;
    }
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
  private readonly identities = new Map<ReportingNodeId, ReportingNode>();
  private readonly links: ReportingEdge[] = [];
  private readonly history = new Map<ReportingNodeId, Delegation>();
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
    return this.links;
  }
  historical(): ReadonlyArray<Delegation> {
    return Array.from(this.history.values());
  }
  private record(task: TaskFlow): void {
    switch (task.task.ownership.kind) {
      case "Unrecorded":
        this.recordHistory(task);
        return;
      case "Assigned":
        this.recordAssignment(task);
    }
  }
  private recordHistory(task: TaskFlow): void {
    const requested = ReportingNodeId.actor(task.created_by);
    const key = Array.from(this.history.keys()).find(
      (id) => id.match(requested) === IdentityMatch.Same,
    );
    switch (key) {
      case undefined: {
        const group = new Delegation(task.created_by);
        group.add(task);
        this.history.set(requested, group);
        return;
      }
      default:
        break;
    }
    const previous = this.history.get(key);
    switch (previous) {
      case undefined: {
        const group = new Delegation(task.created_by);
        group.add(task);
        this.history.set(key, group);
        return;
      }
      default:
        previous.add(task);
    }
  }
  private recordAssignment(task: TaskFlow): void {
    switch (task.task.ownership.kind) {
      case "Unrecorded":
        return;
      case "Assigned": {
        const parent = this.target(task.task.ownership.assignment.reports_to);
        const worker = this.agent(task.task.ownership.assignment.agent);
        worker.add(task);
        parent.attach(worker);
        const edge: ReportingEdge = {
          source: parent.id(),
          target: worker.id(),
          tasks: [task],
        };
        this.recordEdge(edge);
      }
    }
  }
  private recordEdge(edge: ReportingEdge): void {
    // Array.find requires a predicate; both endpoints retain their value owner.
    const previous = this.links.find(
      (link) =>
        link.source.match(edge.source) === IdentityMatch.Same &&
        link.target.match(edge.target) === IdentityMatch.Same,
    );
    switch (previous) {
      case undefined:
        this.links.push(edge);
        return;
      default:
        previous.tasks = [...previous.tasks, ...edge.tasks];
    }
  }
  private agent(agent: AgentId): ReportingNode {
    const actor: RecordedActor = { kind: "recorded", agent };
    const identity: ReportingIdentity = {
      id: ReportingNodeId.actor(actor),
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
          id: ReportingNodeId.host(),
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
    const previous = this.nodes().find(
      (node) => node.id().match(identity.id) === IdentityMatch.Same,
    );
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
