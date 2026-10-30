// @vitest-environment node
import { expect, it } from "vitest";
import { Effect } from "effect";
import { API, type Snapshot } from "typescript/unstable/async";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { svelte2tsx } from "@rsvelte/svelte2tsx";
import {
  eachMapping,
  TraceMap,
  type EachMapping,
} from "@jridgewell/trace-mapping";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { SvelteTypeChecks, type TypedSvelteComponent } from "./svelte-types";

enum MappingMode {
  Available = "available",
  Missing = "missing",
}
enum ProjectLifetime {
  Live = "live",
  Disposed = "disposed",
}

class SemanticFixture implements TypedSvelteComponent {
  readonly filepath: string;
  readonly projectedPath: string;
  private readonly config: string;
  private readonly files: Record<string, string>;
  private readonly origins = new Map<number, number>();
  private readonly generated: string;

  constructor(
    readonly source: string,
    options: {
      readonly module?: string;
      readonly mapping?: MappingMode;
      readonly lifetime?: ProjectLifetime;
    } = {},
  ) {
    this.options = options;
    const directory = resolve(
      process.cwd(),
      ".semantic-fixtures",
      randomUUID(),
    );
    this.filepath = resolve(directory, "Fixture.svelte");
    this.projectedPath = resolve(directory, "Fixture.tsx");
    this.config = resolve(directory, "tsconfig.json");
    const projection = svelte2tsx(source, {
      filename: this.filepath,
      isTsFile: true,
      version: "5",
    });
    this.generated = projection.code;
    switch (projection.map) {
      case null:
        throw new Error("Native fixture projection has no mapping");
      default:
        eachMapping(new TraceMap(projection.map.toString()), (mapping) =>
          this.mapping(mapping),
        );
    }
    const { module = "export {};" } = options;
    this.files = {
      [this.projectedPath]: projection.code,
      [resolve(directory, "store.ts")]: module,
      [this.config]: JSON.stringify({
        compilerOptions: {
          strict: true,
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "preserve",
          skipLibCheck: true,
        },
        files: ["Fixture.tsx", "store.ts"],
      }),
    };
  }

  private readonly options: {
    readonly module?: string;
    readonly mapping?: MappingMode;
    readonly lifetime?: ProjectLifetime;
  };

  private offset(source: string, line: number, column: number): number {
    return (
      source
        .split("\n")
        .slice(0, line - 1)
        .reduce((offset, text) => offset + text.length + 1, 0) + column
    );
  }

  private mapping(mapping: EachMapping): void {
    switch (typeof mapping.originalLine) {
      case "number":
        switch (typeof mapping.originalColumn) {
          case "number":
            this.origins.set(
              this.offset(
                this.source,
                mapping.originalLine,
                mapping.originalColumn,
              ),
              this.offset(
                this.generated,
                mapping.generatedLine,
                mapping.generatedColumn,
              ),
            );
            break;
          case "bigint":
          case "boolean":
          case "function":
          case "object":
          case "string":
          case "symbol":
          case "undefined":
            break;
        }
        break;
      case "bigint":
      case "boolean":
      case "function":
      case "object":
      case "string":
      case "symbol":
      case "undefined":
        break;
    }
  }

  generatedPosition(offset: number): number | undefined {
    switch (this.options.mapping) {
      case MappingMode.Missing:
        return undefined;
      case MappingMode.Available:
      case undefined:
        return this.origins.get(offset);
    }
  }

  private closeAPI(api: API) {
    return Effect.promise(() => api.close());
  }
  private disposeSnapshot(snapshot: Snapshot) {
    return Effect.promise(() => snapshot.dispose());
  }

  check() {
    return Effect.scoped(
      Effect.gen({ self: this }, function* () {
        const api = yield* Effect.acquireRelease(
          Effect.sync(
            () =>
              new API({
                cwd: process.cwd(),
                fs: createVirtualFileSystem(this.files),
              }),
          ),
          (api) => this.closeAPI(api),
        );
        const snapshot = yield* Effect.acquireRelease(
          Effect.promise(() =>
            api.updateSnapshot({ openProjects: [this.config] }),
          ),
          (snapshot) => this.disposeSnapshot(snapshot),
        );
        switch (this.options.lifetime) {
          case ProjectLifetime.Disposed:
            yield* Effect.promise(() => snapshot.dispose());
            break;
          case ProjectLifetime.Live:
          case undefined:
            break;
        }
        const project = snapshot.getProject(this.config);
        switch (project) {
          case undefined:
            return yield* Effect.die(
              new Error("Native fixture project was not opened"),
            );
          default:
            return yield* new SvelteTypeChecks(project).check(this);
        }
      }),
    );
  }
}

