import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { Fixture } from "./dashboard-fixture";
import { ReportingTable } from "./agent-tree";
import { WorkTiming } from "./execution-presentation";
import type { AttemptFlow } from "./contracts";
import Attempts from "./Attempts.svelte";
import Workflow from "./Workflow.svelte";

afterEach(cleanup);

it("keeps feature timing independent of loaded tasks and distinguishes unfinished or cancelled work", () => {
  const fixture = new Fixture();
  fixture.flow.activity = {
    kind: "recorded",
    first_task_at: 60000,
    last_activity_at: 3660000,
  };
  fixture.flow.observed_at = 7260000;
  fixture.flow.counts = [
    { state: "completed", count: 100 },
    { state: "queued", count: 1 },
  ];
  expect(WorkTiming.feature(fixture.flow)).toContainEqual({
    label: "Completed work",
    value: "In progress",
  });
  expect(WorkTiming.feature(fixture.flow)).toContainEqual({
    label: "Elapsed work span",
    value: "2h",
  });
  fixture.flow.tasks.records = [];
  fixture.flow.counts = [{ state: "completed", count: 101 }];
  expect(WorkTiming.feature(fixture.flow)).toContainEqual({
    label: "Completed work",
    value: WorkTiming.date(3660000),
  });
  expect(WorkTiming.feature(fixture.flow)).toContainEqual({
    label: "Elapsed work span",
    value: "1h",
  });
  fixture.flow.counts.push({ state: "cancelled", count: 1 });
  expect(WorkTiming.feature(fixture.flow)).toContainEqual({
    label: "Closed work · includes cancelled",
    value: WorkTiming.date(3660000),
  });
  fixture.flow.activity = { kind: "empty" };
  expect(WorkTiming.feature(fixture.flow)).toEqual([
    { label: "Work dates", value: "No tasks recorded" },
  ]);
});

class RetryFixture extends Fixture {
  first: AttemptFlow = {
    attempt: 1,
    worker: {
      kind: "recorded",
      agent: { team: "Development", role: "RustDev" },
    },
    ownership: {
      kind: "Assigned",
      assignment: {
        agent: { team: "Development", role: "RustDev" },
        reports_to: { kind: "Gizmo", coordinator: "Gizmo" },
      },
    },
    started: { kind: "recorded", at: 1000 },
    updated_at: 1800,
    last_event: "requeued",
    progress: {
      kind: "recorded",
      progress: {
        ...this.task.common.progress,
        summary: "Delivered storage reads",
        findings: ["Validated concurrent readers"],
      },
    },
  };
  second: AttemptFlow = {
    attempt: 2,
    worker: this.contribution.worker,
    ownership: this.task.ownership,
    started: { kind: "unrecorded" },
    updated_at: 2000,
    last_event: "claimed",
    progress: { kind: "unrecorded" },
  };
  constructor() {
    super();
    this.task.common.attempt = 2;
    this.task.state = {
      kind: "active",
      assignment: {
        agent: { team: "Development", role: "TypescriptDev" },
        attempt: 2,
        expires_at: 3000,
        phase: { kind: "working" },
      },
    };
    this.contribution.attempts = [this.second, this.first];
    this.contribution.integrations = [];
    this.contribution.checkpoints[0]!.actor = {
      team: "Development",
      role: "RustDev",
    };
  }
}

it("shows previous workers without giving their commits or delivered results to the new assignee", () => {
  const fixture = new RetryFixture();
  const tree = new ReportingTable([fixture.contribution]).root;
  const previous = tree.find((node) => node.data.label === "RustDev");
  const current = tree.find((node) => node.data.label === "TypescriptDev");
  expect(previous?.data).toMatchObject({
    attemptCount: 1,
    commitCount: 1,
    summary: "Delivered storage reads",
    activities: [],
  });
  expect(current?.data).toMatchObject({
    attemptCount: 1,
    commitCount: 0,
    summary: "No contribution recorded in this attempt",
    ownCounts: "0/1 finished",
  });
  expect(previous?.parent?.data.label).toBe("Team Gizmo");
  expect(tree.children?.[0]?.data.descendantCounts).toBe("0/1 finished");
});

it("puts dates and the agent tree on the main view with expandable attempt evidence", async () => {
  const fixture = new RetryFixture();
  const select = vi.fn();
  render(Workflow, { flow: fixture.flow, select });
  expect(screen.getByText("First task created")).toBeTruthy();
  const tree = screen.getByRole("table", {
    name: "Recorded reporting and activities",
  });
  expect(within(tree).getByText("RustDev")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
  await userEvent.click(
    within(tree).getByRole("button", { name: "Expand RustDev" }),
  );
  const attempt = within(tree).getByRole("row", { name: /Attempt 1/ });
  expect(within(attempt).getByText("Delivered storage reads")).toBeTruthy();
  expect(within(attempt).getByText("Requeued")).toBeTruthy();
  await userEvent.click(
    within(attempt).getByRole("button", { name: "Open task implement" }),
  );
  expect(select).toHaveBeenCalledWith(fixture.contribution);
});

it("keeps complete attempt results, check evidence and commit recorders available", async () => {
  const fixture = new RetryFixture();
  fixture.contribution.history_end = "More";
  fixture.first.progress = {
    kind: "recorded",
    progress: {
      ...fixture.task.common.progress,
      summary: "Delivered storage reads",
      findings: ["Validated concurrent readers"],
      checks: [
        {
          command: "cargo test",
          outcome: "passed",
          evidence: "Concurrent writer kept running",
        },
      ],
    },
  };
  render(Attempts, { flow: fixture.contribution });
  expect(screen.getByText("2 shown · 2 total task attempts")).toBeTruthy();
  expect(screen.getByText(/latest 100 events/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /Attempt 1/ }));
  expect(screen.getByText("Validated concurrent readers")).toBeTruthy();
  expect(screen.getByText("Concurrent writer kept running")).toBeTruthy();
  expect(screen.getByText("Recorded by RustDev")).toBeTruthy();
  expect(screen.getByText("aaaaaaaa").getAttribute("title")).toBe(
    "a".repeat(40),
  );
  await userEvent.click(screen.getByRole("button", { name: /Attempt 2/ }));
  expect(screen.getByText(/Start not in loaded history/)).toBeTruthy();
  expect(screen.getByText("No commit recorded in this attempt.")).toBeTruthy();
});
