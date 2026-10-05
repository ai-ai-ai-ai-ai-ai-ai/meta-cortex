import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import GuideDocumentView from "./GuideDocumentView.svelte";
import type { GuideDocument } from "./contracts";
const opener = vi.hoisted(() => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/plugin-opener", () => opener);
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
const diagrams = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("mermaid", () => ({ default: diagrams }));
const source: GuideDocument = {
  id: { kind: "Protocol", protocol: "Communication" },
  path: "teams/AGENTS.md",
  markdown:
    "# Guide\n\n## Responsibilities\n\n- **Report** progress\n- Keep `contracts`\n\n```ts\nconst count = 1;\n```\n\n[Details](docs/detail.md#handoff)\n\n[Missing](missing.md)\n\n[External](https://example.com/docs)",
};
const linked: GuideDocument = {
  id: { kind: "Protocol", protocol: "Coordination" },
  path: "teams/docs/detail.md",
  markdown:
    "# Details\n\n## Handoff\n\n1. First step\n2. Second step\n\n[Back](../AGENTS.md#responsibilities)",
};
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  diagrams.render.mockReset();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  opener.openUrl.mockClear();
});
it("renders semantic Markdown and follows embedded relative links and anchors", async () => {
  const { container } = render(GuideDocumentView, {
    source,
    documents: [source, linked],
  });
  expect(screen.getByRole("heading", { name: "Guide", level: 1 })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(container.querySelector("strong")?.textContent).toBe("Report");
  expect(container.querySelector("pre code")?.textContent).toContain(
    "const count = 1;",
  );
  expect(
    screen.getByRole("link", { name: "Details" }).getAttribute("href"),
  ).toBe(
    new URL(
      "teams/docs/detail.md#handoff",
      import.meta.env.VITE_GUIDE_SOURCE_BASE,
    ).href,
  );
  await fireEvent.click(screen.getByRole("link", { name: "Details" }));
  expect(screen.getByRole("heading", { name: "Details" })).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Handoff" }),
  );
  await fireEvent.click(screen.getByRole("link", { name: "Back" }));
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Responsibilities" }),
  );
  await fireEvent.click(screen.getByRole("link", { name: "Missing" }));
  await waitFor(() =>
    expect(opener.openUrl).toHaveBeenCalledWith(
      new URL("teams/missing.md", import.meta.env.VITE_GUIDE_SOURCE_BASE).href,
    ),
  );
  await fireEvent.click(screen.getByRole("link", { name: "External" }));
  await waitFor(() =>
    expect(opener.openUrl).toHaveBeenCalledWith("https://example.com/docs"),
  );
});
it("escapes raw HTML and rejects executable Markdown URLs", () => {
  const unsafe: GuideDocument = {
    ...source,
    markdown:
      '# Safe\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert%281%29)\n\n[encoded](jav&#x61;script:alert%281%29)\n\n```html\n<script>example</script>\n```',
  };
  const { container } = render(GuideDocumentView, {
    source: unsafe,
    documents: [unsafe],
  });
  expect(container.querySelector("script, img, [onerror], a")).toBeNull();
  expect(container.querySelector("pre code")?.textContent).toContain(
    "<script>example</script>",
  );
  expect(screen.getByRole("heading", { name: "Safe" })).toBeTruthy();
});

it("renders Mermaid fences as strict diagrams without changing ordinary code", async () => {
  diagrams.render.mockResolvedValue({
    svg: '<svg role="img" aria-label="Flow"><text>Team Gizmo</text></svg>',
  });
  const diagram: GuideDocument = {
    ...source,
    markdown:
      "# Flow\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n```ts\nconst n = 1;\n```",
  };
  const { container } = render(GuideDocumentView, {
    source: diagram,
    documents: [diagram],
  });
  expect(await screen.findByRole("img", { name: "Flow" })).toBeTruthy();
  expect(diagrams.initialize).toHaveBeenCalledWith(
    expect.objectContaining({
      securityLevel: "strict",
      startOnLoad: false,
      theme: "dark",
    }),
  );
  expect(container.querySelector("code.language-ts")?.textContent).toContain(
    "const n = 1;",
  );
});
it("keeps Mermaid source visible when a diagram cannot render", async () => {
  diagrams.render.mockRejectedValue(new Error("Invalid diagram"));
  const diagram: GuideDocument = {
    ...source,
    markdown: "```mermaid\ninvalid diagram\n```",
  };
  const { container } = render(GuideDocumentView, {
    source: diagram,
    documents: [diagram],
  });
  expect(
    await screen.findByText(
      "This diagram could not be rendered. Its Mermaid source is shown below.",
    ),
  ).toBeTruthy();
  expect(container.querySelector("pre code")?.textContent).toContain(
    "invalid diagram",
  );
});
