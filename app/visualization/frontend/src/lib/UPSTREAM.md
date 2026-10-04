# Upstream UI components

The dashboard uses the official shadcn-svelte Vega Button directly. It was
generated with `shadcn-svelte@1.7.0` from the
[official registry](https://www.shadcn-svelte.com/registry/styles/vega/button.json),
most recently on 2026-10-03. The file uses the registry's standard `$UI$`/`$UTILS$`
alias substitutions, formatted with the project configuration.
Prop signatures, variants and interactions remain upstream owned.

Only used component families are retained. The dashboard composes its
cards, chips and progress bars from application CSS and Tailwind utilities, so no other registry
components are installed. The public barrel retains the registry's aliases and
is an explicit Knip entrypoint. Authored exports remain checked for unused code.

## Theme

The CSS variables use the [official neutral theme](https://www.shadcn-svelte.com/registry/colors/neutral.json).
Semantic task state colors are applied by the application; there are no custom
component variants. `package.json` and `bun.lock` retain the existing pinned releases.

The generated Button retains its upstream branches under a file-specific
`no-restricted-syntax` exemption. The rule remains enabled for all authored
application code.

## Application composition

Knip 5.63.1 does not analyze stylesheet imports. Its sole ignored dependency is
`tw-animate-css`, imported by `src/styles.css` for stock component animations.
Authored source, exports and every other dependency remain checked.
