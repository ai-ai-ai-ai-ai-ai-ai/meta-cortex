# TypeScript Function Ownership

These requirements specialize function ownership for TypeScript and Svelte.

## TypeScript owners

- Use a concrete kind owner or typed companion for TypeScript enum semantics.
- Reserve authored TypeScript static methods for narrow construction builders.
- Put TypeScript execution, validation, formatting, and dispatch on instances.
- Give those instances the request, state, or capability that their behavior owns.
- Do not mutate primitive or enum prototypes to add TypeScript behavior.
- Do not rename TypeScript execution to a builder merely to retain a static method.
- Do not create an empty instance that serves only as a container for former statics.

## Constants and variables

Put constants on their owning class as `static readonly` members. Keep mutable
state in instance fields. Free functions, module-level `const`/`let`/`var`
values, and mutable static fields are prohibited. Function-valued constants are
not an exception. Parameters and local variables belong inside owned methods.

**Prohibited:** module-level state and a function-valued constant have no owner.

```ts
const DEFAULT_FORMAT = ExportFormat.Json;
let format = DEFAULT_FORMAT;
const currentFormat = (): ExportFormat => format;
```

**Preferred:** the export session owns its default, selected format, and behavior.

```ts
enum ExportFormat {
  Json = "json",
  Csv = "csv",
}

class ExportSession {
  static readonly DEFAULT_FORMAT: ExportFormat = ExportFormat.Json;
  private format: ExportFormat = ExportSession.DEFAULT_FORMAT;

  currentFormat(): ExportFormat {
    return this.format;
  }
}
```

## Component boundaries

Svelte component handlers and lifecycle callbacks belong to the component only
when they use that component's state or interaction contract. Component-local
state belongs to that component; module-script globals do not. Shared behavior
moves to its meaningful domain or application owner.
