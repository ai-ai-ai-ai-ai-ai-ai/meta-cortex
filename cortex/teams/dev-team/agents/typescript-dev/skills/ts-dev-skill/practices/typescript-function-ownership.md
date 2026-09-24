# TypeScript Function Ownership

Put behavior, constants, and state on the type or component that owns them.
A file, namespace, Utils class, or empty instance is not an owner.

Apply the shared [ownership rules](../../../../../docs/programming/function-ownership.md).

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Use instances for owned behavior

- Put execution, validation, formatting, and dispatch on instances.
- Reserve static methods for narrow construction builders.
- Give enum semantics a concrete kind owner or typed companion.
- Never mutate primitive or enum prototypes.

**Prohibited:**

```ts
class ExportUtils {
  static run(request: ExportRequest): ExportOutcome {
    return ExportRuntime.run(request);
  }
}
```

**Preferred:**

```ts
class ExportSession {
  constructor(private readonly runtime: ExportRuntime) {}

  run(request: ExportRequest): ExportOutcome {
    return this.runtime.execute(request);
  }
}
```

## Own constants and mutable state

- Use `static readonly` for owned constants.
- Keep mutable state in instance fields.
- Prohibit module `const`/`let`/`var`, mutable statics, and function-valued globals.
- Treat a function-valued binding as behavior; assigning it does not establish ownership.
- Keep parameters, immediate callbacks, and local bindings in the owning operation.
- Let test-runner callbacks contain scenario setup, actions, and assertions.
- Put reusable test helpers on fixture or scenario owners under the shared
  [test ownership rule](../../../../../docs/programming/function-ownership.md#operation-placement).

**Prohibited:**

```ts
let selectedFormat = ExportFormat.Archive;
const changeFormat = (format: ExportFormat) => { selectedFormat = format; };
```

**Preferred:**

```ts
class ExportSelection {
  static readonly DEFAULT_FORMAT = ExportFormat.Archive;
  private format = ExportSelection.DEFAULT_FORMAT;

  select(format: ExportFormat): void {
    this.format = format;
  }
}
```

## Keep component ownership local

- Keep a Svelte handler or lifecycle callback on the component when it uses
  that component's state or interaction contract.
- Move module-script globals and shared product behavior to their domain owner.
- Do not rename execution to build or create empty objects to retain former statics.

**Prohibited:**

```ts
// In a component script:
function classifyOrder(order: Order): OrderOutcome {
  return orderPolicy.classify(order);
}
```

**Preferred:**

```ts
// In the component's interaction handler:
const outcome = orderPolicy.classify(order);
view.render(outcome);
```

## Count execution scopes

- Apply the shared [nesting limit](../../../../../docs/programming/function-ownership.md#limit-nesting-and-abstraction).
- Count arrow callbacks, function callbacks, `switch` branches, and loops together.
- Count a `switch` and its cases as one level, not one level per case.
- Exclude class, interface, and namespace bodies, object literals, and parentheses.
- Check mixed nesting in review; separate callback and block lint limits cannot
  establish the combined depth.

These alternative method bodies belong to `PrintSession`. The request `batch`
has `pageGroups: ReadonlyArray<ReadonlyArray<Page>>`; each `Page` has
`items: ReadonlyArray<PrintItem>`. The session owns `printer.print(item)`.
Both compile; the first exceeds the depth limit.

**Prohibited:** nest three execution scopes.

```ts
for (const group of batch.pageGroups) {
  for (const page of group) {
    for (const item of page.items) {
      this.printer.print(item);
    }
  }
}
```

**Preferred:** flatten the existing array before traversing it.

```ts
const pages = batch.pageGroups.flat();
for (const page of pages) {
  for (const item of page.items) {
    this.printer.print(item);
  }
}
```

## Validation

- Inventory free functions, module variables, statics, and component handlers.
- Check semantic ownership separately from placement; empty containers do not pass.
- Keep shared behavior on its domain/application owner.
- Review execution depth using the shared limit and TypeScript scope rules.
