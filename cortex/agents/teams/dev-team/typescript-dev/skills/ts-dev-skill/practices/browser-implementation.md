# Browser Implementation

Implement browser UI with the prescribed Svelte stack. The assignment supplies
design, cross-language, and security prerequisites.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Use the existing UI stack

Use Svelte 5 runes, Vite/Bun through Taskfile workflows, Tailwind v4 with semantic
app.css variables, and shared lib/components/ui primitives. Use tailwind-variants,
tailwind-merge, cn, and @lucide/svelte. Motion uses CSS, tw-animate-css, or Svelte.
Do not add React/Next/JSX/TSX, React-only/shadcn React components, or a parallel UI
system. Inspect package.json before justifying any dependency. Impeccable requires
an explicit user request by name.

**Prohibited:**

```ts
import { Button } from "@some-react-ui/button";
```

**Preferred:**

```ts
import { Button } from "$lib/components/ui/button";
```

## Let Svelte own rendering and interactions

Keep markup readable and components thin. Use typed props/generated types,
semantic HTML before ARIA patches, semantic keys for lists, and package event
conventions. Use explicit enum states rather than null/undefined. Keep product
validation, authorization, crypto, shaping, and durable policy in Rust/WASM.

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

Return cleanup from $effect for listeners, observers, timers, and animation
state. Keep continuous pointer/scroll values outside component-wide runes, using
CSS, IntersectionObserver, or a narrow action. Keep shared app state/effects in
the existing .svelte.ts controller pattern, not a second store architecture.

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

Use the shared Rust-owned translation catalogs through the application API.
Maintain all locales; do not hide English in fallback branches or ARIA labels.

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

- Add/update focused Playwright UI-demo coverage for changed interactions.
- Run formatting and applicable UI checks; inspect app logs before changing code after a failure.
- Verify dependency direction, translations, lifecycle cleanup, and secret surfaces.
