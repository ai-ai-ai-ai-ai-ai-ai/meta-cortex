import type { TaskFlow, RecordedCommit, Milestone } from "./contracts";

enum GitEventKind {
  Checkpoint = "Checkpoint",
  Integration = "Integration",
}
interface CommitEntry {
  flow: TaskFlow;
  record: RecordedCommit;
  kind: GitEventKind;
}
interface ActivityEntry {
  flow: TaskFlow;
  record: Milestone;
}

/** Cross-task views retain every recorded event and its task provenance. */
export class WorkflowEvidence {
  readonly commits: CommitEntry[];
  readonly activity: ActivityEntry[];
  readonly partial: boolean;
  constructor(tasks: ReadonlyArray<TaskFlow>) {
    this.commits = tasks
      .flatMap((flow) => [
        ...flow.checkpoints.map((record) => ({
          flow,
          record,
          kind: GitEventKind.Checkpoint,
        })),
        ...flow.integrations.map((record) => ({
          flow,
          record,
          kind: GitEventKind.Integration,
        })),
      ])
      .sort((a, b) => b.record.at - a.record.at);
    this.activity = tasks
      .flatMap((flow) => flow.milestones.map((record) => ({ flow, record })))
      .sort((a, b) => b.record.at - a.record.at);
    this.partial = tasks.some((flow) => flow.history_end === "More");
  }
}
