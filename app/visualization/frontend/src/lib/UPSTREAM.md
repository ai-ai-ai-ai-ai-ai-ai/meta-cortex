# Upstream UI components

The dashboard uses the official shadcn-svelte Vega components directly:
Sidebar, Card, Input, Separator, Tooltip, Button, Badge, Progress, Tabs, Sheet,
Table and Accordion. Components were generated with `shadcn-svelte@1.7.0`
from the [official registry](https://www.shadcn-svelte.com/registry/styles/vega/sidebar.json),
most recently on 2026-10-03. Files use the registry's standard `$UI$`/`$UTILS$`
alias and Lucide icon substitutions, formatted with the project configuration.
Prop signatures, variants, bindable state and interactions remain upstream owned.
All Bits imports stay inside these generated files.

Only used component families and their internal dependencies are retained.
Unused Sidebar utilities, Card Action/Footer, Sheet Trigger/Footer/Close and
Table Footer are omitted. Native Select was removed with the feature dropdown;
the Sidebar now owns navigation. Public barrels retain the registry's aliases
and are explicit Knip entrypoints, as is Sidebar's context API. Authored exports
remain checked for unused code.

## Theme and pinned Bits compatibility

The CSS variables use the [official neutral theme](https://www.shadcn-svelte.com/registry/colors/neutral.json).
Card and Sidebar aliases reuse those neutral tokens. Semantic task state colors
are applied by the application to stock badges; there are no custom component
variants. `package.json` and `bun.lock` retain the existing pinned releases.

Installed Bits UI 2.19.4 exposes `data-orientation="horizontal"` or `"vertical"`
and `data-state="active"`, `"open"` or `"closed"`. Registry shorthand selectors
are substituted with the corresponding attribute selectors, including named
group variants. This applies to Tabs, Sheet, Accordion, Tooltip and the Sidebar
menu's open state. Sidebar MenuButton itself emits `data-active=true/false`, so
its active selector is `data-[active=true]:`. These attribute substitutions
preserve stock appearance with the pinned packages.

The generated Button, Badge, Sidebar root and Sidebar context retain their
upstream branches under file-specific `no-restricted-syntax` exemptions. Input
and Sidebar MenuButton preserve externally owned Svelte prop contracts under
`no-unsafe-assignment` exemptions; Sidebar root and trigger have a corresponding
`no-unsafe-argument` exemption for forwarded props. These rules remain enabled
for all authored application code.

## Application composition

The expandable DataTable follows the official
[Data Table recipe](https://www.shadcn-svelte.com/docs/components/data-table)
using `@tanstack/svelte-table@9.2.4` and its installed row-expansion APIs.
Only row expansion, stable native row IDs and subRows are used; paging remains
native. `src/DataTable.svelte` owns application columns outside generated UI.

`d3-hierarchy@3.1.2` builds the reporting tree with `stratify` and supplies its
nodes directly to TanStack. D3 owns traversal, ancestry and leaves. The
application maps recorded ownership and historical actors to parent IDs and
table fields. Historical records stay separate from recorded reporting edges.

Knip 5.63.1 does not analyze stylesheet imports. Its sole ignored dependency is
`tw-animate-css`, imported by `src/styles.css` for stock component animations.
Authored source, exports and every other dependency remain checked.
