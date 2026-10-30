import { AuthoredSvelteCheck } from "./authored-svelte.ts";
import { describe, expect, it } from "vitest";
import { ProjectionOrigin, SvelteProjection } from "./projection.ts";

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
  ).toEqual({ kind: ProjectionOrigin.Authored, span: { start: 0, end: 6 } });
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
  ).toEqual({ kind: ProjectionOrigin.Unknown });
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
  ).toBe(ProjectionOrigin.Generated);
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
  ).toBe(ProjectionOrigin.Authored);
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
  ).toBe(ProjectionOrigin.Authored);
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
  ).toBe(ProjectionOrigin.Authored);
});

class DirectiveMappingFixture {
  readonly source = `<script lang="ts">import Child from './Child.svelte'; import { fade, fly } from 'svelte/transition'; import { flip } from 'svelte/animate'; let element: HTMLElement; const offset = '2px'; const active = true; const options = {}; const action = () => ({}); const handle = () => {}; const rows = [1];</script><button bind:this={element} style:left={offset} class:active={active} on:click={handle} use:action={options}>Text</button><div transition:fade={options}></div><div in:fly={options}></div><div out:fly={options}></div>{#each rows as row (row)}<div animate:flip={options}></div>{/each}<Child let:value>{value}</Child>`;
  readonly projection = new SvelteProjection(
    this.source,
    "DirectiveAudit.svelte",
  );
}
it("maps authored bind, style, class, event, action, transition and animation expressions", () => {
  const fixture = new DirectiveMappingFixture();
  for (const prefix of [
    "bind:this={",
    "style:left={",
    "class:active={",
    "on:click={",
    "use:action={",
    "transition:fade={",
    "in:fly={",
    "out:fly={",
    "animate:flip={",
  ]) {
    const original = fixture.source.indexOf(prefix) + prefix.length;
    expect(
      fixture.projection.generatedPosition(original),
      prefix,
    ).toBeDefined();
  }
  expect(
    fixture.projection.generatedPosition(
      fixture.source.lastIndexOf("{value}") + 1,
    ),
  ).toBeDefined();
  expect(
    fixture.projection.generatedScopePosition(
      fixture.source.indexOf("<button"),
    ),
  ).toBeDefined();
});

class HelperIdentityFixture {
  readonly source: string;
  readonly projection: SvelteProjection;

  constructor(readonly key = "item") {
    this.source = `<script lang="ts">function __sveltets_2_ensureArray<T>(items:ReadonlyArray<T>):ReadonlyArray<T>{return items;} const items=[1]; for (const item of __sveltets_2_ensureArray(items)) { console.log(item); }</script>{#each items as item (${key})}<p>{item}</p>{/each}`;
    this.projection = new SvelteProjection(
      this.source,
      "HelperIdentity.svelte",
    );
  }
}

it("distinguishes an authored helper-like loop from a generated each loop", () => {
  const fixture = new HelperIdentityFixture();
  const original = fixture.source.indexOf("for (const item");
  const generated = fixture.projection.generatedPosition(original);
  expect(generated).toBeDefined();
  expect(
    fixture.projection.originalSpan(
      Buffer.byteLength(fixture.projection.code.slice(0, generated)),
      3,
    ),
  ).toEqual({ start: original, end: original + 3 });
  expect(
    new AuthoredSvelteCheck({
      source: fixture.source,
      filepath: "HelperIdentity.svelte",
      allowConditionals: false,
    }).run(),
  ).toEqual([]);
});

it("retains an actual keyed-each violation and its authored mapping beside a helper-like loop", () => {
  const fixture = new HelperIdentityFixture("item > 0 ? item : 0");
  const original = fixture.source.indexOf(`(${fixture.key})`) + 1;
  const generated = fixture.projection.generatedPosition(original);
  expect(generated).toBeDefined();
  expect(
    fixture.projection.originalSpan(
      Buffer.byteLength(fixture.projection.code.slice(0, generated)),
      fixture.key.length,
    ),
  ).toEqual({ start: original, end: original + fixture.key.length });
  expect(
    new AuthoredSvelteCheck({
      source: fixture.source,
      filepath: "HelperIdentity.svelte",
      allowConditionals: false,
    }).run(),
  ).toContainEqual(
    expect.objectContaining({ rule: "no-restricted-syntax", start: original }),
  );
});
