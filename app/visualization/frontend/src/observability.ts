import { Match, Predicate } from "effect";
import type { EvidenceSelection } from "./feature-log";
import type {
  FeatureSummary,
  FeatureWorkflow,
  TaskChapter,
  FeedEntry,
  EventKind,
  FlowState,
  Progress,
  FeatureLogEntry,
} from "./contracts";
import { AgentLook } from "./presentation";
import {
  FilePlus,
  UserPlus,
  Play,
  HeartPulse,
  AlignLeft,
  GitCommitHorizontal,
  Flag,
  GitMerge,
  Check,
  RotateCcw,
  X,
} from "@lucide/svelte";
export enum Screen {
  Features = "Features",
  Workflow = "Workflow",
}
export enum WorkflowView {
  FeatureLog = "Feature log",
  Log = "Log",
  Windows = "Time windows",
  Revisions = "Revision log",
}
export enum WorkflowOpeningKind {
  Feature = "Feature",
  Task = "Task",
}
export type WorkflowOpening =
  | { readonly kind: WorkflowOpeningKind.Feature }
  | {
      readonly kind: WorkflowOpeningKind.Task;
      readonly task: FeatureLogEntry["task"];
    };
export class RecordedEventNavigation {
  constructor(private readonly target: EvidenceSelection) {}
  id(): string {
    return `event-${this.target.task}-r${this.target.revision}`;
  }
  open(): void {
    Match.value(document.getElementById(this.id())).pipe(
      Match.when(Match.instanceOf(HTMLDetailsElement), (event) => {
        event.open = true;
        const position: ScrollIntoViewOptions = { block: "start" };
        event.scrollIntoView(position);
        Match.value(event.querySelector("summary")).pipe(
          Match.when(Match.instanceOf(HTMLElement), (summary) =>
            summary.focus(),
          ),
          Match.orElse(() => {}),
        );
      }),
      Match.orElse(() => {}),
    );
  }
}
export class WorkflowTabs {
  static readonly VIEWS = [
    WorkflowView.FeatureLog,
    WorkflowView.Log,
    WorkflowView.Windows,
    WorkflowView.Revisions,
  ];
  static id(view: WorkflowView): string {
    return `workflow-tab-${view.replaceAll(" ", "-")}`;
  }
  constructor(readonly selected: WorkflowView) {}
  next(key: string): ReadonlyArray<WorkflowView> {
    const tabs = WorkflowTabs.VIEWS;
    const index = tabs.indexOf(this.selected);
    switch (key) {
      case "ArrowRight":
        return tabs.concat(tabs).slice(index + 1, index + 2);
      case "ArrowLeft":
        return tabs
          .concat(tabs)
          .slice(index + tabs.length - 1, index + tabs.length);
      case "Home":
        return tabs.slice(0, 1);
      case "End":
        return tabs.slice(-1);
      default:
        return [];
    }
  }
  focus(): void {
    Match.value(document.getElementById(WorkflowTabs.id(this.selected))).pipe(
      Match.when(Match.instanceOf(HTMLElement), (tab) => tab.focus()),
      Match.orElse(() => {}),
    );
  }
  tabIndex(tab: WorkflowView): number {
    switch (tab === this.selected) {
      case true:
        return 0;
      case false:
        return -1;
    }
  }
}
export enum FeatureFilter {
  All = "All",
  Attention = "Blocked",
  Ready = "Handoff ready",
  Active = "In progress",
  Closed = "Tasks closed",
}
export class FeatureLook {
  constructor(readonly summary: FeatureSummary) {}
  title(): string {
    return this.summary.feature.id
      .replace(/[-_]/g, " ")
      .replace(/^./, (letter) => letter.toUpperCase());
  }
  started(): ReadonlyArray<number> {
    switch (this.summary.totals.activity.kind) {
      case "empty":
        return [];
      case "recorded":
        return [this.summary.totals.activity.first_task_at];
    }
  }
  open(): number {
    const c = this.summary.totals.completion;
    return c.total - c.finished - c.cancelled;
  }
  label(): string {
    switch (this.summary.totals.condition) {
      case "empty":
        return "No tasks yet";
      case "attention":
        return "Needs attention";
      case "active":
        return "In progress";
      case "waiting":
        return "Queued";
      case "finished":
        return "Tasks closed";
    }
  }
  matches(filter: FeatureFilter): boolean {
    switch (filter) {
      case FeatureFilter.All:
        return true;
      case FeatureFilter.Attention:
        return this.summary.totals.condition === "attention";
      case FeatureFilter.Ready:
        return this.summary.totals.counts.some(
          (count) => count.state === "ready" && count.count > 0,
        );
      case FeatureFilter.Active:
        return this.summary.totals.condition === "active";
      case FeatureFilter.Closed:
        return this.summary.totals.condition === "finished";
    }
  }
  signals(): ReadonlyArray<string> {
    const labels: Partial<Record<FlowState, string>> = {
      blocked: "blocked",
      working: "active",
      ready: "ready",
      queued: "queued",
    };
    const signals = this.summary.totals.counts
      .filter((count) => count.count > 0 && Object.hasOwn(labels, count.state))
      .map((count) => `${count.count} ${labels[count.state]}`);
    switch (signals.length) {
      case 0:
        return [this.label()];
      default:
        return signals;
    }
  }
  segments(): ReadonlyArray<string> {
    const c = this.summary.totals.completion;
    return [
      ...Array<string>(c.finished).fill("finished"),
      ...Array<string>(c.cancelled).fill("cancelled"),
      ...Array<string>(this.open()).fill("open"),
    ];
  }
}
export class RecordedTime {
  static readonly ZONE = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  static readonly ZONE_LABEL = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "longGeneric",
  })
    .formatToParts()
    .filter((part) => part.type === "timeZoneName")
    .map((part) => part.value.replace(/ Time$/, ""))
    .join("");
  static readonly DATE: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  static readonly CLOCK: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  static readonly FULL: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  constructor(readonly at: number) {}
  card(): string {
    return `${new Intl.DateTimeFormat("en-US", RecordedTime.DATE).format(this.at)} · ${this.clock()}`;
  }
  clock(): string {
    return new Intl.DateTimeFormat("en-US", RecordedTime.CLOCK).format(this.at);
  }
  full(): string {
    return new Intl.DateTimeFormat("en-US", RecordedTime.FULL).format(this.at);
  }
  iso(): string {
    return new Date(this.at).toISOString();
  }
}
export class WorkflowLook {
  static readonly EMPTY_TIMELINE = "No recorded task lifetimes or events.";
  constructor(readonly workflow: FeatureWorkflow) {}
  roles(): ReadonlyArray<string> {
    return [
      ...new Set(
        this.workflow.chapters.flatMap((chapter) =>
          chapter.entries.map((entry) => new AgentLook(entry.actor).name()),
        ),
      ),
    ];
  }
  inventory(): ReadonlyArray<TaskChapter> {
    const rank: Record<string, number> = { finished: 0, cancelled: 1, open: 2 };
    return [...this.workflow.chapters].sort(
      (a, b) =>
        Number(rank[new ChapterLook(a).block()]) -
        Number(rank[new ChapterLook(b).block()]),
    );
  }
  latest(): ReadonlyArray<FeedEntry> {
    return this.workflow.chapters
      .flatMap((chapter) => chapter.entries)
      .sort((a, b) => b.at - a.at)
      .slice(0, 1);
  }
  started(): ReadonlyArray<number> {
    switch (this.workflow.timing.kind) {
      case "Empty":
        return [];
      case "Running":
      case "Finished":
        return [this.workflow.timing.started];
    }
  }
  finished(): ReadonlyArray<number> {
    switch (this.workflow.timing.kind) {
      case "Empty":
      case "Running":
        return [];
      case "Finished":
        return [this.workflow.timing.finished];
    }
  }
  duration(): string {
    switch (this.workflow.timing.kind) {
      case "Empty":
      case "Running":
        return "—";
      case "Finished":
        return new Elapsed(
          this.workflow.timing.finished - this.workflow.timing.started,
        ).label();
    }
  }
  events(): number {
    return this.workflow.chapters.reduce(
      (sum, chapter) => sum + chapter.entries.length,
      0,
    );
  }
}
export class Elapsed {
  constructor(private readonly ms: number) {}
  compact(): string {
    const seconds = Math.round(Math.max(0, this.ms) / 1000);
    switch (Math.floor(seconds / 60)) {
      case 0:
        return `${seconds}s`;
      default:
        return `${Math.round(seconds / 60)}m`;
    }
  }
  exact(): string {
    return `${Math.max(0, this.ms) / 1000}s`;
  }
  label(): string {
    const minutes = Math.round(Math.max(0, this.ms) / 60000);
    switch (this.ms < 60000) {
      case true:
        return `${Math.round(Math.max(0, this.ms) / 1000)} sec`;
      case false:
        return [
          { value: Math.floor(minutes / 1440), unit: "d" },
          { value: Math.floor((minutes % 1440) / 60), unit: "h" },
          { value: minutes % 60, unit: "min" },
        ]
          .filter((part) => part.value > 0)
          .map((part) => `${part.value} ${part.unit}`)
          .join(" ");
    }
  }
}
export class ChapterLook {
  constructor(readonly chapter: TaskChapter) {}
  agent(): string {
    switch (this.chapter.role.kind) {
      case "Unrecorded":
        return "Role unrecorded";
      case "Recorded":
        return new AgentLook(this.chapter.role.agent).name();
    }
  }
  reporting(): string {
    const ownership = this.chapter.task.ownership;
    switch (ownership.kind) {
      case "Unrecorded":
        return this.unrecorded();
      case "Assigned":
        switch (ownership.assignment.reports_to.kind) {
          case "Host":
            return "Reports to host";
          case "Gizmo":
            return `Reports to ${AgentLook.ROLES[ownership.assignment.reports_to.coordinator]}`;
        }
    }
  }
  private unrecorded(): string {
    switch (this.chapter.role.kind) {
      case "Unrecorded":
        return "Reporting line and agent role unrecorded";
      case "Recorded":
        return "Reporting line unrecorded · role from recorded claim";
    }
  }
  mark(): string {
    return this.agent()
      .split(" ")
      .map((word) => word.slice(0, 1))
      .join("")
      .slice(0, 2);
  }
  block(): string {
    return new TaskBlock(this.chapter.status).label();
  }
}
class TaskBlock {
  constructor(private readonly status: FlowState) {}
  label(): string {
    switch (this.status) {
      case "completed":
      case "integrated":
        return "finished";
      case "cancelled":
        return "cancelled";
      case "queued":
      case "working":
      case "blocked":
      case "ready":
        return "open";
    }
  }
}
interface ActionAppearance {
  readonly kind: EventKind;
  readonly label: string;
  readonly icon: typeof Check;
}
export class ActionLook {
  static readonly TEXT = {
    recordedBy: "Recorded by",
    task: "Task",
    assignedTo: "Assigned to",
    reportsTo: "Reports to",
    unrecorded: "Unrecorded",
    host: "Host",
    revision: "revision",
    taskRevision: "Task r",
  };
  static readonly LOOKS: Record<EventKind, ActionAppearance> = {
    created: { kind: "created", label: "Task created", icon: FilePlus },
    assigned: {
      kind: "assigned",
      label: "Assignment recorded",
      icon: UserPlus,
    },
    claimed: { kind: "claimed", label: "Task claimed", icon: Play },
    heartbeat: { kind: "heartbeat", label: "Heartbeat", icon: HeartPulse },
    progress: { kind: "progress", label: "Progress update", icon: AlignLeft },
    checkpoint: {
      kind: "checkpoint",
      label: "Checkpoint recorded",
      icon: GitCommitHorizontal,
    },
    ready: { kind: "ready", label: "Ready for handoff", icon: Flag },
    integrated: {
      kind: "integrated",
      label: "Integration recorded",
      icon: GitMerge,
    },
    completed: { kind: "completed", label: "Activity accepted", icon: Check },
    requeued: { kind: "requeued", label: "Task requeued", icon: RotateCcw },
    cancelled: { kind: "cancelled", label: "Task cancelled", icon: X },
  };
  recipient(): string {
    switch (this.entry.ownership.kind) {
      case "Unrecorded":
        return ActionLook.TEXT.unrecorded;
      case "Assigned":
        return new AgentLook(this.entry.ownership.assignment.agent).name();
    }
  }
  reporting(): string {
    switch (this.entry.ownership.kind) {
      case "Unrecorded":
        return ActionLook.TEXT.unrecorded;
      case "Assigned":
        switch (this.entry.ownership.assignment.reports_to.kind) {
          case "Host":
            return ActionLook.TEXT.host;
          case "Gizmo":
            return AgentLook.ROLES[
              this.entry.ownership.assignment.reports_to.coordinator
            ];
        }
    }
  }
  constructor(readonly entry: FeedEntry) {}
  label(): string {
    return ActionLook.LOOKS[this.entry.kind].label;
  }
  icon(): typeof Check {
    return ActionLook.LOOKS[this.entry.kind].icon;
  }
}

