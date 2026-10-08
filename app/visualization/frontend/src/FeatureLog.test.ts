import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import type { FeatureLogEntry } from "./contracts";
import { Fixture } from "./dashboard-fixture";
import { RecordedTime } from "./observability";
import FeatureLog from "./FeatureLog.svelte";
import type { EvidenceSelection } from "./feature-log";

type FeatureLogProps = ComponentProps<typeof FeatureLog>;
type RoleQueryOptions = NonNullable<Parameters<typeof screen.getByRole>[1]>;
type FeatureLogEntries = ReadonlyArray<FeatureLogEntry>;
type TextQueryOptions = NonNullable<Parameters<typeof screen.getByText>[1]>;

afterEach(cleanup);

class FeatureLogScenario {
  static readonly EVIDENCE: TextQueryOptions = { selector: "summary span" };
  readonly workflow = new Fixture().workflow();
  readonly onselect = vi.fn();
  readonly onevidence = vi.fn();

  render(entries: FeatureLogEntries): void {
    const meanings = this.workflow.state_meanings.filter(
      (meaning) => meaning.state === "integrated",
    );
    expect(meanings).toHaveLength(1);
    for (const integrationMeaning of meanings) {
      const props: FeatureLogProps = {
        entries,
        integrationMeaning,
        onselect: this.onselect,
        onevidence: this.onevidence,
      };
      render(FeatureLog, props);
    }
  }
}

it("retains same-summary milestones sharing one checkpoint in their supplied order", async () => {
  const scenario = new FeatureLogScenario();
  const entries = scenario.workflow.feature_log.slice().reverse();
  expect(entries).toHaveLength(2);
  for (const entry of entries) entry.summary = "Updated release files";
  scenario.render(entries);
  const headingQuery: RoleQueryOptions = { name: "Updated release files" };
  expect(screen.getAllByRole("heading", headingQuery)).toHaveLength(2);
  const rows = screen.getAllByRole("article");
  expect(rows).toHaveLength(2);
  for (const row of rows)
    await fireEvent.click(
      within(row).getByText("Evidence", FeatureLogScenario.EVIDENCE),
    );
  expect(
    rows.map((row) => row.querySelector(".evidence-fields dd")?.textContent),
  ).toEqual(entries.map((entry) => entry.id));
  expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
  expect(new Set(entries.map((entry) => entry.checkpoint.commit)).size).toBe(1);
});

it("links the short SHA and expanded commit controls to their actual recorded task revisions", async () => {
  const scenario = new FeatureLogScenario();
  const entries = scenario.workflow.feature_log.slice(0, 1);
  scenario.render(entries);
  for (const entry of entries) {
    const shortQuery: RoleQueryOptions = {
      name: `Open checkpoint evidence for task ${entry.task}, revision ${entry.checkpoint.recorded.revision}`,
    };
    await fireEvent.click(screen.getByRole("button", shortQuery));
    const checkpoint: EvidenceSelection = {
      task: entry.task,
      revision: entry.checkpoint.recorded.revision,
    };
    expect(scenario.onevidence).toHaveBeenLastCalledWith(checkpoint);
    await fireEvent.click(
      screen.getByText("Evidence", FeatureLogScenario.EVIDENCE),
    );
    const checkpointQuery: RoleQueryOptions = {
      name: `Checkpoint evidence · r${entry.checkpoint.recorded.revision}`,
    };
    await fireEvent.click(screen.getByRole("button", checkpointQuery));
    expect(scenario.onevidence).toHaveBeenLastCalledWith(checkpoint);
    const integrationQuery: RoleQueryOptions = {
      name: `Integration evidence · r${entry.integration.recorded.revision}`,
    };
    await fireEvent.click(screen.getByRole("button", integrationQuery));
    const integration: EvidenceSelection = {
      task: entry.task,
      revision: entry.integration.recorded.revision,
    };
    expect(scenario.onevidence).toHaveBeenLastCalledWith(integration);
  }
  expect(scenario.onevidence).toHaveBeenCalledTimes(3);
});

