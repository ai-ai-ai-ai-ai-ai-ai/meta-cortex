import { describe, expect, it } from "vitest";
import { SvelteProjection } from "./projection.ts";

class ProjectionFixture {
  readonly source =
    '<script lang="ts">\r\nconst emoji = "🦊";\r\nasync function bad() { return emoji; }\r\n</script>\r\n<button onclick={() => { Promise.resolve(); }}>Save</button>';
  readonly projection = new SvelteProjection(this.source, "Fixture.svelte");

  span(text: string) {
    const offset = this.projection.code.indexOf(text);
    return this.projection.originalSpan(
      Buffer.byteLength(this.projection.code.slice(0, offset)),
      Buffer.byteLength(text),
    );
  }
}

describe("native projection source ownership", () => {
  it("maps authored script positions with Unicode and CRLF", () => {
    const fixture = new ProjectionFixture();
    const text = "return emoji";
    expect(fixture.span(text)).toEqual({
      start: fixture.source.indexOf(text),
      end: fixture.source.indexOf(text) + text.length,
    });
  });
  it("maps a template callback to the authored component", () => {
    const fixture = new ProjectionFixture();
    const text = "Promise.resolve()";
    expect(fixture.span(text)).toEqual({
      start: fixture.source.indexOf(text),
      end: fixture.source.indexOf(text) + text.length,
    });
  });
  it("does not attribute generated async wrappers to authored code", () => {
    const fixture = new ProjectionFixture();
    expect(fixture.span("async () =>")).toBeUndefined();
  });
  it("retains user-authored async function ownership", () => {
    const fixture = new ProjectionFixture();
    expect(fixture.span("async function bad")).toEqual({
      start: fixture.source.indexOf("async function bad"),
      end:
        fixture.source.indexOf("async function bad") +
        "async function bad".length,
    });
  });
});

class MixedProjectionFixture {
  readonly projection = new SvelteProjection("source", "Fixture.svelte", {
    code: "let r = source;",
    map: JSON.stringify({
      version: 3,
      sources: ["Fixture.svelte"],
      names: [],
      mappings: "QAAA",
    }),
  });
}

it("retains authored code when a native label begins in generated punctuation", () => {
  const projection = new MixedProjectionFixture().projection;
  expect(
    projection.classify(0, 14, "typescript(no-unsafe-assignment)"),
  ).toEqual({ kind: "authored", span: { start: 0, end: 6 } });
});
it("expands a sparse verbatim source-map segment to its full authored span", () => {
  expect(new MixedProjectionFixture().projection.originalSpan(8, 6)).toEqual({
    start: 0,
    end: 6,
  });
});
it("reports unknown mapping instead of silently calling it generated", () => {
  expect(
    new MixedProjectionFixture().projection.classify(
      0,
      3,
      "typescript(no-unsafe-assignment)",
    ),
  ).toEqual({ kind: "unknown" });
});
it("uses generated AST ownership for the synthetic async wrapper", () => {
  const fixture = new ProjectionFixture();
  const start = fixture.projection.code.indexOf("async () =>");
  expect(
    fixture.projection.classify(
      Buffer.byteLength(fixture.projection.code.slice(0, start)),
      11,
      "typescript(require-await)",
    ).kind,
  ).toBe("generated");
});
it("does not suppress a mixed authored diagnostic merely because it crosses the wrapper", () => {
  const fixture = new ProjectionFixture();
  const start = fixture.projection.code.indexOf("async () =>");
  expect(
    fixture.projection.classify(
      Buffer.byteLength(fixture.projection.code.slice(0, start)),
      Buffer.byteLength(fixture.projection.code.slice(start)),
      "typescript(no-floating-promises)",
    ).kind,
  ).toBe("authored");
});

class TemplateOwnershipFixture {
  readonly source =
    '<script lang="ts">const rows = [{id:"🦊", children:[{id:"a"}]}]; const selected = "a";</script>{#each rows as row (row.id)}{#each row.children as child (child.id)}<p class:chosen={selected === child.id}>{child.id}</p>{/each}{#each row.children as child (child.id)}<p class:chosen={selected === child.id}>{child.id}</p>{/each}{/each}';
  readonly projection = new SvelteProjection(this.source, "Repeated.svelte");
}

it("maps repeated keys and class directives by their authored and generated AST roles", () => {
  const fixture = new TemplateOwnershipFixture();
  for (const match of fixture.source.matchAll(/child\.id/g)) {
    const generated = fixture.projection.generatedPosition(match.index);
    expect(generated).toBeDefined();
    expect(
      fixture.projection.originalSpan(
        Buffer.byteLength(fixture.projection.code.slice(0, generated)),
        "child.id".length,
      ),
    ).toEqual({ start: match.index, end: match.index + "child.id".length });
  }
});

class AuthoredUnsafeFixture {
  projection(code: string) {
    return new SvelteProjection("unsafe()", "Unsafe.svelte", {
      code,
      map: JSON.stringify({
        version: 3,
        sources: ["Unsafe.svelte"],
        names: [],
        mappings: [[[code.indexOf("unsafe()"), 0, 0, 0]]],
      }),
    });
  }
}
it("retains authored unsafe code inside a helper-like variable declaration", () => {
  const code = "function $$render(){ const $$_probe = unsafe(); }";
  const projection = new AuthoredUnsafeFixture().projection(code);
  expect(
    projection.classify(
      code.indexOf("$$_probe"),
      "$$_probe = unsafe()".length,
      "typescript(no-unsafe-assignment)",
    ).kind,
  ).toBe("authored");
});
it("retains authored unsafe code inside the rendering return", () => {
  const code = "function $$render(){ return unsafe(); }";
  const projection = new AuthoredUnsafeFixture().projection(code);
  expect(
    projection.classify(
      code.indexOf("return"),
      "return unsafe();".length,
      "typescript(no-unsafe-return)",
    ).kind,
  ).toBe("authored");
});
