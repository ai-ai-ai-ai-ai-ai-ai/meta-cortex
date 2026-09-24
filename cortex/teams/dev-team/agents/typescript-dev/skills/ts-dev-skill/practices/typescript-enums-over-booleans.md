# TypeScript Enums Instead of Booleans

Use meaningful enums for authored domain/application/workflow/lifecycle/policy/
mode/command/configuration values, even when there are only two cases.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Name the decision at the call site

Distinct decisions require distinct types. True/False or Yes/No variants merely
rename bits; Enabled/Disabled is useful only on an enum naming the actual policy.
Use generated Rust enums for Rust-owned portable/security decisions. Define
TypeScript-owned domain vocabulary in its TypeScript owner.

**Prohibited:**

```ts
const request: SyncRequest = { force: true, failFast: false };
```

**Preferred:**

```ts
const request: SyncRequest = {
  freshness: SyncFreshness.Forced,
  failures: SyncFailureHandling.Capture,
};
```

## Model related flags as one state

Put payloads on enum-backed union variants and match exhaustively. Keep the
union separately named; do not use inline value-or-false fields. Do not serialize
a boolean derivable from the enum or erase members at calls and fixtures.

**Prohibited:**

```ts
interface UploadState {
  readonly running: boolean;
  readonly complete: boolean;
}
```

**Preferred:**

```ts
enum UploadKind { Idle = "idle", Running = "running", Complete = "complete" }
type UploadState =
  | { readonly kind: UploadKind.Idle }
  | { readonly kind: UploadKind.Running }
  | { readonly kind: UploadKind.Complete; readonly receipt: UploadReceipt };
```

## Contain required boolean contracts

- Keep boolean fields and signatures only where an external contract requires them.
- Convert incoming flags into named states at that boundary.
- Convert states back to booleans only for required outgoing contracts.
- Document the external contract behind each retained field, signature, or lint exception.
- Tests and internal DTOs have no blanket exemption.

These fragments assume an external record with a fixed `force: boolean` field.
The existing decoder converts it into the application's sync-mode enum.

**Prohibited:**

```ts
// Inside the adapter:
workflow.run(raw.force);
```

**Preferred:**

```ts
// Inside the adapter; decoder owns the external flag interpretation:
const mode = decoder.syncMode(raw.force);
workflow.run(mode);
```

## Name predicate outcomes before choosing behavior

When a dependency predicate returns a boolean, match it directly into a domain enum.

- Authored predicates return domain types, including private and mechanical helpers.
- Finish the conversion before running workflow actions or reporting.
- Keep the conversion on the existing owner; no extra wrapper or service is needed.

An inferred boolean return type is still a boolean contract. Moving the branch
into a callback does not change that. `Match.type<boolean>()` checks boolean
exhaustiveness; it does not provide a domain type.

These alternatives belong to `ConfigurationFiles`, which owns
`paths: ReadonlySet<ConfigurationPath>`. The reporting method receives
`path: ConfigurationPath`, owns `files` and `reporter`, and returns `void`.
Both alternatives compile.

**Prohibited:** a boolean leaves the owner and controls reporting.

```ts
// Inside ConfigurationFiles; the inferred return type is boolean:
contains(path: ConfigurationPath) {
  return this.paths.has(path);
}

// Inside the reporting method:
switch (this.files.contains(path)) {
  case true:
    return this.reporter.found();
  case false:
    return this.reporter.missing();
}
```

**Preferred:** the owner names the outcome and the caller reports it.

```ts
enum ConfigurationPresence {
  Present = "present",
  Missing = "missing",
}

// Inside ConfigurationFiles:
presence(path: ConfigurationPath): ConfigurationPresence {
  switch (this.paths.has(path)) {
    case true:
      return ConfigurationPresence.Present;
    case false:
      return ConfigurationPresence.Missing;
  }
}

// Inside the reporting method:
switch (this.files.presence(path)) {
  case ConfigurationPresence.Present:
    return this.reporter.found();
  case ConfigurationPresence.Missing:
    return this.reporter.missing();
}
```

## Validation

- Inventory boolean fields, parameters, returns, state, and suppressions.
- Replace coupled flags and test every new variant/transition.
- Raw browser observations receive no general exemption; normalize them or pass them to the project's domain policy owner.
- Run state checks, type/behavior tests, and formatting; old suppressions are migration debt.
