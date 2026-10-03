import { stratify, type HierarchyNode } from "d3-hierarchy";
import type {
  AttemptFlow,
  RecordedActor,
  TaskFlow,
  TaskOwnership,
} from "./contracts";
import { AttemptEvidence } from "./execution-presentation";
import { TaskPresentation } from "./task-presentation";
import { ProgressSummary } from "./progress-presentation";

enum RowKind {
  Reporting,
  Creator,
  Worker,
  Task,
  Attempt,
}
interface RowIdentity {
  id: string;
  label: string;
  kind: RowKind;
}
interface ReportingRow extends RowIdentity {
  parentId: string;
  activities: TaskFlow[];
  status: string;
  ownCounts: string;
  descendantCounts: string;
  checkpoint: string;
  expandInitially: boolean;
  past: { flow: TaskFlow; attempt: AttemptFlow }[];
  attempt?: AttemptFlow;
  attemptCount: number;
  commitCount: number;
  summary: string;
  finished: number;
  total: number;
}
export type ReportingTree = HierarchyNode<ReportingRow>;

/** Projects recorded relationships into D3 nodes consumed directly by TanStack. */
export class ReportingTable {
  readonly root: ReportingTree;
  private readonly groups = new Map<string, ReportingRow>();

  constructor(tasks: ReadonlyArray<TaskFlow>) {
    // The invisible root joins independent recorded and historical trees.
    const root = this.group({ id: "root", label: "", kind: RowKind.Creator });
    root.parentId = "";
    for (const flow of tasks)
      this.worker(flow, flow.worker, flow.task.ownership).activities.push(flow);
    for (const flow of tasks) {
      for (const attempt of flow.attempts.filter(
        (item) =>
          TaskPresentation.actorKey(item.worker) !==
          TaskPresentation.actorKey(flow.worker),
      )) {
        this.worker(flow, attempt.worker, attempt.ownership).past.push({
          flow,
          attempt,
        });
      }
    }
    const groups = Array.from(this.groups.values()).sort(
      (a, b) => a.kind - b.kind,
    );
    const leaves = groups.flatMap((group) =>
      group.activities.map((activity) => ({
        ...group,
        id: `task:${group.id}:${activity.task.common.id}`,
        parentId: group.id,
        label: activity.task.common.id,
        kind: RowKind.Task,
        activities: [activity],
        past: [],
        expandInitially: false,
      })),
    );
    const attempts: ReportingRow[] = [];
    for (const row of leaves) {
      const flow = row.activities[0]!;
      attempts.push(
        ...flow.attempts
          .filter(
            (attempt) =>
              TaskPresentation.actorKey(attempt.worker) ===
              TaskPresentation.actorKey(flow.worker),
          )
          .map((attempt) => this.attemptRow(row, flow, attempt)),
      );
    }
    const previous = groups.flatMap((row) =>
      row.past.map(({ flow, attempt }) => this.attemptRow(row, flow, attempt)),
    );
    this.root = stratify<ReportingRow>()([
      ...groups,
      ...leaves,
      ...attempts,
      ...previous,
    ]);
    this.root.eachAfter((node) => this.present(node));
  }

  private group(identity: RowIdentity): ReportingRow {
    const existing = this.groups.get(identity.id);
    switch (existing) {
      case undefined: {
        const row: ReportingRow = {
          ...identity,
          parentId: "root",
          activities: [],
          status: "",
          ownCounts: "",
          descendantCounts: "",
          checkpoint: "",
          expandInitially: false,
          past: [],
          attemptCount: 0,
          commitCount: 0,
          summary: "",
          finished: 0,
          total: 0,
        };
        this.groups.set(row.id, row);
        return row;
      }
      default:
        return existing;
    }
  }