export enum Disclosure {
  Closed = "Closed",
  Open = "Open",
}
export interface EvidenceBlock {
  readonly key: string;
  readonly text: string;
}
export class EvidenceLook {
  constructor(readonly progress: Progress) {}
  private text(value: unknown): string {
    return Match.value(value).pipe(
      Match.when(Predicate.isString, (text) => text),
      Match.orElse((data) => JSON.stringify(data, null, 2)),
    );
  }
  blocks(): ReadonlyArray<EvidenceBlock> {
    return Match.value(this.progress.extensions).pipe(
      Match.when(Predicate.isObject, (record) =>
        Object.entries(record).map(([key, value]) => ({
          key,
          text: this.text(value),
        })),
      ),
      Match.orElse(() => []),
    );
  }
}
export class ChapterNavigation {
  constructor(private readonly id: string) {}
  focus(): void {
    Match.value(document.getElementById(`heading-${this.id}`)).pipe(
      Match.when(Match.instanceOf(HTMLElement), (element) => element.focus()),
      Match.orElse(() => {}),
    );
  }
  jump(): void {
    const node = document.getElementById(`task-${this.id}`);
    Match.value(node).pipe(
      Match.when(Match.instanceOf(HTMLElement), (element) =>
        element.scrollIntoView({ block: "start" }),
      ),
      Match.orElse(() => {}),
    );
  }
}
