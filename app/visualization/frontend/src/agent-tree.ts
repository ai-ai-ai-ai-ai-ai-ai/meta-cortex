import type {
  AgentId,
  FlowState,
  FlowCount,
  RecordedActor,
  TaskFlow,
  ReportingTarget,
} from "./contracts";
import { TaskPresentation } from "./task-presentation";
enum Expansion {
  Collapsed = "collapsed",
  Expanded = "expanded",
}
export class TreeExpansion {
  constructor(private readonly state: Expansion = Expansion.Collapsed) {}
  toggle(): TreeExpansion {
    switch (this.state) {
      case Expansion.Collapsed:
        return new TreeExpansion(Expansion.Expanded);
      case Expansion.Expanded:
        return new TreeExpansion(Expansion.Collapsed);
    }
  }
  // Boolean belongs to the HTML aria-expanded contract; state stays an enum.
  ariaExpanded(): boolean {
    switch (this.state) {
      case Expansion.Collapsed:
        return false;
      case Expansion.Expanded:
        return true;
    }
  }
}
export enum PanelKind {
  Closed = "closed",
  Agent = "agent",
}
export type AgentPanel =
  | { kind: PanelKind.Closed }
  | {
      kind: PanelKind.Agent;
      group: AgentContribution;
      task: TaskFlow;
      origin: string;
    };
export interface AgentSelection {
  group: AgentContribution;
  task: TaskFlow;
  origin: string;
}
class AgentLabel {
  constructor(private readonly actor: RecordedActor) {}
  id(): string {
    switch (this.actor.kind) {
      case "unrecorded":
        return "unrecorded";
      case "recorded":
        return `${this.actor.agent.team}:${this.actor.agent.role}`;
    }
  }
  name(): string {
    switch (this.actor.kind) {
      case "unrecorded":
        return "Assignment unrecorded";
      case "recorded":
        return this.role(this.actor.agent);
    }
  }
  private role(agent: AgentId): string {
    switch (agent.team) {
      case "Gizmo":
        switch (agent.role) {
          case "Gizmo":
            return "Team Gizmo";
          case "GizmoPrime":
            return "Gizmo Prime";
        }
        break;
      case "Development":
      case "Ai":
      case "Security":
      case "Sre":
      case "Delivery":
        return agent.role;
    }
  }
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
    return new AgentLabel(this.actor).name();
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
    const integrated = this.tasks.filter(
      (item) => item.task.state.kind === "integrated",
    ).length;
    const completed = this.tasks.filter(
      (item) => item.task.state.kind === "completed",
    ).length;
    return `${integrated} integrated · ${completed} completed / ${this.tasks.length} tasks`;
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
  readonly workers = new Map<string, AgentContribution>();
  constructor(readonly actor: RecordedActor) {}
  name(): string {
    switch (this.actor.kind) {
      case "recorded":
        return new AgentLabel(this.actor).name();
      case "unrecorded":
        return "Task creator unrecorded";
    }
  }
  add(task: TaskFlow): void {
    const key = new AgentLabel(task.worker).id();
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
type NodeActivity =
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
    const initialIds: ReadonlyArray<string> = [this.id()];
    const seen = new Set<string>(initialIds);
    for (const node of pending) {
      switch (seen.has(node.id())) {
        case true:
          break;
        case false:
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
      case "Assigned":
        this.recordAssignment(task);
    }
  }
  private recordHistory(task: TaskFlow): void {
    const key = new AgentLabel(task.created_by).id();
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
        const actor: RecordedActor = {
          kind: "recorded",
          agent: task.task.ownership.assignment.agent,
        };
        const parent = this.target(task.task.ownership.assignment.reports_to);
        const worker = this.agent(actor);
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
    const key = `${edge.source}->${edge.target}`;
    const previous = this.links.get(key);
    switch (previous) {
      case undefined:
        this.links.set(key, edge);
        return;
      default: {
        const updated: ReportingEdge = {
          ...edge,
          tasks: [...previous.tasks, ...edge.tasks],
        };
        this.links.set(key, updated);
      }
    }
  }
  private agent(actor: RecordedActor): ReportingNode {
    const label = new AgentLabel(actor);
    const identity: ReportingIdentity = {
      id: label.id(),
      name: label.name(),
      actor,
    };
    return this.obtain(identity);
  }
  private target(target: ReportingTarget): ReportingNode {
    switch (target.kind) {
      case "Host": {
        const actor: RecordedActor = { kind: "unrecorded" };
        const identity: ReportingIdentity = { id: "host", name: "Host", actor };
        return this.obtain(identity);
      }
      case "Gizmo": {
        const actor: RecordedActor = {
          kind: "recorded",
          agent: { team: "Gizmo", role: target.coordinator },
        };
        return this.agent(actor);
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
export class AgentTree {
  private readonly hierarchy: ReportingHierarchy;
  constructor(tasks: ReadonlyArray<TaskFlow>) {
    this.hierarchy = new ReportingHierarchy(tasks);
  }
  groups(): ReadonlyArray<ReportingNode> {
    return this.hierarchy.roots();
  }
  historical(): ReadonlyArray<Delegation> {
    return this.hierarchy.historical();
  }
}
