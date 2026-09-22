# TypeScript Function Ownership

Put behavior, constants, and state on the type or component that owns them.
A file, namespace, Utils class, or empty instance is not an owner.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Use instances for owned behavior

Instances own execution, validation, formatting, and dispatch. Reserve static
methods for narrow construction builders. Give enum semantics a concrete kind
owner or typed companion; never mutate primitive or enum prototypes.

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

Use static readonly for owned constants and instance fields for mutable state.
Prohibit module const/let/var, mutable statics, and function-valued globals.
Parameters, immediate callbacks, and local bindings stay in the owning operation.
Test-runner callbacks may contain scenario setup, actions, and assertions;
reusable test helpers belong to fixture or scenario owners under the shared
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

A Svelte handler or lifecycle callback belongs to the component only when it
uses that component’s state or interaction contract. Module-script globals and
shared product behavior belong elsewhere. Do not rename execution to build or
create empty objects just to retain former statics.

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

## Validation

- Inventory free functions, module variables, statics, and component handlers.
- Check semantic ownership separately from placement; empty containers do not pass.
- Keep shared behavior on its domain/application owner.
