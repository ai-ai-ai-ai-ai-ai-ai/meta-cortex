import type {
  AgentId,
  CheckOutcome,
  FeatureCard,
  FeatureWorkflow,
  FeedEntry,
  FlowState,
  RevisionLogEntry,
  TaskChapter,
} from "./contracts";
import { Match } from "effect";
import { AgentLook } from "./presentation";

/** Whether the lease behind an active assignment is still being renewed. */
export enum LeaseKind {
  Idle = "idle",
  Current = "current",
  Expired = "expired",
}
/** The single headline for a set of tasks; attention outranks progress. */
export enum SkyCondition {
  Empty = "empty",
  Attention = "attention",
  Active = "active",
  Waiting = "waiting",
  Finished = "finished",
}
export enum AttentionKind {
  Blocked = "blocked",
  Stalled = "stalled",
  Failed = "failed",
}
enum OwnerKind {
  Recorded = "recorded",
  Unrecorded = "unrecorded",
}
export enum DutyKind {
  Idle = "idle",
  Busy = "busy",
}
enum CheckKind {
  None = "none",
  Recorded = "recorded",
}
export enum CommitKind {
  None = "none",
  Recorded = "recorded",
}
enum BlockKind {
  Clear = "clear",
  Blocked = "blocked",
}
/** Who a task belongs to; v1 tasks did not record an owner. */
type TaskOwner =
  | { readonly kind: OwnerKind.Recorded; readonly agent: AgentId }
  | { readonly kind: OwnerKind.Unrecorded };
type AgentDuty =
  | { readonly kind: DutyKind.Idle }
  | {
      readonly kind: DutyKind.Busy;
      readonly task: string;
      readonly expires: number;
    };
type LastCheck =
  | { readonly kind: CheckKind.None }
  | {
      readonly kind: CheckKind.Recorded;
      readonly command: string;
      readonly outcome: CheckOutcome;
      readonly at: number;
    };
type LastCommit =
  | { readonly kind: CommitKind.None }
  | { readonly kind: CommitKind.Recorded; readonly commit: string };
type Blockage =
  | { readonly kind: BlockKind.Clear }
  | { readonly kind: BlockKind.Blocked; readonly reason: string };

export interface SkyFeature {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly branch: string;
}
/** One ledger event, ordered across every feature of the repository. */
export interface SkyEvent {
  readonly key: string;
  readonly feature: string;
  readonly task: string;
  readonly sequence: number;
  readonly entry: FeedEntry;
}
interface SkyTaskRecord {
  readonly id: string;
  readonly feature: string;
  readonly objective: string;
  readonly owner: TaskOwner;
  readonly agent: string;
  readonly team: string;
  readonly reportsTo: string;
}
export interface SkyLedgerRequest {
  readonly cards: ReadonlyArray<FeatureCard>;
  readonly workflows: ReadonlyArray<FeatureWorkflow>;
}
type Found<T> = ReadonlyArray<T>;

/** Keyed records; a lookup yields zero or one match instead of an absent value. */
class Keyed<T> {
  private readonly map: Map<string, T>;
  constructor(entries: ReadonlyArray<readonly [string, T]>) {
    this.map = new Map(entries);
  }
  find(key: string): Found<T> {
    return Match.value(this.map.get(key)).pipe(
      Match.when(Match.undefined, (): Found<T> => []),
      Match.orElse((value): Found<T> => [value]),
    );
  }
  set(entry: readonly [string, T]): void {
    this.map.set(entry[0], entry[1]);
  }
  has(key: string): boolean {
    return this.map.has(key);
  }
  values(): ReadonlyArray<T> {
    return [...this.map.values()];
  }
  size(): number {
    return this.map.size;
  }
}
type TaskRecords = Keyed<SkyTaskRecord>;

