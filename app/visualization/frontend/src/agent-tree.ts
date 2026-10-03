import { stratify, type HierarchyNode } from "d3-hierarchy";
import type { RecordedActor, TaskFlow } from "./contracts";
import { TaskPresentation } from "./task-presentation";
import { ProgressSummary } from "./progress-presentation";

enum RowKind {
  Reporting,
  Creator,
  Worker,
  Task,
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
  workspace: string;
  checkpoint: string;
  expandInitially: boolean;
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
    for (const task of tasks) this.record(task);
    const groups = Array.from(this.groups.values()).sort(
      (a, b) => a.kind - b.kind,
    );
    const leaves = groups.flatMap((group) =>
      group.activities.map((activity) => ({
        ...group,
        id: `task:${activity.task.common.id}`,
        parentId: group.id,
        label: activity.task.common.id,
        kind: RowKind.Task,
        activities: [activity],
        expandInitially: false,
      })),
    );
    this.root = stratify<ReportingRow>()([...groups, ...leaves]);
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
          workspace: "",
          checkpoint: "",
          expandInitially: false,
        };
        this.groups.set(row.id, row);
        return row;
      }
      default:
        return existing;
    }
  }

  private record(flow: TaskFlow): void {
    const ownership = flow.task.ownership;
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
        worker.activities.push(flow);
        parent.expandInitially = true;
        return;
      }
      case "Unrecorded": {
        const creator = this.group({
          id: `history:${TaskPresentation.actorKey(flow.created_by)}`,
          label: `Created by · ${this.historicalName(flow.created_by)} · reporting unrecorded`,
          kind: RowKind.Creator,
        });
        const worker = this.group({
          id: `${creator.id}:${TaskPresentation.actorKey(flow.worker)}`,
          label: this.historicalName(flow.worker),
          kind: RowKind.Worker,
        });
        worker.parentId = creator.id;
        worker.activities.push(flow);
        creator.expandInitially = true;
      }
    }
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
    row.activities.sort(TaskPresentation.compareActivity);
    const own = new ProgressSummary(TaskPresentation.counts(row.activities));
    switch (row.kind) {
      case RowKind.Reporting: {
        row.status = "No activity on this page";
        const descendants = node
          .leaves()
          .flatMap((leaf) => leaf.data.activities);
        const total = new ProgressSummary(TaskPresentation.counts(descendants));
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
    const [activity] = row.activities;
    switch (activity) {
      case undefined:
        return;
      default: {
        const display = TaskPresentation.describe(activity.task);
        row.status = display.statusLabel;
        row.workspace = display.workspaceLabel;
        row.checkpoint = display.checkpoint;
        switch (activity.task.common.checkpoint.kind) {
          case "git":
            row.checkpoint = activity.task.common.checkpoint.commit.slice(0, 7);
            break;
          case "unrecorded":
            break;
        }
        switch (activity.task.workspace.kind) {
          case "git":
            row.workspace += ` · ${activity.task.workspace.branch}`;
            break;
          case "feature":
          case "read_only":
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
