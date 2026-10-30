# Native frontend checks

The frontend checks authored TypeScript, JavaScript, and Svelte with native
TypeScript 7. Project-owned adapters connect maintained tools and preserve
checks that need original Svelte syntax or native semantic queries. The
[package scripts](../../package.json) own the entry commands; the JSON
configurations beside this guide own exact lint rules and options.

## Commands

Run these commands from `app/visualization/frontend` with its frozen dependencies
installed:

```sh
bun run typecheck
bun run lint
bun run test -- tools/checks
```

`typecheck` runs the native Svelte compiler/type checker and component CSS checks.
`lint` refreshes native projections, then checks authored files, mapped component
code, Svelte rules, and CSS. The focused Vitest command exercises the committed
adapter fixtures. Full frontend verification remains `bun run verify`,
`bun run test`, and `bun run build`; contract generation remains
`bun run generate:contracts`.

## Protection ownership and fixtures

The mapping below identifies families, not a second rule catalog. A configured
rule can be inactive for a particular file, Svelte version, runes mode, or Kit
context. Fixture coverage of an adapter does not establish every underlying
rule's behavioral parity.

- **Strict types, unused symbols, and component diagnostics**
  - Owner: native TypeScript through `@rsvelte/svelte-check`, using
    [the project configuration](../../tsconfig.json) and [orchestration](check.ts).
  - Evidence: full `typecheck` plus diagnostic and file-discovery CLI probes.
    These are distinct from the focused source-map fixtures.
- **Core JavaScript, TypeScript syntax, and type-aware lint**
  - Owner: type-aware Oxlint and official `oxlint-plugin-eslint` configured in
    [authored rules](oxlint.json) and [projected rules](oxlint-projected.json).
    [Projection ownership](projection.ts) maps native findings back to source.
  - Fixtures: [projection tests](projection.test.ts) cover Unicode, CRLF, sparse
    and mixed mappings, template keys, and authored code inside generated wrappers.
    The baseline CLI differential corpus supplies per-rule comparison evidence;
    it is not part of these committed projection tests.
- **Authored branching and nesting**
  - Owner: [AuthoredSvelteCheck](authored-svelte.ts), using the Svelte compiler AST
    for JavaScript `if`/ternary restrictions, block depth, and callback depth
    including constructors. Svelte `{#if}` remains allowed. Only the existing
    button component path receives the branching exception.
  - Fixtures: [authored Svelte tests](authored-svelte.test.ts) cover script and
    template expressions, scope boundaries, constructor callbacks, and the exception.
- **Svelte syntax and semantic protections**
  - Owner: native rsvelte lint under [its configured rules](rsvelte-lint.json).
    [SvelteTypeChecks](svelte-types.ts) supplies native semantic queries for unused
    Props and reactive store access. [NativeProject](native-project.ts) owns the
    TypeScript async API process, snapshot, and source-root coverage.
  - Fixtures: [native semantic tests](svelte-types.test.ts) cover nested Props,
    imported stores, rest capture, shadowed bindings, unions, directive contexts,
    missing mappings, and disposed compiler resources. Other Svelte families need
    their eligible CLI differential cases; these tests do not cover every rule.
- **CSS, accessibility, and compiler warnings**
  - Owner: Svelte compiler diagnostics plus the maintained CSS language service
    in [ComponentCss](css.ts). Every warning remains a failing diagnostic.
  - Fixtures: [CSS tests](css.test.ts) cover property diagnostics and original
    positions; compiler/accessibility and unused-selector cases belong to CLI probes.
- **Unused graph, formatting, tests, build, and code generation**
  - Owner: existing Knip, Prettier/Svelte, Vitest, Vite, and
    [contract generation](../generate-contracts.ts), through the package scripts.
  - Evidence: run their existing commands. Local variable lint does not replace
    unused import/export/dependency analysis or contract generation.

## Source provenance and failures

[CheckCommand](command.ts) runs subprocesses through the current Bun executable.
The rsvelte CLI owns `.svelte-check` projections and incremental cleanup.
[GeneratedSyntax](generated-syntax.ts) and the projection adapter distinguish
compiler scaffolding from authored code using transform output, source maps,
and syntax ownership. Native byte spans must map to original UTF-16 source
positions, including astral characters and CRLF.

- Keep imports and native type context when checking projected code. Do not
  suppress an authored expression merely because its diagnostic crosses a wrapper.
- Treat unknown mappings, missing projects or source roots, malformed tool output,
  incomplete file counts, and subprocess failures as failures, not clean results.
- Check scriptless components, module scripts, companion `.svelte.ts` files,
  declarations, tools, and configuration files. Added/deleted source files must
  affect the next run. Generated contracts remain typechecked and formatted even
  though lint and Knip exclude them.
- Keep the installed and resolved production graph free of TypeScript 6 adapters.
  Historical comparison tools belong only to isolated verification evidence.

## Maintenance evidence

When changing an adapter or upgrading a tool:

1. Inspect its runtime configuration and upstream API at the installed version.
   The native `typescript/unstable/async` API and rsvelte transform shape are
   explicit integration boundaries; changes require focused regression checks.
2. Add or update the owning fixture for the behavior being changed. Include a
   violating case, an allowed case, and original source-location assertions when
   mapping is involved.
3. Run focused tests and compare applicable baseline CLI cases, preserving
   configured options and actual rule eligibility. Record uncovered families
   rather than inferring complete parity from a clean application run.
4. Run the existing full frontend commands and report their actual results.
   Include fresh-file cleanup and tool-failure probes when those boundaries change.
