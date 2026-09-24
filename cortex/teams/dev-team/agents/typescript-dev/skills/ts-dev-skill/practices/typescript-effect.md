# TypeScript Effect Workflows

Use Effect v3 for new or materially changed asynchronous, fallible, resource-owning,
concurrent, service-dependent, or untrusted-decoding workflows. This includes
tests, scripts, and tooling. In Rust/WASM projects, portable product/security
policy stays in Rust. Effect does not change the project's domain ownership.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Compose workflows with simple functional operations

Effect owns sequencing, decisions, failures, and cleanup in effectful workflows.
Use `Effect.map` for pure transformations, `Effect.flatMap` for dependent effects,
and basic exhaustive `Match` branches for alternatives. Use `Effect.forEach` for
effectful traversal and Effect's error operators for recovery.

Do not mix procedural `if`/`else`, `switch`, ternaries, loops, or `try`/`catch`
with Effect workflow control. This includes generators, composition callbacks,
and helpers that choose workflow steps. Assigning a yielded result to a local
variable before an `if`, or moving the same branch into a helper, does not
satisfy the rule. The shared
[branching rule](../../../../../docs/programming/branching-and-exhaustive-matching.md#use-patterns-instead-of-boolean-if-conditions)
also prohibits ordinary `if` conditions outside Effect workflows.

`Effect.gen` may sequence dependent steps linearly. Branch through composition
and matching; keep side effects inside `Effect.sync`, `Effect.tryPromise`, or
the owning adapter. Match branches return effects without running them during
construction. Match closed alternatives exhaustively without a fallback that
hides a missing case. A platform boolean may be matched immediately at its
adapter; domain decisions still use their meaningful enum or union.

**Prohibited:**

```ts
// Inside the file-check adapter:
return Effect.gen(this, function* () {
  if (!(yield* Effect.tryPromise(() => this.configuration.exists()))) {
    return yield* this.reportMissing();
  }
  return yield* this.reportFound();
});
```

**Preferred:**

```ts
// reportFound and reportMissing return effects that write the CLI response.
return Effect.tryPromise(() => this.configuration.exists()).pipe(
  Effect.flatMap((exists) =>
    Match.value(exists).pipe(
      Match.when(true, () => this.reportFound()),
      Match.when(false, () => this.reportMissing()),
      Match.exhaustive,
    ),
  ),
);
```

### Keep the composition easy to read

Use a short pipeline, named intermediate values, and small callbacks. Extract
an operation when it has a meaningful responsibility or reuse. Do not introduce
generic combinator wrappers, custom functional frameworks, or services and
layers merely to express a branch. Avoid deeply nested composition and chains
that hide the data being passed. Pure calculations stay pure; they do not need
Effect wrappers to look functional.

**Prohibited:** introduce a generic branching service and several adapters to
choose between two file-check outcomes.

**Preferred:** use one exhaustive `Match` with two concrete branches and lift
only their I/O into Effect.

## Return the workflow, not a running Promise

Internal methods return Effect<Success, Failure, Services>. Keep Effect.run*
at explicit runtime/UI/browser/worker/framework edges. Lift external Promise
APIs in adapters; do not introduce neverthrow or hand-rolled Promise failure chains.

**Prohibited:**

```ts
// Inside an application workflow:
save(request: SaveRequest): Promise<Receipt> {
  return Effect.runPromise(this.store.save(request));
}
```

**Preferred:**

```ts
// Inside the application workflow:
save(request: SaveRequest): Effect.Effect<Receipt, SaveFailure> {
  return this.store.save(request);
}
```

## Preserve the typed failure channel

Expected failures are concrete and tagged. Preserve source errors and handle
them where the owner can classify, recover, or present them; do not throw or use
Promise rejection as the application failure model.

**Prohibited:**

```ts
// Inside an effectful operation:
throw failure;
```

**Preferred:**

```ts
// Inside the same operation:
return Effect.fail(failure);
```

## Decode untrusted input once

Use Effect Schema at the narrow TypeScript transport boundary. Keep decoding
failures typed; use generated Rust contracts rather than inventing a competing
Schema model or validation policy for Rust-owned data.

**Prohibited:**

```ts
// Inside a TS-owned transport decoder:
return Effect.succeed(raw as PanelRequest);
```

**Preferred:**

```ts
// PanelRequestSchema belongs to this TypeScript-owned protocol.
return Schema.decodeUnknown(PanelRequestSchema.value)(raw);
```

## Make effectful dependencies explicit

Use Context tags for effectful services and Layers to provide them. Do not use
service machinery for pure local calculations. This fragment assumes an existing
DocumentStore tag and live Layer owned by that service.

**Prohibited:**

```ts
// Inside an application workflow:
return globalStore.save(request);
```

**Preferred:**

```ts
return Effect.gen(function* () {
  const store = yield* DocumentStore;
  return yield* store.save(request);
});
// At the composition edge, provide DocumentStore.Live with Effect.provide.
```

## Tie cleanup to the resource scope

Use Scope and acquireRelease for owned resources. Use Effect concurrency,
cancellation, coordination, and observability inside the owning workflow.
Do not make cleanup depend on the success path. In this fragment, close returns
a non-failing cleanup Effect; cleanup failures otherwise need an explicit policy.

**Prohibited:**

```ts
// Inside a resource-owning effect:
const resource = yield* port.open();
yield* resource.write(request);
yield* resource.close();
```

**Preferred:**

```ts
// Inside the resource-owning effect; Scope is supplied at the caller edge:
const resource = yield* Effect.acquireRelease(
  port.open(),
  (resource) => resource.close(),
);
yield* resource.write(request);
```

## Migrate one connected workflow

When materially changing legacy neverthrow/Promise-error or mixed procedural
Effect work, migrate its connected callers to consistent Effect composition.
Untouched legacy flows may remain debt; do not force unrelated migrations.
Pure calculations, inert types, and rendering need no ceremonial Effect wrappers.

**Prohibited:**

```ts
// Pure formatting is wrapped only to make everything an Effect:
return Effect.succeed(label.text);
```

**Preferred:**

```ts
// Inside the pure presentation owner:
return label.text;
```

## Validation

- Reject procedural control flow in adopted Effect workflows through the existing
  lint gate. Review called helpers as well as inline callbacks; moving a branch
  must not bypass the rule. Keep enforcement scoped to adopted modules or packages.
- Verify exhaustive matches and deferred side effects; reject unnecessary
  wrappers, layers, and composition that obscures a simple operation.
- Check that expected failures stay typed and run* appears only at execution edges.
- Test failure propagation, service substitution, interruption, and resource cleanup.
- Use Effect LSP where available for quick type feedback.
- Use the supplied Effect v3 contracts; no competing Result/error abstraction.

Effect v3 references: [services](https://effect.website/docs/v3/requirements-management/services),
[Schema](https://effect.website/docs/v3/schema/introduction),
[Scope](https://effect.website/docs/v3/resource-management/scope), and
[runtime edges](https://effect.website/docs/v3/getting-started/running-effects).
