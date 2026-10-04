import { expect, it } from "vitest";
import type { FeatureSummary } from "./contracts";
import { First, Fixture } from "./dashboard-fixture";
import { Journal, JournalEntry } from "./journal";
import { TimeLook } from "./presentation";

class Recorded {
  private readonly fixture = new Fixture();
  feature(id: string, minutesAgo: number): FeatureSummary {
    const base = this.fixture.summary;
    return {
      ...base,
      feature: { ...base.feature, id },
      totals: {
        ...base.totals,
        activity: {
          kind: "recorded",
          first_task_at: this.fixture.ago(minutesAgo + 30),
          last_activity_at: this.fixture.ago(minutesAgo),
        },
      },
    };
  }
  finished(): FeatureSummary {
    const base = this.fixture.summary;
    return {
      ...base,
      active: [],
      outcomes: [],
      totals: {
        ...base.totals,
        condition: "finished",
        completion: { finished: 9, cancelled: 3, total: 12 },
        activity: {
          kind: "recorded",
          first_task_at: this.fixture.ago(120),
          last_activity_at: this.fixture.ago(67),
        },
      },
      latest_delivery: { kind: "nothing" },
    };
  }
}
const DAY_MINUTES = TimeLook.DAY / Fixture.MINUTE;

it("groups features under the day of their latest activity, newest day first", () => {
  const recorded = new Recorded();
  const summaries = [
    recorded.feature("older", 3 * DAY_MINUTES),
    recorded.feature("morning", 60),
    recorded.feature("yesterday", DAY_MINUTES),
    recorded.feature("latest", 5),
  ];
  const frame = { summaries, now: Fixture.NOW };
  const days = new Journal(frame).days();
  const older = new Date(Fixture.NOW - 3 * TimeLook.DAY);
  expect(days.map((day) => day.label)).toEqual([
    "Today",
    "Yesterday",
    new TimeLook(Fixture.NOW).weekday(older.getTime()),
  ]);
  const today = new First(days).item();
  expect(today.entries.map((summary) => summary.feature.id)).toEqual([
    "latest",
    "morning",
  ]);
  expect(today.date).toBe(new TimeLook(Fixture.NOW).date(Fixture.NOW));
});

it("explains open work: progress, the latest delivery, quiet time and why it is stuck", () => {
  const fixture = new Fixture();
  const frame = { summary: fixture.summary, now: Fixture.NOW };
  const entry = new JournalEntry(frame);
  expect(entry.status().label).toBe("Needs attention");
  expect(entry.sentence()).toBe(
    "1 of 6 tasks done over 50m · last task integrated 2h ago",
  );
  expect(entry.quiet()).toEqual(["quiet for 1h 40m"]);
  expect(entry.reasons()).toEqual([
    "Blocked: rust-review — Release SHA formatting fails",
  ]);
  expect(entry.outcomes().map((outcome) => outcome.task)).toEqual(["prep-pr"]);
  expect(entry.segments().map((segment) => segment.label)).toEqual([
    "Integrated",
    "Awaiting handoff",
    "Working",
    "Blocked",
    "Queued",
  ]);
});

it("summarizes finished work by its duration, cancellations and missing delivery", () => {
  const frame = { summary: new Recorded().finished(), now: Fixture.NOW };
  const entry = new JournalEntry(frame);
  expect(entry.sentence()).toBe(
    "9 of 12 tasks done in 53m · 3 cancelled · nothing delivered yet",
  );
  expect(entry.quiet()).toEqual([]);
  expect(entry.reasons()).toEqual([]);
});

it("names agents whose lease expired and caps the outcome chips", () => {
  const fixture = new Fixture();
  const summary: FeatureSummary = {
    ...fixture.summary,
    active: [
      {
        task: "rust-build",
        agent: Fixture.RUST,
        status: "working",
        lease: "expired",
        blocker: { kind: "unblocked" },
        summary: "",
        last_update: fixture.ago(120),
      },
    ],
    outcomes: ["a", "b", "c", "d", "e", "f", "g"].map((task) =>
      fixture.outcome(task),
    ),
  };
  const frame = { summary, now: Fixture.NOW };
  const entry = new JournalEntry(frame);
  expect(entry.reasons()).toEqual([
    "Rust Dev stopped reporting on rust-build 2h ago",
  ]);
  expect(entry.outcomes()).toHaveLength(JournalEntry.OUTCOMES);
  expect(entry.hiddenOutcomes()).toBe(2);
});

it("headlines feature conditions and the work agents hold", () => {
  const recorded = new Recorded();
  const summaries = [recorded.feature("open", 5), recorded.finished()];
  const frame = { summaries, now: Fixture.NOW };
  const journal = new Journal(frame);
  expect(
    journal
      .conditions()
      .map((condition) => `${condition.count} ${condition.label}`),
  ).toEqual(["1 needs attention", "1 finished"]);
  expect(journal.held()).toBe(2);
});