/** The repository's recorded history, read once per refresh. */
export class SkyLedger {
  static readonly UNRECORDED = "Unrecorded";
  readonly features: ReadonlyArray<SkyFeature>;
  readonly events: ReadonlyArray<SkyEvent>;
  readonly tasks: TaskRecords;
  constructor(request: SkyLedgerRequest) {
    this.features = request.cards.flatMap((card) => this.feature(card));
    const known = new Set(this.features.map((feature) => feature.id));
    const workflows = request.workflows.filter((workflow) =>
      known.has(workflow.feature),
    );
    this.tasks = new Keyed(
      workflows
        .flatMap((workflow) => workflow.chapters)
        .map((chapter) => this.record(chapter))
        .map((record) => [record.id, record] as const),
    );
    this.events = workflows
      .flatMap((workflow) => workflow.revision_log)
      .filter((log) => this.tasks.has(this.taskKey(log)))
      .map((log) => this.event(log))
      .sort((a, b) => a.sequence - b.sequence)
      .sort((a, b) => a.entry.at - b.entry.at);
  }
  /** The first recorded instant; an empty ledger starts at `now`. */
  start(now: number): number {
    return Math.min(now, ...this.events.slice(0, 1).map((e) => e.entry.at));
  }
  record(chapter: TaskChapter): SkyTaskRecord {
    const owner = this.owner(chapter);
    const common = chapter.task.common;
    return {
      id: `${common.feature}/${common.id}`,
      feature: common.feature,
      objective: common.objective,
      owner,
      agent: this.agentKey(owner),
      team: this.team(owner),
      reportsTo: this.reportsTo(chapter),
    };
  }
  agentKey(owner: TaskOwner): string {
    switch (owner.kind) {
      case OwnerKind.Recorded:
        return `${owner.agent.team}/${owner.agent.role}`;
      case OwnerKind.Unrecorded:
        return SkyLedger.UNRECORDED;
    }
  }
  private feature(card: FeatureCard): ReadonlyArray<SkyFeature> {
    switch (card.kind) {
      case "current":
        return [
          {
            id: card.summary.feature.id,
            title: this.title(card.summary.feature.id),
            objective: card.summary.feature.objective,
            branch: card.summary.feature.branch,
          },
        ];
      case "upgrade_required":
      case "unavailable":
        return [];
    }
  }
  /** A readable name from the feature slug, as the workbench shows it. */
  private title(id: string): string {
    const words = id.replace(/-/g, " ");
    return words.slice(0, 1).toUpperCase() + words.slice(1);
  }
  private owner(chapter: TaskChapter): TaskOwner {
    switch (chapter.task.ownership.kind) {
      case "Assigned":
        return {
          kind: OwnerKind.Recorded,
          agent: chapter.task.ownership.assignment.agent,
        };
      case "Unrecorded":
        return this.roleOwner(chapter);
    }
  }
  private roleOwner(chapter: TaskChapter): TaskOwner {
    switch (chapter.role.kind) {
      case "Recorded":
        return { kind: OwnerKind.Recorded, agent: chapter.role.agent };
      case "Unrecorded":
        return { kind: OwnerKind.Unrecorded };
    }
  }
  private team(owner: TaskOwner): string {
    switch (owner.kind) {
      case OwnerKind.Recorded:
        return owner.agent.team;
      case OwnerKind.Unrecorded:
        return SkyLedger.UNRECORDED;
    }
  }
  private reportsTo(chapter: TaskChapter): string {
    switch (chapter.task.ownership.kind) {
      case "Assigned":
        return this.target(chapter.task.ownership.assignment.reports_to);
      case "Unrecorded":
        return "Gizmo";
    }
  }
  private target(
    target: Extract<
      TaskChapter["task"]["ownership"],
      { kind: "Assigned" }
    >["assignment"]["reports_to"],
  ): string {
    switch (target.kind) {
      case "Host":
        return "Host";
      case "Gizmo":
        return target.coordinator;
    }
  }
  private taskKey(log: RevisionLogEntry): string {
    return `${log.feature}/${log.task}`;
  }
  private event(log: RevisionLogEntry): SkyEvent {
    return {
      key: `${log.feature}#${log.sequence}`,
      feature: log.feature,
      task: this.taskKey(log),
      sequence: log.sequence,
      entry: log.entry,
    };
  }
}

