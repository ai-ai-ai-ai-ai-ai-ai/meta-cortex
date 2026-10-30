// @vitest-environment node
import { expect, it } from "vitest";
import { checkAuthoredSvelte } from "./authored-svelte";

class ComponentFixture {
  constructor(readonly source: string) {}

  check() {
    return checkAuthoredSvelte({
      source: this.source,
      filepath: "src/Fixture.svelte",
      allowConditionals: false,
    });
  }
}

it.each([
  "<script>if (ready) run();</script>",
  '<script context="module">if (ready) run();</script>',
  '<script lang="ts">const value: string = ready ? "yes" : "no";</script>',
  "{ready ? yes : no}",
  "<button onclick={() => { if (ready) run(); }}>run</button>",
  "<button on:click={() => ready ? yes : no}>run</button>",
  "<div class:active={ready ? yes : no}></div>",
  "<div use:action={ready ? yes : no}></div>",
  "{#if ready ? yes : no}ready{/if}",
  "{#each ready ? yes : no as item}{item}{/each}",
  "{#await ready ? yes : no}pending{:then value}{value}{/await}",
  "{#if ready}{@const value = ready ? yes : no}{value}{/if}",
  "{@html ready ? yes : no}",
  "{@render (ready ? yes : no)()}",
])(
  "rejects authored branching throughout scripts and template expressions: %s",
  (source) => {
    expect(new ComponentFixture(source).check()).toEqual([
      expect.objectContaining({
        rule: "no-restricted-syntax",
        severity: "error",
      }),
    ]);
  },
);

it.each([
  '<script>const text = "if (ready) run(); ready ? yes : no"; // if (ready) run();\n</script>',
  "<!-- if (ready) run(); ready ? yes : no -->plain text",
  "{#if ready}{#each rows as row}{#await row}{:then value}{value}{/await}{/each}{/if}",
  "<script>function run(){for(;;){while(ready){break}}}</script>",
  "<script>function run(){{{{work()}}}}</script>",
  "<script>first(() => second(() => work()));</script>",
  "<script>new First(() => new Second(() => work()));</script>",
  "<script>(() => (() => (() => work())())())();</script>",
  "<script>first(() => {}); second(() => {}); third(() => {});</script>",
  "<script>for(;;){while(ready){const run = () => {for(;;){while(ready){break}}};}}</script>",
  "<script>for(;;){while(ready){class Scope {static {for(;;){while(ready){break}}}}}}</script>",
  "{#if ready}{#each rows as row}{first(() => second(() => work()))}{/each}{/if}",
  "{#await pending}{:then value}<button onclick={() => first(() => second(() => work()))}>run</button>{/await}",
])(
  "accepts permitted structural boundaries without counting generated scopes: %s",
  (source) => {
    expect(new ComponentFixture(source).check()).toEqual([]);
  },
);

it.each([
  "<script>for(;;){while(ready){do {work()} while(ready)}}</script>",
  "<script>try {for(;;){switch(value){case 1: break}}} catch(error) {}</script>",
  "<script>for(const key in values){for(const value of values){while(ready){break}}}</script>",
  "{#if ready}<button onclick={() => {for(;;){while(ready){do {work()} while(ready)}}}}>run</button>{/if}",
])("rejects a third JS control-flow level: %s", (source) => {
  expect(new ComponentFixture(source).check()).toEqual([
    expect.objectContaining({
      rule: "max-depth",
      message: "Blocks are nested too deeply (3). Maximum allowed is 2.",
    }),
  ]);
});

it.each([
  "<script>first(() => second(() => third(() => work())));</script>",
  "<script>new First(() => new Second(() => new Third(() => work())));</script>",
  "<script>first(function(){new Second(function(){third(function(){work()})})});</script>",
  "<script>first(() => {function scope(){second(() => third(() => work()));}});</script>",
  "{#if ready}{#each rows as row}{first(() => new Second(() => third(() => work())))}{/each}{/if}",
  "{#await pending}{:then value}<button onclick={() => first(() => second(() => third(() => work())))}>run</button>{/await}",
])(
  "rejects third callbacks including constructors in authored contexts: %s",
  (source) => {
    expect(new ComponentFixture(source).check()).toEqual([
      expect.objectContaining({
        rule: "max-nested-callbacks",
        message: "Too many nested callbacks (3). Maximum allowed is 2.",
      }),
    ]);
  },
);

it("preserves else-if depth and resets sibling branches", () => {
  const source =
    "<script>for(;;){if(a){} else if(b){} else if(c){while(d){break}}}</script>";
  const diagnostics = checkAuthoredSvelte({
    source,
    filepath: "src/Fixture.svelte",
    allowConditionals: true,
  });
  expect(diagnostics).toEqual([
    expect.objectContaining({
      rule: "max-depth",
      start: source.indexOf("while"),
    }),
  ]);
});

it("reports each violating level and resets script scopes", () => {
  const source =
    '<script context="module">for(;;){while(a){do {for(;;){break}} while(b)}}</script><script>for(;;){while(a){break}}</script>';
  expect(
    new ComponentFixture(source)
      .check()
      .map((diagnostic) => diagnostic.message),
  ).toEqual([
    "Blocks are nested too deeply (3). Maximum allowed is 2.",
    "Blocks are nested too deeply (4). Maximum allowed is 2.",
  ]);
});

it("returns original UTF-16 offsets after astral Unicode and CRLF", () => {
  const source =
    '<p>🧠 café</p>\r\n<script lang="ts">if (ready) run();</script>\r\n{ready ? "🧠" : "no"}';
  const diagnostics = new ComponentFixture(source).check();
  expect(
    diagnostics.map((diagnostic) =>
      source.slice(diagnostic.start, diagnostic.end),
    ),
  ).toEqual(["if (ready) run();", 'ready ? "🧠" : "no"']);
  expect(diagnostics.map((diagnostic) => diagnostic.start)).toEqual([
    source.indexOf("if (ready)"),
    source.indexOf('ready ? "🧠"'),
  ]);
});

it("applies the caller's button exception only to restricted syntax", () => {
  const source =
    "<script>if (ready) {for(;;){while(ready){break}}} first(() => second(() => third(() => work())));</script>";
  const filepath = "src/lib/components/ui/button/button.svelte";
  expect(
    checkAuthoredSvelte({ source, filepath, allowConditionals: true }).map(
      (diagnostic) => diagnostic.rule,
    ),
  ).toEqual(["max-depth", "max-nested-callbacks"]);
  expect(
    checkAuthoredSvelte({ source, filepath, allowConditionals: false }).map(
      (diagnostic) => diagnostic.rule,
    ),
  ).toEqual(["no-restricted-syntax", "max-depth", "max-nested-callbacks"]);
});

it("propagates compiler parse failures instead of returning a clean check", () => {
  expect(() =>
    new ComponentFixture("<script>const broken = ;</script>").check(),
  ).toThrow();
  expect(() => new ComponentFixture("{#if ready}<p>broken").check()).toThrow();
});
