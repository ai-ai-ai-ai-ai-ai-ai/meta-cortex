import type { TaskFlow, RecordedCommit, Milestone } from "./contracts";

enum GitEventKind {
  Checkpoint = "Checkpoint",
  Integration = "Integration",
}
interface CommitEntry {
  flow: TaskFlow;
  record: RecordedCommit;
  kind: GitEventKind;
  note: string;
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
    const commits = tasks
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
    this.commits = commits.map((entry) => ({
      ...entry,
      note: entry.flow.milestones
        .filter((event) => event.revision === entry.record.revision)
        .map((event) => event.note)
        .join("\n"),
    }));
    this.activity = tasks
      .flatMap((flow) => flow.milestones.map((record) => ({ flow, record })))
      .sort((a, b) => b.record.at - a.record.at);
    this.partial = tasks.some((flow) => flow.history_end === "More");
  }

  /** One SHA may be both a checkpoint and its integration; retain both events. */
  get changes() {
    const hashes = new Set(this.commits.map((entry) => entry.record.commit));
    return Array.from(hashes, (commit) => ({
      commit,
      events: this.commits.filter((entry) => entry.record.commit === commit),
    }));
  }
}