export interface SkyTask {
  readonly record: SkyTaskRecord;
  state: FlowState;
  since: number;
  lastAt: number;
  work: number;
  passed: number;
  failed: number;
  commits: number;
  note: string;
  check: LastCheck;
  commit: LastCommit;
  blockage: Blockage;
}
interface AgentStats {
  events: number;
  done: number;
  passed: number;
  failed: number;
  commits: number;
}
export interface SkyAgent {
  readonly key: string;
  readonly team: string;
  readonly name: string;
  readonly owner: TaskOwner;
  duty: AgentDuty;
  worker: string;
  readonly stats: AgentStats;
}
export interface Attention {
  readonly kind: AttentionKind;
  readonly task: SkyTask;
  readonly text: string;
}
export type StateCounts = Record<FlowState, number>;
type SkyTasks = ReadonlyArray<SkyTask>;
type SkyEvents = ReadonlyArray<SkyEvent>;
interface ConditionRule {
  readonly count: number;
  readonly condition: SkyCondition;
}
interface EntryApplication {
  readonly task: SkyTask;
  readonly entry: FeedEntry;
}

/**
 * The ledger folded to one instant. Seeking backwards rebuilds from the
 * start; seeking forwards applies only the new events, which the caller
 * turns into animation cues.
 */
export class SkyWorld {
  static readonly GLOW_MS = 45_000;
  ledger: SkyLedger;
  time = 0;
  tasks = new Keyed<SkyTask>([]);
  agents = new Keyed<SkyAgent>([]);
  private cursor = 0;
  private seen = new Set<string>();
  constructor(ledger: SkyLedger) {
    this.ledger = ledger;
  }
  /** Swap in a fresher ledger and return the events not seen before. */
  replace(ledger: SkyLedger): SkyEvents {
    this.ledger = ledger;
    const time = this.time;
    this.reset();
    return this.seekForward(time);
  }
  /** Move to `time`; returns the events first reached on this move. */
  seek(time: number): SkyEvents {
    switch (time < this.time) {
      case true:
        this.reset();
        break;
      case false:
        break;
    }
    return this.seekForward(time);
  }
  private seekForward(time: number): SkyEvents {
    const reached = this.ledger.events
      .slice(this.cursor)
      .filter((event) => event.entry.at <= time);
    for (const event of reached) this.apply(event);
    this.cursor += reached.length;
    this.time = time;
    const fresh = reached.filter((event) => !this.seen.has(event.key));
    for (const event of fresh) this.seen.add(event.key);
    return fresh;
  }
  private reset(): void {
    this.cursor = 0;
    this.time = 0;
    this.tasks = new Keyed<SkyTask>([]);
    this.agents = new Keyed<SkyAgent>([]);
  }
  /** Forget which events were seen, so a replay animates them again. */
  rewind(): void {
    this.seen = new Set();
    this.reset();
  }
  private apply(event: SkyEvent): void {
    for (const found of this.ledger.tasks.find(event.task)) {
      const task = this.task(found);
      const application: EntryApplication = { task, entry: event.entry };
      this.applyEntry(application);
    }
  }
  private task(record: SkyTaskRecord): SkyTask {
    for (const task of this.tasks.find(record.id)) return task;
    const task: SkyTask = {
      record,
      state: "queued",
      since: 0,
      lastAt: 0,
      work: 0,
      passed: 0,
      failed: 0,
      commits: 0,
      note: record.objective,
      check: { kind: CheckKind.None },
      commit: { kind: CommitKind.None },
      blockage: { kind: BlockKind.Clear },
    };
    this.tasks.set([record.id, task]);
    return task;
  }
  agent(key: string): SkyAgent {
    for (const agent of this.agents.find(key)) return agent;
    const owner = this.ownerFor(key);
    const agent: SkyAgent = {
      key,
      team: this.teamFor(owner),
      name: this.nameFor(owner),
      owner,
      duty: { kind: DutyKind.Idle },
      worker: "",
      stats: { events: 0, done: 0, passed: 0, failed: 0, commits: 0 },
    };
    this.agents.set([key, agent]);
    return agent;
  }
  private ownerFor(key: string): TaskOwner {
    for (const record of this.ledger.tasks
      .values()
      .filter((r) => r.agent === key)
      .slice(0, 1)) {
      return record.owner;
    }
    return { kind: OwnerKind.Unrecorded };
  }
  private teamFor(owner: TaskOwner): string {
    switch (owner.kind) {
      case OwnerKind.Recorded:
        return owner.agent.team;
      case OwnerKind.Unrecorded:
        return SkyLedger.UNRECORDED;
    }
  }
  private nameFor(owner: TaskOwner): string {
    switch (owner.kind) {
      case OwnerKind.Recorded:
        return new AgentLook(owner.agent).name();
      case OwnerKind.Unrecorded:
        return "Unrecorded role";
    }
  }
  private applyEntry(request: EntryApplication): void {
    const { task, entry } = request;
    const state = this.flow(entry);
    switch (state === task.state) {
      case true:
        break;
      case false:
        task.since = entry.at;
    }
    task.state = state;
    task.lastAt = entry.at;
    task.note = [entry.summary, entry.note]
      .filter((text) => text.length > 0)
      .concat(task.note)
      .slice(0, 1)
      .join("");
    task.blockage = this.blockage(entry);
    const checks = entry.evidence.flatMap((progress) => progress.checks);
    task.passed += checks.filter((c) => c.outcome === "passed").length;
    task.failed += checks.filter((c) => c.outcome === "failed").length;
    task.work +=
      this.workWeight(entry) +
      0.5 * checks.filter((c) => c.outcome === "passed").length;
    for (const check of checks.slice(-1)) {
      task.check = {
        kind: CheckKind.Recorded,
        command: check.command,
        outcome: check.outcome,
        at: entry.at,
      };
    }
    this.applyCommit(request);
    this.applyAgent(request);
  }
  private applyCommit(request: EntryApplication): void {
    const { task, entry } = request;
    switch (entry.checkpoint.kind) {
      case "git":
        task.commit = {
          kind: CommitKind.Recorded,
          commit: entry.checkpoint.commit.slice(0, 7),
        };
        task.commits += Number(entry.kind === "checkpoint");
        return;
      case "unrecorded":
        return;
    }
  }
  private applyAgent(request: EntryApplication): void {
    const { task, entry } = request;
    const agent = this.agent(task.record.agent);
    const checks = entry.evidence.flatMap((progress) => progress.checks);
    agent.stats.passed += checks.filter((c) => c.outcome === "passed").length;
    agent.stats.failed += checks.filter((c) => c.outcome === "failed").length;
    agent.stats.commits += Number(entry.kind === "checkpoint");
    agent.stats.done += Number(entry.kind === "completed");
    agent.stats.events += Number(entry.actor.team !== "Gizmo");
    switch (entry.worker.kind) {
      case "Recorded":
        agent.worker = entry.worker.worker_id;
        break;
      case "Unrecorded":
        break;
    }
    switch (entry.state.kind) {
      case "active":
        agent.duty = {
          kind: DutyKind.Busy,
          task: task.record.id,
          expires: entry.state.assignment.expires_at,
        };
        return;
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        this.release({ task, entry });
    }
  }
  private release(request: EntryApplication): void {
    const agent = this.agent(request.task.record.agent);
    switch (agent.duty.kind) {
      case DutyKind.Idle:
        return;
      case DutyKind.Busy:
        switch (agent.duty.task === request.task.record.id) {
          case true:
            agent.duty = { kind: DutyKind.Idle };
            return;
          case false:
            return;
        }
    }
  }
  private workWeight(entry: FeedEntry): number {
    switch (entry.kind) {
      case "progress":
        return 1;
      case "checkpoint":
        return 2;
      case "created":
      case "claimed":
      case "assigned":
      case "heartbeat":
      case "ready":
      case "integrated":
      case "completed":
      case "requeued":
      case "cancelled":
        return 0;
    }
  }
  flow(entry: FeedEntry): FlowState {
    switch (entry.state.kind) {
      case "active":
        return entry.state.assignment.phase.kind;
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return entry.state.kind;
    }
  }
  private blockage(entry: FeedEntry): Blockage {
    switch (entry.state.kind) {
      case "active":
        return this.phaseBlockage(entry.state.assignment.phase);
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return { kind: BlockKind.Clear };
    }
  }
  private phaseBlockage(
    phase: Extract<
      FeedEntry["state"],
      { kind: "active" }
    >["assignment"]["phase"],
  ): Blockage {
    switch (phase.kind) {
      case "working":
        return { kind: BlockKind.Clear };
      case "blocked":
        return { kind: BlockKind.Blocked, reason: phase.reason };
    }
  }
  lease(agent: SkyAgent): LeaseKind {
    switch (agent.duty.kind) {
      case DutyKind.Idle:
        return LeaseKind.Idle;
      case DutyKind.Busy:
        switch (this.time > agent.duty.expires) {
          case true:
            return LeaseKind.Expired;
          case false:
            return LeaseKind.Current;
        }
    }
  }
  /** Recency glow: 1 right after an event, fading over about a minute. */
  heat(task: SkyTask): number {
    const fade = Math.exp(-(this.time - task.lastAt) / SkyWorld.GLOW_MS);
    return Math.max(this.restingHeat(task.state), fade);
  }
  private restingHeat(state: FlowState): number {
    switch (state) {
      case "working":
        return 0.22;
      case "queued":
      case "blocked":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return 0;
    }
  }
  featureTasks(feature: string): SkyTasks {
    return this.tasks.values().filter((t) => t.record.feature === feature);
  }
  counts(tasks: SkyTasks): StateCounts {
    const counts: StateCounts = {
      queued: 0,
      working: 0,
      blocked: 0,
      ready: 0,
      integrated: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const task of tasks) counts[task.state] += 1;
    return counts;
  }
  /** The worker holding this task let its lease lapse. */
  stalled(task: SkyTask): LeaseKind {
    const agent = this.agent(task.record.agent);
    switch (agent.duty.kind) {
      case DutyKind.Idle:
        return LeaseKind.Idle;
      case DutyKind.Busy:
        switch (agent.duty.task === task.record.id) {
          case true:
            return this.lease(agent);
          case false:
            return LeaseKind.Idle;
        }
    }
  }
  condition(tasks: SkyTasks): SkyCondition {
    const counts = this.counts(tasks);
    const lost = tasks.filter(
      (task) => this.stalled(task) === LeaseKind.Expired,
    ).length;
    const rules: ReadonlyArray<ConditionRule> = [
      { count: Number(tasks.length === 0), condition: SkyCondition.Empty },
      { count: counts.blocked + lost, condition: SkyCondition.Attention },
      { count: counts.working, condition: SkyCondition.Active },
      {
        count: counts.queued + counts.ready + counts.integrated,
        condition: SkyCondition.Waiting,
      },
    ];
    for (const rule of rules.filter((r) => r.count > 0).slice(0, 1)) {
      return rule.condition;
    }
    return SkyCondition.Finished;
  }
  /** What a person must see first: blockers, lost workers, failed checks. */
  attention(): ReadonlyArray<Attention> {
    return this.tasks.values().flatMap((task) => this.concern(task));
  }
  private concern(task: SkyTask): ReadonlyArray<Attention> {
    switch (task.state) {
      case "blocked":
        return [
          {
            kind: AttentionKind.Blocked,
            task,
            text: this.reason(task.blockage),
          },
        ];
      case "working":
        return this.workingConcern(task);
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return [];
    }
  }
  private reason(blockage: Blockage): string {
    switch (blockage.kind) {
      case BlockKind.Blocked:
        return blockage.reason;
      case BlockKind.Clear:
        return "Blocked";
    }
  }
  private workingConcern(task: SkyTask): ReadonlyArray<Attention> {
    switch (this.stalled(task)) {
      case LeaseKind.Expired:
        return [
          {
            kind: AttentionKind.Stalled,
            task,
            text: "Lease expired · no heartbeat",
          },
        ];
      case LeaseKind.Idle:
      case LeaseKind.Current:
        return this.checkConcern(task);
    }
  }
  private checkConcern(task: SkyTask): ReadonlyArray<Attention> {
    switch (task.check.kind) {
      case CheckKind.None:
        return [];
      case CheckKind.Recorded:
        switch (
          task.check.outcome === "failed" &&
          this.time - task.check.at < SkyWorld.GLOW_MS
        ) {
          case true:
            return [
              {
                kind: AttentionKind.Failed,
                task,
                text: `✕ ${task.check.command}`,
              },
            ];
          case false:
            return [];
        }
    }
  }
}
