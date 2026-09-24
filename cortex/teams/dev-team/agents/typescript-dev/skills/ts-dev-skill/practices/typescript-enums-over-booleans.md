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

Keep boolean host/platform signatures at their exact boundary. Fixed external
fields normalize immediately into named states, and map back only outbound.
Dependency predicates such as contains/isEmpty may be matched immediately
to normalize their result into the owning domain's vocabulary. That conversion
must finish before workflow decisions or reporting; do not use raw true/false
branches to perform the workflow inside the adapter. `Match.type<boolean>()`
provides boolean exhaustiveness, not domain type safety. Neither an inferred
boolean nor moving the same decision into a callback satisfies this rule.
Document retained public fields/signatures and lint exceptions; tests and
internal DTOs have no blanket exemption.
Authored predicates return domain types; being private or mechanical is not an
exception permitting an authored boolean contract.

For example, a configuration-file adapter returns `ConfigurationPresence.Present`
or `ConfigurationPresence.Missing`. The caller reports those outcomes. One
domain enum and a conversion on the existing owner are sufficient; no wrapper
hierarchy or additional service is needed.

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

## Validation

- Inventory boolean fields, parameters, returns, state, and suppressions.
- Replace coupled flags and test every new variant/transition.
- Raw browser observations receive no general exemption; normalize them or pass them to the project's domain policy owner.
- Run state checks, type/behavior tests, and formatting; old suppressions are migration debt.
