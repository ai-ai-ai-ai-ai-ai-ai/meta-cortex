# Upstream UI components

Button, Badge, Card, Progress, and `utils.ts` were generated with
`shadcn-svelte@1.7.0 add button badge card progress utils --yes --no-deps-install`
from the official [Vega registry](https://www.shadcn-svelte.com/registry/styles/vega/index.json).
Only these four primitives are installed. Card retains its upstream component
parts and every primitive retains its public exports and prop contracts.

The generated source is formatted with the project's Prettier configuration.
Badge adds one project-owned `status` variant: Tailwind data attributes select
the existing dashboard state colors without interpreting domain state in code.
All upstream variants remain available.

The exact dependency pins are in `package.json` and `bun.lock`. Tailwind uses its
official Vite plugin and the existing stylesheet; `$lib` resolves in TypeScript
and Vite. No runtime theme mechanism or extra component library is added.

The button and badge registry templates contain ternary expressions in their
externally owned anchor/disabled rendering. ESLint excludes only these two
generated files from the authored-code branching prohibition, preserving all
other lint checks. Authored configuration, tests, and dashboard components
remain under the full policy. Generated utility conditional types and bindable
element refs keep the upstream signatures rather than replacing their APIs.

Progress forwards `value` and `max` to Bits UI, which exposes them as
`aria-valuenow` and `aria-valuemax` on a progressbar. Its indicator divides the
value by the supplied maximum, so task totals do not need to become percentages.
Button's bindable `ref` is its native button when no `href` is supplied.

Dependency adoption was checked on 2026-10-02 through the
[npm downloads API](https://api.npmjs.org/downloads/point/last-week/tailwindcss)
and each repository's GitHub API. Weekly downloads cover 2026-09-24–2026-09-30.
Every dependency exceeds 10,000 weekly downloads and 100 stars.

| Package                 | Weekly downloads |                                         Repository stars |
| ----------------------- | ---------------: | -------------------------------------------------------: |
| tailwindcss             |      156,238,200 |    [97,748](https://github.com/tailwindlabs/tailwindcss) |
| @tailwindcss/vite       |       58,215,290 |    [97,748](https://github.com/tailwindlabs/tailwindcss) |
| tailwind-variants       |        4,810,914 | [3,314](https://github.com/heroui-inc/tailwind-variants) |
| bits-ui                 |        1,260,067 |            [3,589](https://github.com/huntabyte/bits-ui) |
| @internationalized/date |       19,040,557 |        [15,906](https://github.com/adobe/react-spectrum) |
| cn                      |        7,904,565 |                 [1,622](https://github.com/shadcn-ui/cn) |
