import type {
  AttemptFlow,
  FeatureFlow,
  RecordedCommit,
  TaskFlow,
} from "./contracts";

export class WorkTiming {
  static date(at: number): string {
    return new Date(at).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  static duration(start: number, end: number): string {
    const minutes = Math.max(0, Math.floor((end - start) / 60000));
    switch (minutes) {
      case 0:
        return "Less than a minute";
      default:
        return [
          { count: Math.floor(minutes / 1440), unit: "d" },
          { count: Math.floor((minutes % 1440) / 60), unit: "h" },
          { count: minutes % 60, unit: "m" },
        ]
          .filter(({ count }) => count > 0)
          .slice(0, 2)
          .map(({ count, unit }) => `${count}${unit}`)
          .join(" ");
    }
  }
  static feature(flow: FeatureFlow): { label: string; value: string }[] {
    switch (flow.activity.kind) {
      case "empty":
        return [{ label: "Work dates", value: "No tasks recorded" }];
      case "recorded": {
        const { first_task_at, last_activity_at } = flow.activity;
        const pending = flow.counts.some(
          ({ state, count }) =>
            count > 0 &&
            !["integrated", "completed", "cancelled"].includes(state),
        );
        let end = flow.observed_at;
        let label = "Completed work";
        switch (
          flow.counts.some(
            ({ state, count }) => state === "cancelled" && count > 0,
          )
        ) {
          case true:
            label = "Closed work · includes cancelled";
            break;
          case false:
            break;
        }
        let value = "In progress";
        switch (pending) {
          case false:
            end = last_activity_at;
            value = this.date(end);
            break;
          case true:
            break;
        }
        return [
          { label: "First task created", value: this.date(first_task_at) },
          {
            label: "Elapsed work span",
            value: this.duration(first_task_at, end),
          },
          { label, value },
        ];
      }
    }
  }
}

export class AttemptEvidence {
  static currentSummary(flow: TaskFlow): string {
    const attempt = flow.attempts.find(
      (item) => item.attempt === flow.task.common.attempt,
    );
    switch (attempt) {
      case undefined:
        return flow.task.common.progress.summary;
      default:
        return this.summary(attempt);
    }
  }
  static readonly outcomes: Record<AttemptFlow["last_event"], string> = {
    created: "Created",
    assigned: "Assigned",
    claimed: "Started",
    heartbeat: "In progress",
    progress: "Progress recorded",
    checkpoint: "Checkpoint recorded",
    ready: "Ready for review",
    integrated: "Integrated",
    completed: "Completed",
    requeued: "Requeued",
    cancelled: "Cancelled",
  };
  static commits(flow: TaskFlow, attempt: AttemptFlow): RecordedCommit[] {
    return [...flow.checkpoints, ...flow.integrations].filter(
      (record) => record.attempt === attempt.attempt,
    );
  }
  static summary(attempt: AttemptFlow): string {
    switch (attempt.progress.kind) {
      case "recorded":
        return attempt.progress.progress.summary || "No summary recorded";
      case "unrecorded":
        return "No contribution recorded in this attempt";
    }
  }
}
