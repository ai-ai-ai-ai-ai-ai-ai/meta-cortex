import type {
  TaskV2,
  TaskFlow,
  FlowState,
  FlowCount,
  RecordedActor,
  AgentId,
  GizmoAgent,
  ReportingTarget,
} from "./contracts";
interface TaskDisplay {
  status: FlowState;
  statusLabel: string;
  actor: string;
  reportsTo: string;
  workspaceLabel: string;
  workspace: string;
  reason: string;
  lease: string;
  checkpoint: string;
  integration: string;
}
export enum ContributionSection {
  Attention = "Needs attention",
  Ongoing = "In progress & handoff",
  Upcoming = "Up next",
  Finished = "What was achieved",
  Cancelled = "Cancelled work",
}
export class TaskPresentation {
  static readonly sections: Record<FlowState, ContributionSection> = {
    blocked: ContributionSection.Attention,
    working: ContributionSection.Ongoing,
    ready: ContributionSection.Ongoing,
    queued: ContributionSection.Upcoming,
    integrated: ContributionSection.Finished,
    completed: ContributionSection.Finished,
    cancelled: ContributionSection.Cancelled,
  };
  static readonly tones: Record<FlowState, string> = {
    integrated: "bg-emerald-50 text-emerald-800",
    completed: "bg-emerald-50 text-emerald-800",
    working: "bg-sky-50 text-sky-800",
    blocked: "bg-red-50 text-red-800",
    ready: "bg-amber-50 text-amber-800",
    queued: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };
  private static readonly priority: Record<FlowState, number> = {
    blocked: 0,
    working: 1,
    ready: 2,
    queued: 3,
    integrated: 4,
    completed: 5,
    cancelled: 6,
  };
  private static readonly labels: Record<FlowState, string> = {
    integrated: "Integrated",
    completed: "Completed",
    working: "In progress",
    queued: "Queued",
    ready: "Ready",
    blocked: "Blocked",
    cancelled: "Cancelled",
  };
  static agent(agent: AgentId): string {
    return `${agent.team} / ${agent.role}`;
  }
  static workerName(flow: TaskFlow): string {
    switch (flow.worker.kind) {
      case "recorded":
        return this.agentName(flow.worker.agent);
      case "unrecorded":
        switch (flow.task.ownership.kind) {
          case "Assigned":
            return `Assigned to ${this.agentName(flow.task.ownership.assignment.agent)}`;
          case "Unrecorded":
            return "Agent unrecorded";
        }
    }
  }
  private static coordinator(coordinator: GizmoAgent): string {
    const names: Record<GizmoAgent, string> = {
      Gizmo: "Team Gizmo",
      GizmoPrime: "Gizmo Prime",
    };
    return names[coordinator];
  }
  static agentName(agent: AgentId): string {
    switch (agent.team) {
      case "Gizmo":
        return this.coordinator(agent.role);
      case "Development":
      case "Ai":
      case "Security":
      case "Sre":
      case "Delivery":
        return agent.role;
    }
  }
  static actorKey(actor: RecordedActor): string {
    switch (actor.kind) {
      case "recorded":
        return `${actor.agent.team}:${actor.agent.role}`;
      case "unrecorded":
        return "unrecorded";
    }
  }
  static reporting(target: ReportingTarget): { id: string; label: string } {
    switch (target.kind) {
      case "Host":
        return { id: "host", label: "Host" };
      case "Gizmo":
        return {
          id: `Gizmo:${target.coordinator}`,
          label: this.coordinator(target.coordinator),
        };
    }
  }
  static status(task: TaskV2): FlowState {
    switch (task.state.kind) {
      case "active":
        return task.state.assignment.phase.kind;
      case "ready":
      case "completed":
      case "integrated":
      case "cancelled":
      case "queued":
        return task.state.kind;
    }
  }
  static compareActivity(this: void, left: TaskFlow, right: TaskFlow): number {
    const priority =
      TaskPresentation.priority[TaskPresentation.status(left.task)] -
      TaskPresentation.priority[TaskPresentation.status(right.task)];
    switch (priority) {
      case 0:
        return right.task.common.last_update - left.task.common.last_update;
      default:
        return priority;
    }
  }
  static describe(task: TaskV2): TaskDisplay {
    const display: TaskDisplay = {
      status: this.status(task),
      statusLabel: "",
      actor: "Unrecorded",
      reportsTo: "Unrecorded",
      workspaceLabel: "",
      workspace: "",
      reason: "",
      lease: "Unrecorded",
      checkpoint: "Unrecorded",
      integration: "Unrecorded",
    };
    switch (task.state.kind) {
      case "active":
        display.actor = this.agent(task.state.assignment.agent);
        display.lease = new Date(
          task.state.assignment.expires_at,
        ).toLocaleString();
        switch (task.state.assignment.phase.kind) {
          case "blocked":
            display.reason = task.state.assignment.phase.reason;
            break;
          case "working":
            break;
        }
        break;
      case "ready":
      case "completed":
        display.actor = this.agent(task.state.agent);
        break;
      case "integrated":
        display.integration = task.state.commit;
        break;
      case "cancelled":
        display.reason = task.state.reason;
        break;
      case "queued":
        break;
    }
    switch (task.ownership.kind) {
      case "Assigned":
        display.actor = this.agent(task.ownership.assignment.agent);
        display.reportsTo = this.reporting(
          task.ownership.assignment.reports_to,
        ).label;
        break;
      case "Unrecorded":
        break;
    }
    switch (task.common.checkpoint.kind) {
      case "git":
        display.checkpoint = task.common.checkpoint.commit;
        break;
      case "unrecorded":
        break;
    }
    switch (task.workspace.kind) {
      case "read_only":
        display.workspaceLabel = display.workspace = "Read only";
        break;
      case "feature":
        display.workspaceLabel = display.workspace = "Shared feature workspace";
        break;
      case "git":
        display.workspaceLabel = "Git worker";
        display.workspace = `${task.workspace.branch}\n${task.workspace.path}`;
        break;
    }
    display.statusLabel = this.labels[display.status];
    return display;
  }
  static counts(tasks: ReadonlyArray<TaskFlow>): ReadonlyArray<FlowCount> {
    const counts = new Map<FlowState, number>();
    for (const { task } of tasks) {
      const state = this.status(task);
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    return Array.from(counts, ([state, count]) => ({ state, count }));
  }
}
