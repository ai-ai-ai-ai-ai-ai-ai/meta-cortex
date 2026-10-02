import type {
  AgentId,
  FlowState,
  FlowCount,
  RecordedActor,
  TaskFlow,
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
      [...this.tasks].sort(
        (left, right) =>
          right.task.common.last_update - left.task.common.last_update,
      )[0] ?? this.first()
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
    const key = new AgentLabel(task.worker).name();
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
export class AgentTree {
  constructor(private readonly tasks: ReadonlyArray<TaskFlow>) {}
  groups(): ReadonlyArray<Delegation> {
    const groups = new Map<string, Delegation>();
    for (const task of this.tasks) {
      const key = new AgentLabel(task.created_by).name();
      const group = groups.get(key) ?? new Delegation(task.created_by);
      group.add(task);
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort(
      (left, right) => right.tasks().length - left.tasks().length,
    );
  }
}