  private worker(
    flow: TaskFlow,
    actor: RecordedActor,
    ownership: TaskOwnership,
  ): ReportingRow {
    switch (ownership.kind) {
      case "Assigned": {
        const { agent, reports_to } = ownership.assignment;
        const parent = this.group({
          ...TaskPresentation.reporting(reports_to),
          kind: RowKind.Reporting,
        });
        const worker = this.group({
          id: TaskPresentation.actorKey({ kind: "recorded", agent }),
          label: TaskPresentation.agentName(agent),
          kind: RowKind.Reporting,
        });
        worker.parentId = parent.id;
        parent.expandInitially = true;
        return worker;
      }
      case "Unrecorded": {
        const creator = this.group({
          id: `history:${TaskPresentation.actorKey(flow.created_by)}`,
          label: `Created by · ${this.historicalName(flow.created_by)} · reporting unrecorded`,
          kind: RowKind.Creator,
        });
        const worker = this.group({
          id: `${creator.id}:${TaskPresentation.actorKey(actor)}`,
          label: this.historicalName(actor),
          kind: RowKind.Worker,
        });
        worker.parentId = creator.id;
        creator.expandInitially = true;
        return worker;
      }
    }
  }

  private attemptRow(
    parent: ReportingRow,
    flow: TaskFlow,
    attempt: AttemptFlow,
  ): ReportingRow {
    return {
      ...parent,
      id: `${parent.id}:${flow.task.common.id}:attempt:${attempt.attempt}`,
      parentId: parent.id,
      label: `Attempt ${attempt.attempt} · ${flow.task.common.id}`,
      kind: RowKind.Attempt,
      activities: [flow],
      past: [],
      attempt,
      ownCounts: "",
      descendantCounts: "",
      expandInitially: false,
      status: AttemptEvidence.outcomes[attempt.last_event],
      summary: AttemptEvidence.summary(attempt),
      attemptCount: 1,
      commitCount: new Set(
        AttemptEvidence.commits(flow, attempt).map((record) => record.commit),
      ).size,
    };
  }

  private historicalName(actor: RecordedActor): string {
    switch (actor.kind) {
      case "recorded":
        return TaskPresentation.agentName(actor.agent);
      case "unrecorded":
        return "Unrecorded";
    }
  }

  private present(node: ReportingTree): void {
    const row = node.data;
    switch (row.kind) {
      case RowKind.Attempt:
        return;
      case RowKind.Reporting:
      case RowKind.Creator:
      case RowKind.Worker:
      case RowKind.Task:
        break;
    }
    row.activities.sort(TaskPresentation.compareActivity);
    const own = new ProgressSummary(TaskPresentation.counts(row.activities));
    row.finished = own.finished;
    row.total = own.total;
    switch (row.kind) {
      case RowKind.Reporting: {
        row.status = "No activity on this page";
        const descendants = node
          .descendants()
          .filter((child) => child.data.kind === RowKind.Task)
          .flatMap((leaf) => leaf.data.activities);
        const total = new ProgressSummary(TaskPresentation.counts(descendants));
        row.finished = total.finished;
        row.total = total.total;
        switch (total.total - own.total) {
          case 0:
            break;
          default:
            row.descendantCounts = `${total.finished - own.finished}/${total.total - own.total} finished`;
        }
        break;
      }
      case RowKind.Creator:
      case RowKind.Worker:
      case RowKind.Task:
        break;
    }
    const attempts = [
      ...row.activities.flatMap((flow) =>
        flow.attempts
          .filter(
            (attempt) =>
              TaskPresentation.actorKey(attempt.worker) ===
              TaskPresentation.actorKey(flow.worker),
          )
          .map((attempt) => ({ flow, attempt })),
      ),
      ...row.past,
    ];
    row.attemptCount = attempts.length;
    row.commitCount = new Set(
      attempts.flatMap(({ flow, attempt }) =>
        AttemptEvidence.commits(flow, attempt).map((record) => record.commit),
      ),
    ).size;
    row.summary = row.past
      .map(({ attempt }) => AttemptEvidence.summary(attempt))
      .join(" · ");
    const [activity] = row.activities;
    switch (activity) {
      case undefined:
        return;
      default: {
        const display = TaskPresentation.describe(activity.task);
        row.status = display.statusLabel;
        row.checkpoint = display.checkpoint;
        row.summary = AttemptEvidence.currentSummary(activity);
        switch (activity.task.common.checkpoint.kind) {
          case "git":
            row.checkpoint = activity.task.common.checkpoint.commit.slice(0, 7);
            break;
          case "unrecorded":
            break;
        }
      }
    }
    switch (row.kind) {
      case RowKind.Reporting:
      case RowKind.Worker:
        row.ownCounts = own.label;
        break;
      case RowKind.Creator:
      case RowKind.Task:
        break;
    }
  }
}