it("shows checkpoint responsibility and actual integration time with independently recorded evidence", async () => {
  const scenario = new FeatureLogScenario();
  const entries = scenario.workflow.feature_log.slice(0, 1);
  for (const entry of entries) {
    entry.first_recorded.actor = Fixture.PRIME;
    entry.first_recorded.at = Fixture.NOW;
    entry.first_recorded.provenance = "LegacyStorageOrder";
    entry.checkpoint.recorded.actor = Fixture.VERIFIER;
    entry.checkpoint.recorded.at = Fixture.NOW + Fixture.MINUTE;
    entry.integration.recorded.actor = {
      team: "Delivery",
      role: "IntegrationAgent",
    };
    entry.integration.recorded.at = Fixture.NOW + 2 * Fixture.MINUTE;
    entry.integration.commit = "2222222222222222222222222222222222222222";
  }
  scenario.render(entries);
  const row = screen.getByRole("article");
  expect(row.querySelector(".outcome-meta")?.textContent).toContain(
    "Recorded by Rust Verifier",
  );
  expect(
    row.querySelector(".outcome-meta time")?.getAttribute("datetime"),
  ).toBe(new RecordedTime(Fixture.NOW + 2 * Fixture.MINUTE).iso());
  await fireEvent.click(
    within(row).getByText("Evidence", FeatureLogScenario.EVIDENCE),
  );
  expect(row.querySelector("details[open]")).toBeInstanceOf(HTMLDetailsElement);
  expect(
    [...row.querySelectorAll(".evidence-fields time")].map((time) =>
      time.getAttribute("datetime"),
    ),
  ).toEqual([
    new RecordedTime(Fixture.NOW).iso(),
    new RecordedTime(Fixture.NOW + Fixture.MINUTE).iso(),
    new RecordedTime(Fixture.NOW + 2 * Fixture.MINUTE).iso(),
  ]);
  for (const entry of entries) {
    expect(within(row).getByText(entry.detail)).toBeTruthy();
    expect(within(row).getByText(entry.checkpoint.commit)).toBeTruthy();
    expect(within(row).getByText(entry.integration.commit)).toBeTruthy();
    expect(row.textContent).toContain(
      `Recorded by Gizmo Prime · Task r${entry.first_recorded.revision} · R${entry.first_recorded.sequence} · LegacyStorageOrder`,
    );
    expect(row.textContent).toContain(
      `Recorded by Rust Verifier · Task r${entry.checkpoint.recorded.revision} · R${entry.checkpoint.recorded.sequence} · CommittedAppend`,
    );
    expect(row.textContent).toContain(
      `Recorded by Integration Agent · Task r${entry.integration.recorded.revision} · R${entry.integration.recorded.sequence} · CommittedAppend`,
    );
    const taskQuery: RoleQueryOptions = {
      name: `Open Log for task ${entry.task}`,
    };
    await fireEvent.click(within(row).getByRole("button", taskQuery));
    expect(scenario.onselect).toHaveBeenCalledExactlyOnceWith(entry.task);
  }
  expect(within(row).getByText(/Git authorship is unrecorded/)).toBeTruthy();
  for (const meaning of scenario.workflow.state_meanings.filter(
    (meaning) => meaning.state === "integrated",
  )) {
    expect(screen.getByText(meaning.qualification)).toBeTruthy();
  }
});

it("keeps an empty historical log meaningful without inventing milestones", () => {
  const scenario = new FeatureLogScenario();
  const entries: FeatureLogEntries = [];
  scenario.render(entries);
  expect(screen.getByText("No implementation outcomes recorded")).toBeTruthy();
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  expect(
    screen.getByText(/Historical tasks may have checkpoints/),
  ).toBeTruthy();
  expect(scenario.onselect).not.toHaveBeenCalled();
});
