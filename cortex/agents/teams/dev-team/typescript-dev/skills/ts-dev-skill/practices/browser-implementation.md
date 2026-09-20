# Browser Implementation

Apply these implementation requirements to browser UI and Svelte components.
The assignment supplies the design requirements and cross-language contracts.

## Fixed Stack

- Use Svelte 5 with `$props`, `$state`, `$derived`, and focused `$effect` runes.
- Use Vite and Bun through repository Taskfile workflows.
- Use Tailwind CSS v4 and semantic CSS variables from `app.css`.
- Reuse shared Svelte UI primitives from
  the owning application's shared `lib/components/ui/` directory.
- Use `tailwind-variants`, `tailwind-merge`, and `cn` for variants.
- Use `@lucide/svelte` as the single ordinary icon family.
- Use CSS, `tw-animate-css`, and Svelte-native behavior for normal motion.
- Do not add React, Next.js, JSX/TSX, React-only packages, shadcn React
  components, or a parallel component system.
- Do not add a design or animation dependency when the fixed stack suffices.
- Inspect the owning `package.json` and justify any new dependency.
- Impeccable is opt-in. Do not load, install, or run it unless the user
  explicitly requests it by name.


## Svelte 5 Rules

- Keep markup readable and components thin.
- Follow TypeScript explicit state: authored
  JavaScript, TypeScript, and Svelte use neither `undefined` nor `null` for
  value absence. Normalize external absence at its narrow boundary and model
  application state with a named enum-backed discriminated union.
- Use typed props and generated `$app-wasm` types directly.
- Key stable collections with their semantic identifier.
- Prefer semantic elements to ARIA patches.
- Follow the package's Svelte event conventions.
- Return cleanup from `$effect` for listeners, observers, timers, and external
  animation state.
- Keep continuous pointer and scroll values outside component-wide rune state.
  Prefer CSS, `IntersectionObserver`, or a narrow action.
- Keep application-wide state and effects in the existing `.svelte.ts`
  controller pattern. Do not create React-style stores.
- Svelte renders and coordinates; it does not own vault policy.


## Rust, WASM, And Security

Preserve the dependency direction: authentication and domain core → WASM bridge → web presentation.

- Put validation, authorization, cryptography, vault decisions, data shaping,
  and durable behavior in typed Rust exposed through WASM.
- Limit Svelte to presentation state, browser ceremonies, lifecycle,
  accessibility, and explicit interaction.
- Do not mirror Rust enums or DTOs with TypeScript string unions.
- Never place secrets in URLs, logs, DOM attributes, test IDs, analytics, or
  hidden fallback markup.
- Never persist plaintext secrets in browser convenience state.
- Mask sensitive values until explicit reveal. Clear temporary revealed or
  generated state when hidden or dismissed.
- Keep passkey creation explicit. Default setup to authentication with an
  existing credential; never infer credential absence from cancellation.

Any visual shortcut that weakens these boundaries is a failed design.


## Browser Capabilities

- Use capability and state detection, not viewport heuristics, for browser and
  extension functionality.

## Translation Integration

- Put every visible product string and accessible name in the shared Rust-owned
  translation catalogs and render it through the application's translation API.
- Preserve parity across every supported language catalog.
- Do not hide inline English in fallbacks, conditionals, or ARIA attributes.

## Browser Validation

- Add or update focused Playwright UI-demo coverage.
- Run formatting and the applicable UI checks.
- Inspect attached app logs before changing code after a browser-test failure.
