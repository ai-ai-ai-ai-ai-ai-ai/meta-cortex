import type {
  TaskV2,
  TaskFlow,
  FlowState,
  FlowCount,
  RecordedActor,
  AgentId,
  GizmoAgent,
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
export class TaskPresentation {
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
  static coordinator(coordinator: GizmoAgent): string {
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
  static actor(actor: RecordedActor): string {
    switch (actor.kind) {
      case "recorded":
        return this.agent(actor.agent);
      case "unrecorded":
        return "Assignment unrecorded";
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
  static describe(task: TaskV2): TaskDisplay {
    const display: TaskDisplay = {
      status: "queued",
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
        display.status = task.state.assignment.phase.kind;
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
        display.status = task.state.kind;
        display.actor = this.agent(task.state.agent);
        break;
      case "integrated":
        display.status = task.state.kind;
        display.integration = task.state.commit;
        break;
      case "cancelled":
        display.status = task.state.kind;
        display.reason = task.state.reason;
        break;
      case "queued":
        break;
    }
    switch (task.ownership.kind) {
      case "Assigned":
        display.actor = this.agent(task.ownership.assignment.agent);
        switch (task.ownership.assignment.reports_to.kind) {
          case "Host":
            display.reportsTo = "Host";
            break;
          case "Gizmo":
            display.reportsTo = this.coordinator(
              task.ownership.assignment.reports_to.coordinator,
            );
            break;
        }
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
      const state = this.describe(task).status;
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    return Array.from(counts, ([state, count]) => ({ state, count }));
  }
}
