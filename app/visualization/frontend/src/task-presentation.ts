import type {
  TaskV2,
  FlowState,
  ReportingTarget,
  AgentId,
  GizmoAgent,
} from "./contracts";
export class TaskPresentation {
  constructor(readonly task: TaskV2) {}
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
        return TaskPresentation.coordinator(agent.role);
      case "Development":
      case "Ai":
      case "Security":
      case "Sre":
      case "Delivery":
        return agent.role;
    }
  }
  status(): FlowState {
    switch (this.task.state.kind) {
      case "active":
        return this.task.state.assignment.phase.kind;
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return this.task.state.kind;
    }
  }
  childStatus(): string {
    const labels: Record<FlowState, string> = {
      integrated: "Integrated",
      completed: "Completed",
      working: "In progress",
      queued: "Queued",
      ready: "Ready",
      blocked: "Blocked",
      cancelled: "Cancelled",
    };
    return labels[this.status()];
  }
  actor(): string {
    switch (this.task.ownership.kind) {
      case "Assigned":
        return TaskPresentation.agent(this.task.ownership.assignment.agent);
      case "Unrecorded":
        break;
    }
    switch (this.task.state.kind) {
      case "active":
        return TaskPresentation.agent(this.task.state.assignment.agent);
      case "ready":
      case "completed":
        return TaskPresentation.agent(this.task.state.agent);
      case "queued":
      case "integrated":
      case "cancelled":
        return "Unrecorded";
    }
  }
  reportsTo(): string {
    switch (this.task.ownership.kind) {
      case "Unrecorded":
        return "Unrecorded";
      case "Assigned":
        return this.reportingTarget(this.task.ownership.assignment.reports_to);
    }
  }
  private reportingTarget(target: ReportingTarget): string {
    switch (target.kind) {
      case "Host":
        return "Host";
      case "Gizmo":
        return TaskPresentation.coordinator(target.coordinator);
    }
  }
  lease(): string {
    switch (this.task.state.kind) {
      case "active":
        return new Date(this.task.state.assignment.expires_at).toLocaleString();
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return "Unrecorded";
    }
  }
  checkpoint(): string {
    switch (this.task.common.checkpoint.kind) {
      case "unrecorded":
        return "Unrecorded";
      case "git":
        return this.task.common.checkpoint.commit;
    }
  }
  integration(): string {
    switch (this.task.state.kind) {
      case "integrated":
        return this.task.state.commit;
      case "queued":
      case "active":
      case "ready":
      case "completed":
      case "cancelled":
        return "Unrecorded";
    }
  }
  workspaceLabel(): string {
    switch (this.task.workspace.kind) {
      case "read_only":
        return "Read only";
      case "feature":
        return "Shared feature workspace";
      case "git":
        return "Git worker";
    }
  }
  workspace(): string {
    switch (this.task.workspace.kind) {
      case "read_only":
      case "feature":
        return this.workspaceLabel();
      case "git":
        return `${this.task.workspace.branch}\n${this.task.workspace.path}`;
    }
  }
  reason(): string {
    switch (this.task.state.kind) {
      case "active":
        switch (this.task.state.assignment.phase.kind) {
          case "working":
            return "";
          case "blocked":
            return this.task.state.assignment.phase.reason;
        }
        break;
      case "cancelled":
        return this.task.state.reason;
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
        return "";
    }
  }
}
