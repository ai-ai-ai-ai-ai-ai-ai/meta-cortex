# TypeScript Single Parameter

Authored functions, methods, constructors, and arrows take at most one parameter.
This includes Svelte and tooling; generated bindings retain their external shapes.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Collect independent inputs in one request

Use one semantic request for independent inputs. Destructure it inside the owner.
Do not hide positional inputs in arrays or generic Args/Params names.

**Prohibited:**

```ts
// Inside TransferService:
transfer(source: AccountId, destination: AccountId): TransferOutcome;
```

**Preferred:**

```ts
interface TransferRequest {
  readonly source: AccountId;
  readonly destination: AccountId;
}
// Inside TransferService:
transfer(request: TransferRequest): TransferOutcome;

// At the caller:
const request: TransferRequest = { source, destination };
service.transfer(request);
```

## Name object-shaped parameters

Arrays, tuples, maps, sets, records, and mapped types also need semantic named
contracts. This applies to helpers and destructured callback inputs. A callback
may return an inline object shape; that does not exempt its inputs.

**Prohibited:**

```ts
// Inside Selection:
replace(items: readonly ItemId[]): void;
```

**Preferred:**

```ts
type SelectedItems = readonly ItemId[];
// Inside Selection:
replace(items: SelectedItems): void;
```

## Keep fixed host signatures at the edge

A host callback may require several inputs. Document the actual contract and
limit any lint suppression to that callback. Convert its inputs to one request
before application behavior. A project-owned callback receives no exemption.

**Prohibited:**

```ts
// Hypothetical host-required callback, inside WindowAdapter:
resized(width: number, height: number): void {
  this.layout.resize(width, height);
}
```

**Preferred:**

```ts
// Assume a host requires resized(width, height); only this callback is exempt.
resized(width: number, height: number): void {
  const viewport: Viewport = {
    width: Width.from(width),
    height: Height.from(height),
  };
  this.layout.resize(viewport);
}
```

This illustrative host contract is hypothetical. An authored callback named
`resized` does not qualify without an actual external signature requiring it.

## Do not disguise additional inputs

Do not add optional undefined parameters or a second positional default.
Model omitted values as named states. Apply defaults at the caller or inside
the body after receiving the named request.

**Prohibited:**

```ts
// Inside Search:
run(query: SearchQuery, options = defaultOptions): SearchResults;
```

**Preferred:**

```ts
interface SearchRequest {
  readonly query: SearchQuery;
  readonly options: SearchOptions;
}
// Inside Search:
run(request: SearchRequest): SearchResults;
```

## Validation

- Enforce ESLint `max-params: [error, 1]` and review semantic request names.
- Check each multi-input exception against its named external contract.
- Apply named-argument checks to every object-shaped input and call.
