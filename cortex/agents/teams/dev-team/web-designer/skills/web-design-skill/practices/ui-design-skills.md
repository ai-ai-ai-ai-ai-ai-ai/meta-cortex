# Svelte UI Design

Ship deliberate, calm, trustworthy interfaces without weakening product
truth or security boundaries. This is the canonical UI design authority.

Every user-visible UI task must load and apply this card when it:
- designs, implements, redesigns, polishes, or reviews vault, website,
  browser-extension, landing, help, settings, onboarding, or authentication; or
- changes responsive behavior, accessibility, motion, visual state, components, or styling.

## Evidence And Direction

Before editing:

1. Read the assigned design brief.
2. Select the product or interface specification for the assigned interaction.
3. Inspect the real target at runtime when possible.
4. Inspect an incumbent source of visual truth:
   - the owning application's `app.css`;
   - the nearest shared `lib/components/ui/` primitive;
   - a comparable shipping Svelte component; or
   - existing light and dark rendered states.
5. State the surface, user task, retained interface pattern, visual direction, and
   interaction priority.

Use the surface mode that matches the task:

- **Operate:** vault, settings, authentication, recovery, sync, and extension
  UI prioritize scanning, explicit state, restrained motion, and trust.
- **Persuade:** landing and product explanation prioritize strong hierarchy,
  memorable composition, and real product evidence.
- **Read:** help, legal, logs, and documentation prioritize comprehension,
  navigation, readable measure, and quiet chrome.
- **Experience:** research and showcases use artifact-led composition only
  within explicit experimental scope.

Existing product rhythm and the brief win. Ask one focused aesthetic question
only when two materially different directions remain plausible.

- Preserve established routes, analytics contracts, and interaction semantics
  unless the task scope changes them.

## Components, Tokens, And Themes

- Reuse `Button`, `Card`, `Select`, separators, and nearby shared components.
- Extend repeated primitive variants instead of duplicating utility strings.
- Use semantic tokens such as `bg-background`, `text-foreground`, `bg-card`,
  `text-muted-foreground`, `border-border`, `bg-primary`, and
  `text-destructive`.
- Preserve the radius scale rooted at `--radius: 0.375rem`.
- Use hard-coded color only for semantics or third-party identity that tokens
  cannot express.
- Support the existing light and `.dark` themes. Do not add another theme
  mechanism or flip theme per section.
- Create distinction with hierarchy, rhythm, typography, and state before new
  accent colors.

## Hierarchy, Forms, And States

- Give each surface one obvious primary task.
- Keep the primary action dominant and destructive actions separate.
- Prefer typography, spacing, alignment, and progressive disclosure to extra
  containers.
- Avoid nested cards, badge soup, and decorative status noise.
- Keep security and recovery consequences beside their action.
- Give every field a persistent label and meaningful browser attributes.
- Put helper text by its control and actionable error text by its field.
- Never use placeholder text as the only label.
- Disable controls only when unavailable and explain non-obvious disabled state.
- Prevent button-label wrapping at normal desktop and mobile widths.
- Preserve focus after inline changes and return focus when dialogs close.
- Design loading, empty, error, disabled, pending, success, offline, locked,
  stale, conflict, and recovery states without layout collapse.
- Empty states expose the next useful action.
- Success acknowledgment must not obscure the next task.
- Design focus, hover, and active states for every interactive control.
- Never polish only the successful static state while leaving real failure or
  recovery paths unfinished.

## Responsive Behavior And Motion

- Inspect phone, compact desktop, and normal desktop sizes.
- Collapse multi-column product layouts deliberately below `768px`.
- Keep practical tap targets at least 44 by 44 CSS pixels.
- Keep dialogs, forms, and actions inside the visual viewport.
- Account for browser zoom, translation expansion, and long user-provided names.
- Prevent horizontal overflow; never hide broken layout with arbitrary clipping.
- Use `100svh` or `100dvh` intentionally; avoid mobile `100vh` or `h-screen`
  jumps.
- Add motion only for feedback, hierarchy, transition, or comprehension.
- Prefer existing CSS transitions and animate `transform` or `opacity`, not
  layout properties.
- Honor `prefers-reduced-motion`.
- Do not add perpetual motion to security, recovery, or dense Operate surfaces.
- Do not use custom cursors, scroll hijacking, magnetic buttons, or decorative
  parallax in the vault product.

## Anti-Slop Rules

- Do not default to purple-blue glow, centered gradient heroes, pervasive
  glass, or repeated identical feature cards.
- Do not fabricate product UI, metrics, testimonials, logos, security claims,
  compatibility claims, or user data.
- Use real product evidence or an approved asset instead of decorative mock UI.
- Do not use generic AI copy, fake terminal metadata, decorative status dots,
  weather strips, version stamps, or scroll instructions.
- Avoid repeated eyebrow labels and repeated section layouts.
- Keep heroes to one headline, concise support, and at most two actions.
- Point production extension calls to action to the Chrome Web Store.
  Manual ZIP loading belongs only to development or preview guidance.
- Generate bitmaps only when a surface genuinely needs one. Reuse code-native
  controls, icons, diagrams, and project brand assets.

## Copy And Accessibility

- Use field-specific labels and descriptions; accessibility outranks
  deduplication.
- Ensure keyboard navigation, visible focus, logical order, dialog focus
  management, and screen-reader names.
- Meet WCAG AA contrast for text, controls, placeholders, focus rings, and
  errors in light and dark themes.
- Never use color alone for lock, sync, success, error, or destructive state.
- Re-read copy for clarity, factual truth, and translation expansion.

## Validation

1. Inspect the real rendered flow before editing when possible.
2. Apply the assigned layout, markup, and styling changes.
3. Inspect every changed state in light and dark themes.
4. Inspect representative phone and desktop widths.
5. Capture the changed visual states and report defects with reproduction steps.
6. Run formatting and the applicable visual and accessibility checks.

Any applicable failed directive means the UI is not ready.
