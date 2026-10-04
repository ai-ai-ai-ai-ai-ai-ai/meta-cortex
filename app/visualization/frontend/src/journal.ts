import type {
  ActiveWork,
  FeatureOutcome,
  FeatureSummary,
  WorkflowCondition,
} from "./contracts";
import {
  AgentLook,
  ConditionLook,
  Duration,
  StatusLook,
  TimeLook,
  Tone,
  type Look,
} from "./presentation";

interface JournalFrame {
  readonly summaries: ReadonlyArray<FeatureSummary>;
  readonly now: number;
}
interface JournalDay {
  readonly key: string;
  readonly label: string;
  readonly date: string;
  readonly entries: ReadonlyArray<FeatureSummary>;
}
interface ConditionCount {
  readonly label: string;
  readonly tone: Tone;
  readonly count: number;
}
/** Features grouped by the local day of their latest recorded activity, newest first. */
export class Journal {
  static readonly HEADLINE: ReadonlyArray<WorkflowCondition> = [
    "attention",
    "active",
    "waiting",
    "finished",
  ];
  constructor(private readonly frame: JournalFrame) {}
  days(): ReadonlyArray<JournalDay> {
    const sorted = [...this.frame.summaries].sort(
      (left, right) => new Activity(right).last() - new Activity(left).last(),
    );
    const keyed = sorted.map((summary) => ({
      summary,
      key: new FeatureDay({ summary, now: this.frame.now }).key(),
    }));
    return keyed
      .filter(
        (item, index) =>
          keyed.findIndex((other) => other.key === item.key) === index,
      )
      .map((item) => {
        const frame: EntryFrame = {
          summary: item.summary,
          now: this.frame.now,
        };
        const day = new FeatureDay(frame);
        return {
          key: item.key,
          label: day.label(),
          date: day.date(),
          entries: keyed
            .filter((other) => other.key === item.key)
            .map((other) => other.summary),
        };
      });
  }
  conditions(): ReadonlyArray<ConditionCount> {
    return Journal.HEADLINE.map((condition) => {
      const look = new ConditionLook(condition).look();
      const count = this.frame.summaries.filter(
        (summary) => summary.totals.condition === condition,
      ).length;
      return { label: look.label.toLowerCase(), tone: look.tone, count };
    }).filter((condition) => condition.count > 0);
  }
  held(): number {
    return this.frame.summaries.reduce(
      (total, summary) => total + summary.active.length,
      0,
    );
  }
}
interface EntryFrame {
  readonly summary: FeatureSummary;
  readonly now: number;
}
class Activity {
  constructor(private readonly summary: FeatureSummary) {}
  first(): ReadonlyArray<number> {
    const activity = this.summary.totals.activity;
    switch (activity.kind) {
      case "empty":
        return [];
      case "recorded":
        return [activity.first_task_at];
    }
  }
  last(): number {
    const activity = this.summary.totals.activity;
    switch (activity.kind) {
      case "empty":
        return 0;
      case "recorded":
        return activity.last_activity_at;
    }
  }
}
class FeatureDay {
  constructor(private readonly frame: EntryFrame) {}
  key(): string {
    const activity = this.frame.summary.totals.activity;
    switch (activity.kind) {
      case "empty":
        return "empty";
      case "recorded":
        return new Date(activity.last_activity_at).toDateString();
    }
  }
  label(): string {
    const activity = this.frame.summary.totals.activity;
    switch (activity.kind) {
      case "empty":
        return "No activity yet";
      case "recorded":
        return this.name(activity.last_activity_at);
    }
  }
  date(): string {
    const activity = this.frame.summary.totals.activity;
    switch (activity.kind) {
      case "empty":
        return "";
      case "recorded":
        return new TimeLook(this.frame.now).date(activity.last_activity_at);
    }
  }
  private name(at: number): string {
    const days = Math.round(
      (FeatureDay.midnight(this.frame.now) - FeatureDay.midnight(at)) /
        TimeLook.DAY,
    );
    switch (days) {
      case 0:
        return "Today";
      case 1:
        return "Yesterday";
      default:
        return new TimeLook(this.frame.now).weekday(at);
    }
  }
  private static midnight(at: number): number {
    return new Date(at).setHours(0, 0, 0, 0);
  }
}
interface OutcomeChip {
  readonly task: string;
  readonly look: Look;
}
interface Segment {
  readonly label: string;
  readonly tone: Tone;
  readonly count: number;
  readonly share: number;
}
/** One feature as a journal card: what it is for, how far it got, and what needs a person. */
export class JournalEntry {
  static readonly OUTCOMES = 5;
  static readonly QUIET_AFTER = TimeLook.HOUR;
  constructor(private readonly frame: EntryFrame) {}
  status(): Look {
    return new ConditionLook(this.frame.summary.totals.condition).look();
  }
  sentence(): string {
    const { completion, activity } = this.frame.summary.totals;
    switch (activity.kind) {
      case "empty":
        return "No tasks recorded yet";
      case "recorded":
        return [
          `${completion.finished} of ${completion.total} tasks done ${this.span()}`,
          ...[completion.cancelled]
            .filter((cancelled) => cancelled > 0)
            .map((cancelled) => `${cancelled} cancelled`),
          this.delivery(),
        ].join(" · ");
    }
  }
  quiet(): ReadonlyArray<string> {
    const last = new Activity(this.frame.summary).last();
    return new Activity(this.frame.summary)
      .first()
      .filter(() => this.frame.summary.totals.condition !== "finished")
      .filter(() => this.frame.now - last >= JournalEntry.QUIET_AFTER)
      .map(() => `quiet for ${new Duration(this.frame.now - last).label()}`);
  }
  reasons(): ReadonlyArray<string> {
    const time = new TimeLook(this.frame.now);
    const blocked = this.frame.summary.active.flatMap((work) =>
      new HeldWork(work).blocked(),
    );
    const silent = this.frame.summary.active
      .filter((work) => work.lease === "expired")
      .filter((work) => work.blocker.kind === "unblocked")
      .map(
        (work) =>
          `${new AgentLook(work.agent).name()} stopped reporting on ${work.task} ${time.relative(work.last_update)}`,
      );
    return [...blocked, ...silent];
  }
  outcomes(): ReadonlyArray<OutcomeChip> {
    return this.frame.summary.outcomes
      .slice(0, JournalEntry.OUTCOMES)
      .map((outcome: FeatureOutcome) => ({
        task: outcome.task,
        look: new StatusLook(outcome.status).look(),
      }));
  }
  hiddenOutcomes(): number {
    return Math.max(
      0,
      this.frame.summary.outcomes.length - JournalEntry.OUTCOMES,
    );
  }
  segments(): ReadonlyArray<Segment> {
    const total = Math.max(1, this.frame.summary.totals.completion.total);
    return this.frame.summary.totals.counts
      .filter((count) => count.count > 0)
      .map((count) => {
        const look = new StatusLook(count.state).look();
        return {
          label: look.label,
          tone: look.tone,
          count: count.count,
          share: count.count / total,
          rank: new StatusLook(count.state).rank(),
        };
      })
      .sort((left, right) => left.rank - right.rank);
  }
  progress(): string {
    return this.segments()
      .map((segment) => `${segment.count} ${segment.label.toLowerCase()}`)
      .join(", ");
  }
  private span(): string {
    const { summary } = this.frame;
    const first = new Activity(summary).first();
    const took = first.map((at) =>
      new Duration(new Activity(summary).last() - at).label(),
    );
    switch (summary.totals.condition) {
      case "finished":
        return took.map((label) => `in ${label}`).join("");
      case "attention":
      case "active":
      case "waiting":
      case "empty":
        return took.map((label) => `over ${label}`).join("");
    }
  }
  private delivery(): string {
    const latest = this.frame.summary.latest_delivery;
    switch (latest.kind) {
      case "nothing":
        return "nothing delivered yet";
      case "delivered":
        return `last task ${new StatusLook(latest.status).look().label.toLowerCase()} ${new TimeLook(this.frame.now).relative(latest.at)}`;
    }
  }
}
class HeldWork {
  constructor(private readonly work: ActiveWork) {}
  blocked(): ReadonlyArray<string> {
    switch (this.work.blocker.kind) {
      case "unblocked":
        return [];
      case "blocked":
        return [`Blocked: ${this.work.task} — ${this.work.blocker.reason}`];
    }
  }
}