class StoreFixture {
  static readonly readable =
    "export interface Readable { subscribe(run:(value:number)=>void, invalidate?:(value?:number)=>void):()=>void } export declare const store: Readable;";
}

it("reports nested unused props using the real projected native type", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">interface Props {value:{used:string;omitted:string}} const {value}:Props=$props();</script><p>{value.used}</p>',
  );
  const findings = await Effect.runPromise(fixture.check());
  expect(findings).toEqual([
    expect.objectContaining({
      rule: "svelte/no-unused-props",
      message: "'omitted' in 'value' is an unused property.",
    }),
  ]);
  expect(
    findings.map((finding) => fixture.source.slice(finding.start, finding.end)),
  ).toEqual(["{value}:Props"]);
});

it.each([
  '<script lang="ts">interface Props {value:{used:string;omitted:string}} const {value}:Props=$props();</script><p>{value.used}{value.omitted}</p>',
  '<script lang="ts">interface Props {value:{used:string;omitted:string}} const {value}:Props=$props();</script><p>{value}</p>',
  '<script lang="ts">interface Props {used:string;omitted:string} const {used,...rest}:Props=$props();</script><p>{used}{Object.keys(rest).length}</p>',
  '<script lang="ts">interface Props {value:{used:string;omitted:string}} const props:Props=$props();</script><p>{props.value.used}{props.value.omitted}</p>',
  '<script lang="ts">interface Props {value:{used:string;omitted:string}} const props:Props=$props();</script><div {...props}></div>',
])(
  "accepts used, passed-through and rest-captured props: %s",
  async (source) => {
    expect(
      await Effect.runPromise(new SemanticFixture(source).check()),
    ).toEqual([]);
  },
);

it("reports imported two-parameter Readable types at original Unicode positions", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script>\r\n<p>🧠 café {store}</p>',
    { module: StoreFixture.readable },
  );
  const findings = await Effect.runPromise(fixture.check());
  expect(findings).toEqual([
    expect.objectContaining({
      rule: "svelte/require-store-reactive-access",
      start: fixture.source.lastIndexOf("store"),
      end: fixture.source.lastIndexOf("store") + "store".length,
    }),
  ]);
});

it.each([
  { expression: "$store", module: StoreFixture.readable },
  {
    expression: "store",
    module:
      "export declare const store: {subscribe(callback:(value:number)=>void):()=>void};",
  },
  {
    expression: "store",
    module:
      "export declare const store: {subscribe(first:number,second:string):void};",
  },
  {
    expression: "store",
    module:
      "export declare const store: {subscribe(first:()=>void,second:number):void};",
  },
  {
    expression: "store",
    module: "export declare const store: {value:number};",
  },
])(
  "uses imported subscribe signatures rather than names/shapes: $module",
  async ({ expression, module }) => {
    const fixture = new SemanticFixture(
      `<script lang="ts">import {store} from "./store";</script><p>{${expression}}</p>`,
      { module },
    );
    expect(await Effect.runPromise(fixture.check())).toEqual([]);
  },
);

it("rejects typed callback parameters used as raw operands", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">import {store, type Readable} from "./store";</script><p>{((item:Readable) => +item)(store)}</p>',
    { module: StoreFixture.readable },
  );
  expect(
    (await Effect.runPromise(fixture.check())).map((finding) => finding.rule),
  ).toEqual(["svelte/require-store-reactive-access"]);
});

it("accepts store objects passed as component props", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">import {store} from "./store"; import Child from "./Child.svelte";</script><Child value={store} />',
    { module: StoreFixture.readable },
  );
  expect(await Effect.runPromise(fixture.check())).toEqual([]);
});

it("fails when a required original mapping is unavailable", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script><p>{store}</p>',
    { module: StoreFixture.readable, mapping: MappingMode.Missing },
  );
  const failure = await Effect.runPromise(Effect.flip(fixture.check()));
  expect(failure.cause).toEqual(
    new Error(
      `Missing native type mapping for ${fixture.filepath}:${fixture.source.lastIndexOf("store")}`,
    ),
  );
});

