import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  type ByRoleOptions,
} from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import type { MermaidConfig, RenderResult } from "mermaid";
import { Schema } from "effect";
import { guide } from "virtual:agent-guide";
import { GuideContent, type GuideDocument } from "./guide-content";
import GuideDocumentView from "./GuideDocumentView.svelte";
const opener = vi.hoisted(() => ({ openUrl: vi.fn().mockResolvedValue(true) }));
const diagrams = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => opener);
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("mermaid", () => ({ default: diagrams }));
type ReaderSource = typeof GuideContent.DOCUMENT.Encoded;
type ReaderProps = ComponentProps<typeof GuideDocumentView>;
type ThemeObservation = Pick<MediaQueryList, "matches">;
type DiagramFixtureResult = Pick<RenderResult, "svg">;
class ReaderFixture {
  source(markdown: string): GuideDocument {
    const record: ReaderSource = { path: "teams/reader/AGENTS.md", markdown };
    return Schema.decodeUnknownSync(GuideContent.DOCUMENT)(record);
  }
  mount(source: GuideDocument) {
    const props: ReaderProps = {
      source,
      documents: [source],
      sourceBase: guide.sourceBase,
    };
    return render(GuideDocumentView, props);
  }
}
beforeEach(() => {
  const scrolling: PropertyDescriptor = { configurable: true, value: vi.fn() };
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrolling);
  const observation: ThemeObservation = { matches: true };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(observation));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  opener.openUrl.mockReset();
  diagrams.render.mockReset();
  diagrams.initialize.mockReset();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
it("escapes raw HTML and rejects executable Markdown links while preserving code", () => {
  const fixture = new ReaderFixture();
  const source = fixture.source(
    '# Safe\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert%281%29)\n\n[encoded](jav&#x61;script:alert%281%29)\n\n```html\n<script>example</script>\n```',
  );
  const { container } = fixture.mount(source);
  expect(container.querySelectorAll("script, img, [onerror], a")).toHaveLength(
    0,
  );
  expect(container.querySelector("pre code")?.textContent).toContain(
    "<script>example</script>",
  );
});
it("opens unbundled source links through the native opener at the embedded revision", async () => {
  const fixture = new ReaderFixture();
  fixture.mount(
    fixture.source(
      "# Reader\n\n[Skill](skills/SKILL.md)\n\n[External](https://example.com/docs)",
    ),
  );
  const skill: ByRoleOptions = { name: "Skill" };
  await fireEvent.click(screen.getByRole("link", skill));
  await waitFor(() =>
    expect(opener.openUrl).toHaveBeenCalledWith(
      new URL("teams/reader/skills/SKILL.md", guide.sourceBase).href,
    ),
  );
  const external: ByRoleOptions = { name: "External" };
  await fireEvent.click(screen.getByRole("link", external));
  await waitFor(() =>
    expect(opener.openUrl).toHaveBeenCalledWith("https://example.com/docs"),
  );
});
it("renders Mermaid fences in strict mode and leaves ordinary code untouched", async () => {
  const result: DiagramFixtureResult = {
    svg: '<svg role="img" aria-label="Flow"><text>Team Gizmo</text></svg>',
  };
  diagrams.render.mockResolvedValue(result);
  const fixture = new ReaderFixture();
  const source = fixture.source(
    "# Flow\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n```ts\nconst n = 1;\n```",
  );
  const { container } = fixture.mount(source);
  const image: ByRoleOptions = { name: "Flow" };
  expect(await screen.findByRole("img", image)).toBeTruthy();
  const config: MermaidConfig = {
    securityLevel: "strict",
    startOnLoad: false,
    theme: "dark",
  };
  expect(diagrams.initialize).toHaveBeenCalledWith(
    expect.objectContaining(config),
  );
  expect(container.querySelector("code.language-ts")?.textContent).toContain(
    "const n = 1;",
  );
});
it("keeps Mermaid source visible when rendering fails and presents native opener failure", async () => {
  diagrams.render.mockRejectedValue(new Error("Invalid diagram"));
  const fixture = new ReaderFixture();
  const source = fixture.source(
    "```mermaid\ninvalid diagram\n```\n\n[External](https://example.com/docs)",
  );
  const { container } = fixture.mount(source);
  expect(
    await screen.findByText(
      "This diagram could not be rendered. Its Mermaid source is shown below.",
    ),
  ).toBeTruthy();
  expect(container.querySelector("pre code")?.textContent).toContain(
    "invalid diagram",
  );
  opener.openUrl.mockRejectedValueOnce(new Error("Unavailable"));
  const external: ByRoleOptions = { name: "External" };
  await fireEvent.click(screen.getByRole("link", external));
  expect(
    await screen.findByText("Could not open https://example.com/docs"),
  ).toBeTruthy();
});
