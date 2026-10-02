import type { Task, FlowState } from "./contracts";
export class TaskPresentation {
  constructor(readonly task: Task) {}
  status(): FlowState {
    switch (this.task.state.kind) {
      case "active":
        return this.task.state.assignment.phase.kind;
      case "queued":
      case "ready":
      case "integrated":
      case "cancelled":
        return this.task.state.kind;
    }
  }
  childStatus(): string {
    switch (this.status()) {
      case "integrated":
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
    switch (this.task.state.kind) {
      case "active":
        return `${this.task.state.assignment.agent.team} / ${this.task.state.assignment.agent.role}`;
      case "ready":
        return `${this.task.state.agent.team} / ${this.task.state.agent.role}`;
      case "queued":
      case "integrated":
      case "cancelled":
        return "Unrecorded";
    }
  }
  lease(): string {
    switch (this.task.state.kind) {
      case "active":
        return new Date(this.task.state.assignment.expires_at).toLocaleString();
      case "queued":
      case "ready":
      case "integrated":
      case "cancelled":
        return "Unrecorded";
    }
  }
  checkpoint(): string {
    switch (this.task.checkpoint.kind) {
      case "unrecorded":
        return "Unrecorded";
      case "git":
        return this.task.checkpoint.commit;
    }
  }
  integration(): string {
    switch (this.task.state.kind) {
      case "integrated":
        return this.task.state.commit;
      case "queued":
      case "active":
      case "ready":
      case "cancelled":
        return "Unrecorded";
    }
  }
  workspace(): string {
    switch (this.task.workspace.kind) {
      case "read_only":
        return "Read only";
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
        return "";
    }
  }
}
