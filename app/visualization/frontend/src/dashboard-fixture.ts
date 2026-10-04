import type {
  AgentId,
  DesktopReply,
  FeatureWorkflow,
  TaskV2,
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
    const task: TaskV2 = {
      version: 2,
      common: {
        id: "rust-release",
        feature: this.summary.feature.id,
        objective: "Implement the release",
        acceptance: ["Tests pass"],
        dependencies: [],
        revision: 2,
        attempt: 1,
        created_at: this.ago(150),
        last_update: this.ago(130),
        last_progress: this.ago(130),
        checkpoint: { kind: "unrecorded" },
        progress: {
          summary: "Release implemented",
          findings: [],
          next_steps: [],
          checks: [],
          extensions: {},
        },
      },
      ownership: { kind: "Unrecorded" },
      workspace: { kind: "read_only" },
      state: { kind: "completed", agent: Fixture.RUST, attempt: 1 },
    };
    return {
      feature: this.summary.feature.id,
      timing: {
        kind: "Finished",
        started: this.ago(150),
        finished: this.ago(130),
      },
      chapters: [
        {
          task,
          role: { kind: "Recorded", agent: Fixture.RUST },
          status: "completed",
          entries: [
            {
              kind: "created",
              actor: Fixture.PRIME,
              note: "Implement the release",
              summary: "",
              at: this.ago(150),
              revision: 1,
              checkpoint: { kind: "unrecorded" },
              evidence: [],
            },
            {
              kind: "completed",
              actor: Fixture.PRIME,
              note: "Activity accepted",
              summary: "Release implemented",
              at: this.ago(130),
              revision: 2,
              checkpoint: { kind: "unrecorded" },
              evidence: [
                {
                  summary: "Release implemented",
                  findings: ["Checked the manifest"],
                  next_steps: [],
                  checks: [
                    {
                      command: "cargo test -p workbench",
                      outcome: "passed",
                      evidence: "34 passed",
                    },
                  ],
                  extensions: { review_report: "All checks passed" },
                },
              ],
            },
          ],
        },
      ],
    };
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
