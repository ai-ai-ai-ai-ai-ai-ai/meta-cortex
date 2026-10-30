import { describe, expect, it } from "vitest";
import { parse } from "svelte/compiler";
import { JavascriptProjection } from "./javascript-projection.ts";
import { SvelteProjection } from "./projection.ts";

describe("JavaScript component projection", () => {
  it("produces JavaScript and an exact source map for a scriptless callback", () => {
    const source = '<button type="button" onclick={() => {42;}}>🦊</button>';
    const generated = new JavascriptProjection().generate(
      source,
      "Scriptless.svelte",
    );
    expect(
      parse(`<script context="module">${generated.code}</script>`).module,
    ).not.toBeNull();
    const projection = new SvelteProjection(source, "Scriptless.svelte", {
      ...generated,
      typescript: false,
    });
    const offset = generated.code.indexOf("42;");
    expect(
      projection.originalSpan(
        Buffer.byteLength(generated.code.slice(0, offset)),
        2,
      ),
    ).toEqual({ start: source.indexOf("42;"), end: source.indexOf("42;") + 2 });
  });
  it("keeps authored producer-marker lookalikes and JavaScript inference", () => {
    const source =
      '<script>const label = "/*Ωignore_startΩ*/"; let count = 1;</script><p>{label}{count}</p>';
    const generated = new JavascriptProjection().generate(
      source,
      "Javascript.svelte",
    );
    expect(generated.code).toContain('const label = "/*Ωignore_startΩ*/"');
    expect(generated.code).toContain("let count = 1");
    expect(
      parse(`<script context="module">${generated.code}</script>`).module,
    ).not.toBeNull();
  });
  it("supports a JavaScript module script without converting it to TypeScript", () => {
    const source =
      '<script module>export const label = "module";</script><p>{label}</p>';
    const generated = new JavascriptProjection().generate(
      source,
      "Module.svelte",
    );
    expect(generated.code).toContain('export const label = "module"');
    expect(
      parse(`<script context="module">${generated.code}</script>`).module,
    ).not.toBeNull();
  });
});
