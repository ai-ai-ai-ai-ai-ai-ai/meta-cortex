# Browser Implementation

Implement browser UI with the consuming project's stack and design system.
The assignment supplies design, cross-language, and security prerequisites.
Svelte examples apply to Svelte consumers only.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Use the existing UI stack

Inspect the project's instructions, package.json, components, design tokens,
and documented build commands. Reuse its framework, package manager, component
library, icons, and motion tools. Do not introduce a parallel UI system or change
the command runner as an incidental implementation step. In Svelte 5 projects,
use runes and the existing Svelte primitives. Use Tailwind, Vite, Bun, or Taskfile
only when the project selects them. Impeccable requires an explicit user request
by name.

This pair assumes an existing Svelte project whose button lives at
`$lib/components/ui/button`.

**Prohibited:**

```ts
import { Button } from "@some-react-ui/button";
```

**Preferred:**

```ts
import { Button } from "$lib/components/ui/button";
```

## Let the UI framework own rendering and interactions

Keep markup readable and components thin. Use typed props/generated types,
semantic HTML before ARIA patches, semantic keys for lists, and package event
conventions. Use explicit enum states rather than null/undefined. Keep product
validation, authorization, crypto, shaping, and durable policy in the project's
domain owner. In Rust/WASM projects, that owner is Rust; elsewhere it may be
TypeScript. Components consume its decisions instead of reimplementing them.

**Prohibited:**

```ts
// A component reimplements a portable policy:
const action = observation.kind === PageKind.Checkout
  ? PageAction.OfferAssistance : PageAction.Ignore;
```

**Preferred:**

```ts
// Inside the component interaction handler:
const action = policy.classify(observation);
browser.apply(action);
```

## Release lifecycle resources

Use the framework's lifecycle cleanup for listeners, observers, timers, and
animation state. In Svelte, return cleanup from $effect. Keep continuous
pointer/scroll values outside broad component state, using CSS, observers, or
narrow framework adapters. Reuse the project's state ownership pattern; retain
existing .svelte.ts controllers in Svelte projects rather than adding a second
store architecture.

**Prohibited:**

```ts
// Inside the component:
$effect(() => { viewport.subscribe(); });
```

**Preferred:**

```ts
// subscribe returns a callable cleanup; the port owns the browser details.
$effect(() => {
  const release = viewport.subscribe();
  return release;
});
```

## Detect capabilities, not screen size

Use actual browser/extension capability and state detection. A small viewport
is not evidence that an API is unavailable.

**Prohibited:**

```ts
if (viewport.kind === ViewportKind.Narrow) {
  panel.hideClipboard();
}
```

**Preferred:**

```ts
switch (clipboardSupport.kind) {
  case ClipboardSupportKind.Available: return panel.showClipboard();
  case ClipboardSupportKind.Unavailable: return panel.hideClipboard();
}
```

## Keep secrets out of incidental surfaces

No secrets in URLs/logs/DOM attributes/test IDs/analytics/hidden markup or
persistent convenience state. Mask until explicit reveal; clear temporary
revealed/generated state on hide/dismissal. Keep passkey creation explicit and
never infer missing credentials from cancellation.

**Prohibited:**

```ts
logger.info(secret);
location.hash = secret;
```

**Preferred:**

```ts
// Log a typed event, never the secret value.
logger.info(DisclosureEvent.Concealed);
// Inside the disclosure owner, release the transient revealed state.
disclosure.conceal();
```

## Translate visible and accessible text

Use the project's translation catalogs through its application API. Preserve
Rust ownership when the project supplies Rust-owned catalogs; do not require
Rust solely for localization. Maintain all supported locales and route visible
and accessible text through the same translation system. Do not hide English
in fallback branches or ARIA labels.

**Prohibited:**

```ts
// Inside the presentation owner:
const label = "Save document";
```

**Preferred:**

```ts
const label = translations.label(TranslationKey.SaveDocument);
```

## Validation

- Add/update focused browser coverage for changed interactions using the project's test tooling.
- Run formatting and applicable UI checks; inspect app logs before changing code after a failure.
- Verify dependency direction, translations, lifecycle cleanup, and secret surfaces.
