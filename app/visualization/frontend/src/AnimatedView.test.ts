import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { Effect } from "effect";
import ViewSwitch from "./ViewSwitch.svelte";
import SkyView from "./SkyView.svelte";
import { ViewMode, ViewModes } from "./view-mode.svelte";
import { Fixture } from "./dashboard-fixture";
import type { FeatureWorkflow } from "./contracts";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));

/** jsdom has neither a 2D canvas nor ResizeObserver; the sky tolerates both. */
class Browser {
  static readonly Observer = class {
    observe(): void {}
    disconnect(): void {}
  };
  install(): void {
    vi.stubGlobal("ResizeObserver", Browser.Observer);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  }
}
/** The sky's HUD refreshes on its frame loop, a few hundred milliseconds apart. */
class SkyFixture {
  static readonly WAIT = 4000;
}
beforeEach(() => new Browser().install());
afterEach(() => {
  cleanup();
  native.invoke.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("switches between the Classic and Animated views and reports the pressed state", async () => {
  const views = new ViewModes();
  render(ViewSwitch, { views });
  const animated = screen.getByRole("button", { name: "Animated" });
  expect(animated.getAttribute("aria-pressed")).toBe("false");
  await fireEvent.click(animated);
  expect(views.mode).toBe(ViewMode.Animated);
  expect(animated.getAttribute("aria-pressed")).toBe("true");
  await fireEvent.click(screen.getByRole("button", { name: "Classic" }));
  expect(views.mode).toBe(ViewMode.Classic);
});

it("reads the repository's workflows into the sky and lists its features and work", async () => {
  const fixture = new Fixture();
  native.invoke.mockImplementation(
    (): Promise<FeatureWorkflow> =>
      Effect.runPromise(Effect.succeed(fixture.workflow())),
  );
  render(SkyView, {
    repository: Fixture.REPOSITORY,
    cards: fixture.reply().features.records,
    mode: ViewMode.Animated,
    origin: { x: 0, y: 0 },
  });
  expect(screen.getByRole("region", { name: "Animated view" })).toBeTruthy();
  await waitFor(
    () =>
      expect(
        screen.getByRole("button", { name: /Release 0 12 3/ }),
      ).toBeTruthy(),
    { timeout: SkyFixture.WAIT },
  );
  expect(native.invoke).toHaveBeenCalledWith("dashboard_workflow", {
    selection: { repository: Fixture.REPOSITORY, feature: "release-0-12-3" },
  });
  await waitFor(
    () =>
      expect(
        screen.getByRole("button", { name: /Implement the release/ }),
      ).toBeTruthy(),
    { timeout: SkyFixture.WAIT },
  );
});

it("keeps the sky unmounted in the Classic view", () => {
  const fixture = new Fixture();
  render(SkyView, {
    repository: Fixture.REPOSITORY,
    cards: fixture.reply().features.records,
    mode: ViewMode.Classic,
    origin: { x: 0, y: 0 },
  });
  expect(
    screen.queryAllByRole("region", { name: "Animated view" }),
  ).toHaveLength(0);
  expect(native.invoke).not.toHaveBeenCalled();
});
