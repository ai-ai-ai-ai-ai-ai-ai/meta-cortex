# Web Unused-Code Enforcement

Check files, exports, types, enum members, class members, and dependencies in
every affected authored TS/Svelte project. Exclude generated/vendor declarations.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Check what the installed tool cannot see

TypeScript/ESLint and Knip inspect different surfaces. Knip 5 included classMembers;
Knip 6 does not. When members are not traced, audit direct, optional-chained,
internal this, Svelte, generated-boundary, and test callers explicitly.

**Prohibited:**

```ts
// Retained only for hypothetical compatibility; no actual caller exists:
legacySave(request: SaveRequest) { return this.save(request); }
```

**Preferred:**

```ts
// Only the operation with actual callers remains:
save(request: SaveRequest): SaveOperation {
  return this.store.save(request);
}
```

## Fix findings without deleting live behavior

Delete or correctly connect unused code. Do not add authored ignores, shrink
issue coverage, or retain callerless aliases. If markup calls are invisible to
Knip, narrow the public API to a private implementation returned by an exported
owner factory. Do not suppress the finding or remove live behavior.

**Prohibited:**

```ts
export class PanelController {
  // Public class surface is untraceable to the configured checker.
  open(): void { /* implementation */ }
}
```

**Preferred:**

```ts
class PanelController {
  open(): void { /* implementation */ }
}
export class Panel {
  static build(): PanelController { return new PanelController(); }
}
```

## Do not hide reactive state behind JSON

JSON stringify/parse is not a state-unwrapping tool. Rune-aware callers use
snapshot directly at the boundary, with named typed arguments for ordinary calls.

**Prohibited:**

```ts
api.submit(JSON.parse(JSON.stringify(request)));
```

**Preferred:**

```ts
const snapshot: OrderRequest = $state.snapshot(request);
api.submit(snapshot);
```

## Validation

- Search every consumer before deleting a controller member.
- Require zero unused-code findings for each affected project.
- Audit members separately when the configured tool cannot trace their callers.
