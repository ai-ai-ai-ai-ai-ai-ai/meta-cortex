import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  type ByRoleOptions,
} from "@testing-library/svelte";
import { Effect, Match } from "effect";
import App from "./App.svelte";
import { Fixture } from "./dashboard-fixture";
import { FeatureLook } from "./observability";
import type { DesktopReply, StoredFeatureSelection } from "./contracts";

interface WorkflowReadArguments {
  readonly selection: StoredFeatureSelection;
}

enum SelectionSurface {
  Body,
  Progress,
}
const native = vi.hoisted(() => ({ invoke: vi.fn(), openUrl: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: native.openUrl }));
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
  native.openUrl.mockReset();
});

class SelectionScenario {
  static readonly OPEN_REPOSITORY: ByRoleOptions = {
    name: `Open meta-cortex, ${Fixture.REPOSITORY.repository_id}`,
  };
  readonly first = new Fixture();
  readonly second = new Fixture();
  constructor() {
    this.second.summary.feature.id = "second-feature";
    this.second.summary.feature.objective = "Second feature objective";
  }
  install(): void {
    const reply: DesktopReply = {
      features: {
        end: "Complete",
        records: [
          { kind: "current", summary: this.first.summary },
          { kind: "current", summary: this.second.summary },
        ],
      },
    };
    native.invoke.mockResolvedValueOnce(this.first.catalog());
    native.invoke.mockResolvedValueOnce(reply);
  }
  card(fixture: Fixture): HTMLElement {
    const previewQuery: ByRoleOptions = {
      name: `Preview ${new FeatureLook(fixture.summary).title()}`,
    };
    return Match.value(
      screen.getByRole("button", previewQuery).closest("article"),
    ).pipe(
      Match.when(Match.instanceOf(HTMLElement), (card) => card),
      Match.orElse(() => {
        throw new Error("Missing feature card");
      }),
    );
  }
  async switchRepeatedly(surface: SelectionSurface): Promise<void> {
    this.install();
    native.invoke.mockResolvedValueOnce(this.first.workflow());
    render(App);
    await fireEvent.click(
      await screen.findByRole("button", SelectionScenario.OPEN_REPOSITORY),
    );
    const briefingQuery: ByRoleOptions = { name: "Selected feature" };
    await screen.findByRole("article", briefingQuery);
    for (const fixture of [this.second, this.first, this.second]) {
      const workflow = fixture.workflow();
      workflow.feature = fixture.summary.feature.id;
      const objective = `${fixture.summary.feature.id} workflow objective`;
      for (const chapter of workflow.chapters) {
        chapter.task.common.objective = objective;
      }
      native.invoke.mockResolvedValueOnce(workflow);
      const card = this.card(fixture);
      switch (surface) {
        case SelectionSurface.Body:
          await fireEvent.click(card);
          break;
        case SelectionSurface.Progress:
          await fireEvent.click(
            within(card).getByLabelText("1 of 6 tasks finished"),
          );
          break;
      }
      const briefing = await screen.findByRole("article", briefingQuery);
      expect(
        within(briefing).getByText(fixture.summary.feature.objective),
      ).toBeTruthy();
      const args: WorkflowReadArguments = {
        selection: {
          repository: Fixture.REPOSITORY,
          feature: fixture.summary.feature.id,
        },
      };
      expect(native.invoke).toHaveBeenLastCalledWith(
        "dashboard_workflow",
        args,
      );
      const taskQuery: ByRoleOptions = {
        name: "Open task rust-release",
      };
      expect(within(briefing).getByRole("button", taskQuery)).toBeTruthy();
      const openQuery: ByRoleOptions = { name: "Open workflow" };
      await fireEvent.click(within(briefing).getByRole("button", openQuery));
      const workflowQuery: ByRoleOptions = { name: "Agent index" };
      const index = await screen.findByRole("navigation", workflowQuery);
      expect(within(index).getAllByText(objective)).toBeTruthy();
      const headingQuery: ByRoleOptions = {
        name: new FeatureLook(fixture.summary).title(),
        level: 1,
      };
      expect(screen.getByRole("heading", headingQuery)).toBeTruthy();
      const backQuery: ByRoleOptions = { name: "Features" };
      await fireEvent.click(screen.getByRole("button", backQuery));
    }
  }
}

it("switches corresponding briefing and workflow repeatedly from card body clicks", async () => {
  await new SelectionScenario().switchRepeatedly(SelectionSurface.Body);
});
it("switches corresponding briefing and workflow repeatedly from progress bar clicks", async () => {
  await new SelectionScenario().switchRepeatedly(SelectionSurface.Progress);
});
it("preserves description and PR actions without selecting their card", async () => {
  const scenario = new SelectionScenario();
  scenario.install();
  native.invoke.mockResolvedValueOnce(scenario.first.workflow());
  render(App);
  await fireEvent.click(
    await screen.findByRole("button", SelectionScenario.OPEN_REPOSITORY),
  );
  const briefingQuery: ByRoleOptions = { name: "Selected feature" };
  await screen.findByRole("article", briefingQuery);
  const card = scenario.card(scenario.second);
  await fireEvent.click(
    within(card).getByText(scenario.second.summary.feature.objective),
  );
  expect(card.querySelector("details[open]")).toBeInstanceOf(
    HTMLDetailsElement,
  );
  const linkQuery: ByRoleOptions = { name: "Open pull request 41" };
  await fireEvent.click(within(card).getByRole("link", linkQuery));
  expect(native.openUrl).toHaveBeenCalledWith(
    "https://github.com/acme/release/pull/41",
  );
  expect(native.invoke).toHaveBeenCalledTimes(3);
  const briefing = screen.getByRole("article", briefingQuery);
  expect(
    within(briefing).getByText(scenario.first.summary.feature.objective),
  ).toBeTruthy();
});
it("keeps the latest selection when an earlier native workflow read completes later", async () => {
  const scenario = new SelectionScenario();
  scenario.install();
  const secondWorkflow = scenario.second.workflow();
  secondWorkflow.feature = scenario.second.summary.feature.id;
  native.invoke.mockImplementationOnce(() =>
    Effect.runPromise(
      Effect.sleep("100 millis").pipe(Effect.as(scenario.first.workflow())),
    ),
  );
  native.invoke.mockResolvedValueOnce(secondWorkflow);
  render(App);
  await fireEvent.click(
    await screen.findByRole("button", SelectionScenario.OPEN_REPOSITORY),
  );
  const previewQuery: ByRoleOptions = { name: "Preview Second feature" };
  await fireEvent.click(await screen.findByRole("button", previewQuery));
  const briefingQuery: ByRoleOptions = { name: "Selected feature" };
  const briefing = await screen.findByRole("article", briefingQuery);
  expect(
    within(briefing).getByText(scenario.second.summary.feature.objective),
  ).toBeTruthy();
  await Effect.runPromise(Effect.sleep("150 millis"));
  const openQuery: ByRoleOptions = { name: "Open workflow" };
  await fireEvent.click(screen.getByRole("button", openQuery));
  const workflowQuery: ByRoleOptions = { name: "Agent index" };
  await screen.findByRole("navigation", workflowQuery);
  const headingQuery: ByRoleOptions = { name: "Second feature", level: 1 };
  expect(screen.getByRole("heading", headingQuery)).toBeTruthy();
});
