# Web Unused-Code Enforcement

## Purpose

Keep every authored web project free of unreachable files, exports, types,
enum members, class members, and dependencies.

## Problem Pattern

The two project graphs expose different evidence:

- TypeScript and ESLint catch unused local declarations.
- The production Knip 5 graph also checks `classMembers`.
- Knip 6 removed that issue type.
  - The isolated research graph cannot rely on Knip to find abandoned public
    methods and fields.

## Preferred Pattern

- Include files, exports, types, enum members, class members, and dependencies
  in unused-code review. When the installed tool does not inspect class
  members, audit their callers explicitly.
- A green Knip result is not proof that an exported Svelte store has no dead
  members. Audit exported store methods and accessors against direct,
  optional-chained, test, and internal `this` call sites; delete compatibility
  members with no caller.
- Delete or correctly connect every valid finding. Do not add authored-code
  ignores, reduce issue coverage, or keep compatibility aliases without an
  actual caller.
- When removing a state-controller member, search Svelte, TypeScript, tests,
  and generated-boundary call sites before deletion.
- If a member is demonstrably called only through Svelte markup and Knip cannot
  trace the exported class, narrow the module API to a private implementation
  returned by an exported factory. Do not suppress the finding or delete live
  behavior.
- Preflight rejects JSON serialize/parse round trips in authored web source.
  Rune-aware code uses `$state.snapshot` directly at the boundary.

## Scope

- Apply to all authored TypeScript and Svelte code.
- Exclude generated WASM declarations and third-party or vendor code from the
  authored project graph.

## Validation

Run the unused-code checks for every affected web project; require zero
findings. Audit class members separately when the installed tool cannot trace
them, including direct, framework, generated, and test consumers.
