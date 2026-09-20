---
name: web-dev-skill
description: Apply web and Svelte development rules for presentation, state, accessibility, domain boundaries, and browser validation.
---

# Web Development Skill

Apply these practices with the coding and TypeScript prerequisites supplied
by the assignment’s skill composition.

## Required practices

- [Browser testing](practices/browser-testing.md): retain unit-first regression coverage, Playwright integration evidence, and executable suite coverage.

- [UI design](practices/ui-design-skills.md): preserve the specified Svelte stack, shared components, semantic tokens, explicit interaction states, responsive behavior, accessibility, and localization requirements.
- [Svelte state](practices/svelte-state-modeling.md): initialize meaningful state explicitly, use enum-backed discriminated unions, preserve generated domain types, and keep portable workflows in Rust.
- [Unused code](practices/web-unused-code.md): require zero unused-code findings and audit class members when tooling cannot trace them. Do not suppress findings or retain unused compatibility aliases.

Read applicable practices in full. Runtime enums used by Svelte components
belong in adjacent `.ts` modules. Place `$state.snapshot` at the rune-owning
boundary; never use JSON serialization round trips to unwrap reactive data.

Inspect changed interactions in the browser, including error and recovery
states, keyboard behavior, supported themes, and representative viewport sizes.
Type checking alone does not establish correct rendering or interaction.
