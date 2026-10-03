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
export enum ReportingRowKind {
  Reporting = "reporting",
  Creator = "creator",
  Worker = "worker",
  Task = "task",
}
interface ReportingRowValues {
  actionLabel: string;
  status: string;
  ownCounts: string;
  descendantCounts: string;
  workspace: string;
  checkpoint: string;
  selection: TaskSelection | null;
}
interface ReportingRowBase extends ReportingRowValues {
  id: string;
  label: string;
  expandInitially: boolean;
  subRows: ReportingTableRow[];
}
export type ReportingTableRow = ReportingRowBase &
  (
    | { kind: ReportingRowKind.Reporting; node: ReportingNode }
    | { kind: ReportingRowKind.Creator; label: string }
    | { kind: ReportingRowKind.Worker; group: AgentContribution }
    | { kind: ReportingRowKind.Task; task: TaskFlow }
  );

export function reportingRows(
  tasks: ReadonlyArray<TaskFlow>,
): ReportingTableRow[] {
  const hierarchy = new ReportingHierarchy(tasks);
  const counts = (items: ReadonlyArray<FlowCount>): string => {
    const { finished, total } = summarizeCounts(items);
    return `${finished}/${total} finished`;
  };
  const values = (flow: TaskFlow): ReportingRowValues => {
    const display = TaskPresentation.describe(flow.task);
    let checkpoint = display.checkpoint;
    switch (flow.task.common.checkpoint.kind) {
      case "git":
        checkpoint = flow.task.common.checkpoint.commit.slice(0, 7);
        break;
      case "unrecorded":
        break;
    }
    let workspace = display.workspaceLabel;
    switch (flow.task.workspace.kind) {
      case "git":
        workspace += ` · ${flow.task.workspace.branch}`;
        break;
      case "feature":
      case "read_only":
        break;
    }
    return {
      actionLabel: `Open task ${flow.task.common.id}`,
      status: display.statusLabel,
      ownCounts: "",
      descendantCounts: "",
      workspace,
      checkpoint,
      selection: { kind: SelectionKind.Activity, task: flow },
    };
  };
  const taskRow = (task: TaskFlow): ReportingTableRow => ({
    ...values(task),
    kind: ReportingRowKind.Task,
    id: `task:${task.task.common.id}`,
    label: task.task.common.objective,
    expandInitially: false,
    task,
    subRows: [],
  });
  const seen = new Set<string>();
  const reportingRow = (node: ReportingNode): ReportingTableRow => {
    seen.add(node.id());
    let own: ReportingRowValues = {
      actionLabel: "",
      status: "No activity on this page",
      ownCounts: "",
      descendantCounts: "",
      workspace: "",
      checkpoint: "",
      selection: null,
    };
    switch (node.activity.kind) {
      case ActivityKind.Recorded:
        own = values(node.activity.group.latest());
        own.ownCounts = counts(node.activity.group.counts());
        break;
      case ActivityKind.Absent:
        break;
    }
    switch (node.children.length) {
      case 0:
        break;
      default:
        own.descendantCounts = counts(node.descendantCounts());
    }
    const row: ReportingTableRow = {
      ...own,
      kind: ReportingRowKind.Reporting,
      id: node.id(),
      label: node.name(),
      expandInitially: node.children.length > 0,
      node,
      subRows: [
        ...node.ownTasks().map(taskRow),
        ...node.children
          .filter((child) => !seen.has(child.id()))
          .map(reportingRow),
      ],
    };
    seen.delete(node.id());
    return row;
  };
  const recorded = hierarchy.roots().map(reportingRow);
  const historical = hierarchy
    .historical()
    .map((creator): ReportingTableRow => {
      const creatorId = `history:${TaskPresentation.actorKey(creator.actor)}`;
      return {
        kind: ReportingRowKind.Creator,
        id: creatorId,
        label: `Created by · ${creator.name()} · reporting unrecorded`,
        expandInitially: true,
        status: "",
        actionLabel: "",
        ownCounts: "",
        descendantCounts: "",
        workspace: "",
        checkpoint: "",
        selection: null,
        subRows: Array.from(creator.workers.entries()).map(
          ([key, group]): ReportingTableRow => ({
            ...values(group.latest()),
            kind: ReportingRowKind.Worker,
            id: `${creatorId}:${key}`,
            label: group.name(),
            expandInitially: false,
            ownCounts: counts(group.counts()),
            group,
            subRows: group.tasks.map(taskRow),
          }),
        ),
      };
    });
  return [...recorded, ...historical];
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
      })[0] ?? this.tasks[0]
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
type NodeActivity =
  | { kind: ActivityKind.Recorded; group: AgentContribution }
  | { kind: ActivityKind.Absent };
interface ReportingIdentity {
  id: string;
  name: string;
  actor: RecordedActor;
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
  private readonly history = new Map<string, Delegation>();
  constructor(tasks: ReadonlyArray<TaskFlow>) {
    for (const task of tasks) {
      this.record(task);
    }
  }
  roots(): ReadonlyArray<ReportingNode> {
    const children = new Set(
      this.nodes().flatMap((node) => node.children.map((child) => child.id())),
    );
    return this.nodes().filter((node) => !children.has(node.id()));
  }
  nodes(): ReadonlyArray<ReportingNode> {
    return Array.from(this.identities.values());
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
      }
    }
  }
  private recordHistory(task: TaskFlow): void {
    const key = TaskPresentation.actorKey(task.created_by);
    const group = this.history.get(key) ?? new Delegation(task.created_by);
    group.add(task);
    this.history.set(key, group);
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
