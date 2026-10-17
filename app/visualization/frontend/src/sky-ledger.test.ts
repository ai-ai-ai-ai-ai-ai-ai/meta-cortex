import { expect, it } from "vitest";
import type { FeatureWorkflow, FeedEntry } from "./contracts";
import { Fixture } from "./dashboard-fixture";
import {
  AttentionKind,
  DutyKind,
  LeaseKind,
  SkyCondition,
  SkyLedger,
  SkyWorld,
  type SkyLedgerRequest,
} from "./sky-ledger";

/** Builds skies from the recorded release fixture. */
class SkyScenario {
  static readonly TASK = "release-0-12-3/rust-release";
  readonly fixture = new Fixture();
  workflow(): FeatureWorkflow {
    return this.fixture.workflow();
  }
  ledger(workflow: FeatureWorkflow): SkyLedger {
    const request: SkyLedgerRequest = {
      cards: this.fixture.reply().features.records,
      workflows: [workflow],
    };
    return new SkyLedger(request);
  }
  /** Keep only the first entries: the task is claimed and never finished. */
  claimedOnly(): FeatureWorkflow {
    const workflow = this.workflow();
    workflow.revision_log = workflow.revision_log.slice(0, 3);
    return workflow;
  }
  /** The claim records a blocked phase instead of working. */
  blocked(): FeatureWorkflow {
    const workflow = this.claimedOnly();
    for (const log of workflow.revision_log) this.block(log.entry);
    return workflow;
  }
  private block(entry: FeedEntry): void {
    switch (entry.state.kind) {
      case "active":
        entry.state.assignment.phase = {
          kind: "blocked",
          reason: "Release SHA formatting fails",
        };
        return;
      case "queued":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return;
    }
  }
  end(ledger: SkyLedger): number {
    return Math.max(...ledger.events.map((event) => event.entry.at));
  }
}

it("orders every recorded event and names each task's owner and coordinator", () => {
  const scenario = new SkyScenario();
  const ledger = scenario.ledger(scenario.workflow());
  expect(ledger.features.map((feature) => feature.title)).toEqual([
    "Release 0 12 3",
  ]);
  expect(ledger.events.map((event) => event.entry.kind)).toEqual([
    "created",
    "assigned",
    "claimed",
    "checkpoint",
    "checkpoint",
    "ready",
    "integrated",
  ]);
  for (const record of ledger.tasks.find(SkyScenario.TASK)) {
    expect(record.agent).toBe("Development/RustDev");
    expect(record.reportsTo).toBe("Gizmo");
  }
  expect(ledger.tasks.find(SkyScenario.TASK)).toHaveLength(1);
});

it("folds the ledger to the latest instant: integrated work, recorded commits and a released agent", () => {
  const scenario = new SkyScenario();
  const ledger = scenario.ledger(scenario.workflow());
  const world = new SkyWorld(ledger);
  const reached = world.seek(scenario.end(ledger));
  expect(reached).toHaveLength(7);
  const tasks = world.tasks.find(SkyScenario.TASK);
  expect(tasks.map((task) => task.state)).toEqual(["integrated"]);
  const commits = ledger.events.filter(
    (event) =>
      event.entry.kind === "checkpoint" &&
      event.entry.checkpoint.kind === "git",
  ).length;
  expect(tasks.map((task) => task.commits)).toEqual([commits]);
  expect(world.agent("Development/RustDev").duty.kind).toBe(DutyKind.Idle);
  expect(world.condition(world.tasks.values())).toBe(SkyCondition.Waiting);
  expect(world.attention()).toEqual([]);
});

it("rebuilds from the start when seeking back and animates only unseen events", () => {
  const scenario = new SkyScenario();
  const ledger = scenario.ledger(scenario.workflow());
  const world = new SkyWorld(ledger);
  world.seek(scenario.end(ledger));
  const first = Math.min(...ledger.events.map((event) => event.entry.at));
  expect(world.seek(first)).toEqual([]);
  expect(world.tasks.values().map((task) => task.state)).toEqual(["queued"]);
  expect(world.seek(scenario.end(ledger))).toEqual([]);
  expect(world.replace(scenario.ledger(scenario.workflow()))).toEqual([]);
  world.rewind();
  expect(world.seek(scenario.end(ledger))).toHaveLength(7);
});

it("raises a lapsed lease as a lost signal that needs attention", () => {
  const scenario = new SkyScenario();
  const ledger = scenario.ledger(scenario.claimedOnly());
  const world = new SkyWorld(ledger);
  world.seek(Number.MAX_SAFE_INTEGER);
  const agent = world.agent("Development/RustDev");
  expect(agent.duty.kind).toBe(DutyKind.Busy);
  expect(world.lease(agent)).toBe(LeaseKind.Expired);
  expect(world.attention().map((item) => item.kind)).toEqual([
    AttentionKind.Stalled,
  ]);
  expect(world.condition(world.tasks.values())).toBe(SkyCondition.Attention);
});

it("carries the recorded blocker reason into the attention list", () => {
  const scenario = new SkyScenario();
  const ledger = scenario.ledger(scenario.blocked());
  const world = new SkyWorld(ledger);
  world.seek(scenario.end(ledger));
  expect(world.attention().map((item) => [item.kind, item.text])).toEqual([
    [AttentionKind.Blocked, "Release SHA formatting fails"],
  ]);
  expect(world.tasks.values().map((task) => task.state)).toEqual(["blocked"]);
});

it("fades a task's glow with time since its last event", () => {
  const scenario = new SkyScenario();
  const ledger = scenario.ledger(scenario.workflow());
  const world = new SkyWorld(ledger);
  const end = scenario.end(ledger);
  world.seek(end);
  const fresh = world.tasks.values().map((task) => world.heat(task));
  world.seek(end + 10 * SkyWorld.GLOW_MS);
  const faded = world.tasks.values().map((task) => world.heat(task));
  expect(fresh).toEqual([1]);
  expect(faded.every((heat) => heat < 0.01)).toBe(true);
});