it("propagates native project lifetime failures", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script><p>{store}</p>',
    { module: StoreFixture.readable, lifetime: ProjectLifetime.Disposed },
  );
  await expect(Effect.runPromise(fixture.check())).rejects.toThrow();
});

it.each([
  "{#if store}ready{/if}",
  "<div class:active={store}></div>",
  "<div data-value={store}></div>",
  "<div use:store></div>",
  "<div transition:store></div>",
  "<div style:store></div>",
])(
  "preserves raw-store checking across authored contexts: %s",
  async (template) => {
    const fixture = new SemanticFixture(
      `<script lang="ts">import {store} from "./store";</script>${template}`,
      { module: StoreFixture.readable },
    );
    expect(
      (await Effect.runPromise(fixture.check())).map((finding) => finding.rule),
    ).toEqual(["svelte/require-store-reactive-access"]);
  },
);

it("uses any-vs-all union semantics in render and truthiness contexts", async () => {
  const module =
    "export interface Readable {subscribe(run:(value:number)=>void,invalidate?:(value?:number)=>void):()=>void} export declare const store:Readable|false;";
  const raw = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script><p>{store}</p>',
    { module },
  );
  const condition = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script>{#if store}ready{/if}',
    { module },
  );
  expect(
    (await Effect.runPromise(raw.check())).map((finding) => finding.rule),
  ).toEqual(["svelte/require-store-reactive-access"]);
  expect(await Effect.runPromise(condition.check())).toEqual([]);
});

it("resolves shorthand directive bindings in the mapped local lexical scope", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script>{#snippet view(store:{value:number})}<div style:store></div>{/snippet}',
    { module: StoreFixture.readable },
  );
  expect(await Effect.runPromise(fixture.check())).toEqual([]);
});

it("preserves imported and shadowed bindings inside each-block scopes", async () => {
  const imported = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script>{#each [1] as item}<div style:store>{item}</div>{/each}',
    { module: StoreFixture.readable },
  );
  const shadowed = new SemanticFixture(
    '<script lang="ts">import {store} from "./store";</script>{#each [1] as store}<div style:store></div>{/each}',
    { module: StoreFixture.readable },
  );
  expect(
    (await Effect.runPromise(imported.check())).map((finding) => finding.rule),
  ).toEqual(["svelte/require-store-reactive-access"]);
  expect(await Effect.runPromise(shadowed.check())).toEqual([]);
});

it("ignores imported Props members by the existing default option", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">import type {Props} from "./store";const {used}:Props=$props();</script>{used}',
    { module: "export interface Props {used:string;omitted:string}" },
  );
  expect(await Effect.runPromise(fixture.check())).toEqual([]);
});

it("distinguishes shadowed local bindings from actual Props references", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">interface Props {value:{used:string;omitted:string}}const {value}:Props=$props();function unrelated(value:{omitted:string}){return value.omitted;}</script>{value.used}',
  );
  expect(
    (await Effect.runPromise(fixture.check())).map(
      (finding) => finding.message,
    ),
  ).toEqual(["'omitted' in 'value' is an unused property."]);
});

it("preserves the root index signature and rest capture behavior", async () => {
  const missing = new SemanticFixture(
    '<script lang="ts">interface Props {[key:string]:string;used:string}const {used}:Props=$props();</script>{used}',
  );
  const captured = new SemanticFixture(
    '<script lang="ts">interface Props {[key:string]:string;used:string}const {used,...rest}:Props=$props();</script>{used}{Object.keys(rest).length}',
  );
  expect(
    (await Effect.runPromise(missing.check())).map(
      (finding) => finding.message,
    ),
  ).toEqual([
    "Index signature is unused. Consider using rest operator (...) to capture remaining properties.",
  ]);
  expect(await Effect.runPromise(captured.check())).toEqual([]);
});

it("uses the complete compound Props annotation", async () => {
  const fixture = new SemanticFixture(
    '<script lang="ts">interface First {value:{used:string;omitted:string}}const {value}:First & {other:number}=$props();</script>{value.used}',
  );
  expect(
    (await Effect.runPromise(fixture.check())).map(
      (finding) => finding.message,
    ),
  ).toEqual([
    "'omitted' in 'value' is an unused property.",
    "'other' is an unused Props property.",
  ]);
});
