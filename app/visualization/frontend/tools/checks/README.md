# Maintained frontend checks

The frontend uses native TypeScript 7 with maintained command-line tools.
Project-owned checker runtime, projection adapters, and semantic supplements are
removed. The [package scripts](../../package.json) define the commands; the
configurations linked below define their scope and options.

## Commands and ownership

Run the existing frontend gates from `app/visualization/frontend` with its frozen
dependencies installed and Bun plus Node.js 24 on `PATH`:

```sh
bun run verify
bun run test
bun run build
```

- **Type checking:** `bun run typecheck` runs
  `rsvelte-check --tsconfig tsconfig.json --incremental --fail-on-warnings`.
  The stock CLI uses the workspace TypeScript 7 compiler and
  [strict project settings](../../tsconfig.json). It owns Svelte projection,
  compiler diagnostics, and incremental cleanup; no project adapter rewrites output.
- **Lint:** `bun run lint` runs type-aware Oxlint over ordinary source, tools, and
  configuration files, then rsvelte lint over `src`. The
  [root Oxlint configuration](../../.oxlintrc.json) retains maintained JavaScript
  and TypeScript rules and test-only Vitest guards. Stock Oxlint also checks
  supported Svelte script fragments, with the existing `prefer-const` exception
  for `.svelte` files. Generated overlays remain excluded.
  The [Svelte configuration](rsvelte-lint.json) retains
  maintained checks for components and eligible companion modules.
- **Other gates:** `verify` also runs Prettier and Knip. Vitest, Vite, and
  `bun run generate:contracts` retain their existing roles. The
  [Oxlint CLI tests](oxlint.test.ts) cover representative bug checks,
  constructor callback limits, focused tests, Svelte script restrictions, and
  allowed operations including Svelte Props destructuring.

Type errors, compiler warnings, lint warnings, and tool failures still fail their
commands. The two known Mermaid vendor chunk-size warnings remain visible in Vite
builds; this deferral does not broaden their existing exception.

## Deferred protections

The removed adapters supplied coverage beyond the current maintained tools.
The following protections are deferred while supported tooling catches up:

- Full type-aware Svelte lint and generic checks across template expressions,
  including the removed provenance mapping and JavaScript projection corrections.
  Configured `if`/ternary restrictions, block depth, and constructor callback
  limits remain active in supported script fragments; template coverage is deferred.
- Supplemental nested unused-Props and imported-store semantic checks. Maintained
  Svelte rules still run; the missing cases do not imply that every Props or store
  diagnostic is unavailable.
- Applying `no-svelte-internal` and `no-store-async` to ordinary TypeScript and
  JavaScript modules through renamed copies. Eligible Svelte companions still
  receive maintained Svelte lint.
- Extra CSS language-service diagnostics previously composed by the project.
  Maintained compiler, accessibility, and CSS-related diagnostics remain active.

A passing stock-tool run establishes its current coverage, not parity with the
removed checks. The deferred fixtures and earlier comparison evidence remain
relevant when evaluating a replacement; they are not active production checks.

## Revisit with maintained TypeScript 7.1 tooling

As of October 30, 2026, Microsoft's
[TypeScript 7.1 plan](https://github.com/microsoft/TypeScript/issues/63703)
targets November 24, 2026 for stable release. This is a planned date, not a
release guarantee or proof that dependent tools will restore the missing checks.

1. Confirm stable TypeScript 7.1 and compatible maintained tools are available
   before upgrading. Check their supported APIs and published compatibility.
2. Re-run the deferred violating and allowed fixtures against the candidate tools,
   including original source locations and each affected file kind. Restore only
   the protections demonstrated by those results.
3. Run the existing full frontend gates and update this coverage record. Keep
   unresolved gaps explicit; do not automatically restore checks or add custom
   runtime, feature flags, or scheduled upgrade machinery.
