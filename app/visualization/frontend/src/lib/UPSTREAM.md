# Upstream UI components

The dashboard imports the official shadcn-svelte Vega Button, Badge, Progress,
Tabs, Sheet, Table, Accordion and Native Select components directly.
Original Button/Badge/Progress/Tabs generation used
`shadcn-svelte@1.7.0`; the stock redesign restores Button/Badge and adds the other
used components from the official registry on 2026-10-02:

`https://www.shadcn-svelte.com/registry/styles/vega/{component}.json`

Sources are copied with the registry's standard `$UI$`/`$UTILS$` alias and Lucide
icon substitutions, then formatted with the project configuration. Component
bodies, variants, bindable state and prop signatures remain upstream owned.
No application wrapper replaces a library interaction. All Bits imports stay
inside these generated UI files. Stock neutral CSS variables come from the
[official neutral theme](https://www.shadcn-svelte.com/registry/colors/neutral.json).
The application has no custom palette, dashboard button variant or status badge
variant. The graph modes and their Svelte Flow/Dagre dependencies were removed.

## Pinned Bits compatibility

The installed Bits UI 2.19.4 source exposes `data-orientation="horizontal"` or
`"vertical"` and `data-state="active"`, `"open"` or `"closed"`. The current Vega
registry's shorthand selectors require attributes that this pinned release does
not emit. Generated class strings therefore substitute only these selectors:
`data-horizontal:`/`data-vertical:` become
`data-[orientation=horizontal]:`/`data-[orientation=vertical]:`, and
`data-active:`/`data-open:`/`data-closed:` become their matching
`data-[state=...]:` selectors, including their named group variants. This preserves stock appearance and interactions
without an application layout or focus workaround. Evidence is in the installed
`bits-ui/dist/bits/{tabs,dialog,accordion}` source and declarations.

Unused Card scaffold was removed after checking every application consumer.
Unused Sheet/Table footers, standalone Sheet Close and Native Select opt-group
files and exports were also removed. Sheet's portal and overlay remain because
Content uses them internally; Content owns its standard close button. The remaining generated public barrels retain their
upstream aliases and are explicit Knip entrypoints; authored runtime exports
remain checked.

`package.json` and `bun.lock` pin existing Svelte, Bits and Tailwind releases.
Used stock icons add `@lucide/svelte@1.50.0`; the stock animation stylesheet adds
`tw-animate-css@1.4.0`, imported by `styles.css`. The expandable application DataTable uses `@tanstack/svelte-table@9.2.4`, following the official [Data Table recipe](https://www.shadcn-svelte.com/docs/components/data-table) and installed v9 row-expansion APIs. It uses only row expansion, stable native row IDs and subRows; paging remains native. Its composition and columns live in authored `src/DataTable.svelte`, outside generated UI, and are counted as application code. Unused Collapsible files and their public barrel were removed after deleting recursive tree consumers.
Registry-generated Button/Badge anchor and disabled handling retain the existing
narrow ESLint exemption; authored components remain under the full policy.

`d3-hierarchy@3.1.2` builds the reporting tree with `stratify` and supplies its
nodes directly to TanStack. D3 owns traversal, ancestry and leaves; the
application maps recorded ownership and historical actors to parent IDs and
table fields. Historical records stay separate from recorded reporting edges.

Native Select retains Svelte's externally owned `HTMLSelectAttributes.value:any`
contract (`svelte/elements.d.ts`). Only `no-unsafe-assignment` is disabled for
that single generated Native Select file. Application change handlers use
Svelte's typed `ChangeEventHandler<HTMLSelectElement>`; all their lint rules
remain enabled.

Knip 5.63.1 does not analyze stylesheet imports. Its sole dependency declaration
is `tw-animate-css`, which is actually imported by `src/styles.css` for stock
component animations. `knip.json` lists exactly that CSS-only dependency under
`ignoreDependencies`; authored source, exports and every other dependency remain
checked. No custom CSS compiler or detection plugin is introduced.
