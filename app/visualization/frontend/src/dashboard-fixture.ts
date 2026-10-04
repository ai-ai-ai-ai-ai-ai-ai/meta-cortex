import { Match } from "effect";
import fixtureWorkflow from "./workflow-fixture.json";
import { workflow } from "virtual:dashboard-validators";
import type {
  AgentId,
  DesktopReply,
  FeatureWorkflow,
  FeatureOutcome,
  FeatureSummary,
} from "./contracts";

/**
 * A recorded release: the version bump is integrated, review is blocked on
 * its SHA format, and the pull request task is the only remaining outcome.
 */
export class Fixture {
  static readonly NOW = new Date(2026, 9, 3, 12).getTime();
  static readonly MINUTE = 60_000;
  static readonly PRIME: AgentId = { team: "Gizmo", role: "GizmoPrime" };
  static readonly RUST: AgentId = { team: "Development", role: "RustDev" };
  static readonly VERIFIER: AgentId = {
    team: "Development",
    role: "RustVerifier",
  };
  summary: FeatureSummary = {
    feature: {
      version: 1,
      id: "release-0-12-3",
      objective: "Ship the 0.12.3 release with a reviewed Scoop manifest.",
      branch: "codex/release-0-12-3",
      worktree: "/work/release",
    },
    totals: {
      counts: [
        { state: "queued", count: 1 },
        { state: "working", count: 2 },
        { state: "blocked", count: 1 },
        { state: "ready", count: 1 },
        { state: "integrated", count: 1 },
        { state: "completed", count: 0 },
        { state: "cancelled", count: 0 },
      ],
      completion: { finished: 1, cancelled: 0, total: 6 },
      stalled: 0,
      activity: {
        kind: "recorded",
        first_task_at: this.ago(150),
        last_activity_at: this.ago(100),
      },
      condition: "attention",
    },
    actors: [Fixture.PRIME, Fixture.RUST, Fixture.VERIFIER],
    active: [
      {
        task: "prime",
        agent: Fixture.PRIME,
        status: "working",
        lease: "current",
        blocker: { kind: "unblocked" },
        summary: "",
        last_update: this.ago(100),
      },
      {
        task: "rust-review",
        agent: Fixture.VERIFIER,
        status: "blocked",
        lease: "current",
        blocker: { kind: "blocked", reason: "Release SHA formatting fails" },
        summary: "Release SHA formatting fails",
        last_update: this.ago(110),
      },
    ],
    pull_requests: [
      {
        url: "https://github.com/acme/release/pull/41",
        repository: "acme/release",
        number: 41,
        tasks: ["prep-pr"],
        recorded_at: this.ago(100),
      },
    ],
    outcomes: [this.outcome("prep-pr")],
    latest_delivery: {
      kind: "delivered",
      task: "rust-release",
      status: "integrated",
      at: this.ago(130),
    },
  };
  workflow(): FeatureWorkflow {
    return Match.value(fixtureWorkflow).pipe(
      Match.when(workflow, (value) => structuredClone(value)),
      Match.orElse(() => {
        throw new Error("Regenerate the Rust workflow fixture");
      }),
    );
  }
  reply(): DesktopReply {
    return { features: { records: [this.summary], end: "Complete" } };
  }
  /** A timestamp the given number of minutes before `Fixture.NOW`. */
  ago(minutes: number): number {
    return Fixture.NOW - minutes * Fixture.MINUTE;
  }
  outcome(task: string): FeatureOutcome {
    return { task, status: "queued", last_update: this.ago(100) };
  }
}
