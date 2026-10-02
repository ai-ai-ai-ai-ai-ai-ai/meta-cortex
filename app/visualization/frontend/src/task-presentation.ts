import type { TaskV2, FlowState, ReportingTarget } from "./contracts";
export class TaskPresentation {
  constructor(readonly task: TaskV2) {}
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
    switch (this.status()) {
      case "integrated":
        return "Integrated";
      case "completed":
        return "Completed";
      case "working":
        return "In progress";
      case "queued":
        return "Queued";
      case "ready":
        return "Ready";
      case "blocked":
        return "Blocked";
      case "cancelled":
        return "Cancelled";
    }
  }
  actor(): string {
    switch (this.task.ownership.kind) {
      case "Assigned":
        return `${this.task.ownership.assignment.agent.team} / ${this.task.ownership.assignment.agent.role}`;
      case "Unrecorded":
        break;
    }
    switch (this.task.state.kind) {
      case "active":
        return `${this.task.state.assignment.agent.team} / ${this.task.state.assignment.agent.role}`;
      case "ready":
      case "completed":
        return `${this.task.state.agent.team} / ${this.task.state.agent.role}`;
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
        switch (target.coordinator) {
          case "Gizmo":
            return "Team Gizmo";
          case "GizmoPrime":
            return "Gizmo Prime";
        }
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
        return "Read only";
      case "feature":
        return "Shared feature workspace";
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
