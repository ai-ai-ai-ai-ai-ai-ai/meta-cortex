# WASM UI Integration

Keep framework reactivity at the UI boundary. Use the generated contract to
distinguish a structural DTO from a WASM class instance.

Examples are component or method fragments using existing generated values.
`Order` is a WASM class; `OrderRequest` is a generated structural DTO. APIs that
receive `order` below borrow it; its owner remains responsible for release.

## Pass the declared value without cloning it

Pass plain DTOs directly. Unwrap reactive DTOs only when the receiving ABI needs
plain values. Preserve WASM instances: JSON, object spread, and deep cloning do
not preserve their identity. JSON encoding belongs only at an actual JSON edge.

**Prohibited:** erase the object and assert its type back into existence.

```ts
api.inspect_order(JSON.parse(JSON.stringify(order)) as Order);
api.inspect_order({ ...order } as Order);
```

**Preferred:** pass the generated instance itself.

```ts
api.inspect_order(order);
```

## Svelte

Use [Svelte’s raw state and snapshots](https://svelte.dev/docs/svelte/$state)
at the UI boundary.

- For reactive structural DTOs, take `$state.snapshot(value)` in the rune-owning
  caller at the API boundary. Bind the snapshot to an explicitly typed local
  before passing it to an ordinary API call.
- Keep replace-only DTO state in `$state.raw` so ordinary TypeScript adapters
  receive plain values.
- Use `.svelte.ts` only for modules that own runes such as `$state`, `$derived`,
  or `$effect`. Do not rename domain or action modules merely to access snapshots.
- Preserve generated WASM class instances; structural snapshots do not replace them.

These alternatives belong to a rune-owning component with a reactive structural
`request: OrderRequest` and an existing typed `api`.

**Prohibited:** erase and reconstruct the DTO through JSON.

```ts
api.submit(JSON.parse(JSON.stringify(request)) as OrderRequest);
```

**Preferred:** snapshot at the UI caller, leaving the adapter independent of Svelte.

```ts
const snapshot: OrderRequest = $state.snapshot(request);
api.submit(snapshot);
```

For replace-only state, retain a plain DTO from the start:

```ts
let request = $state.raw<OrderRequest>({ order_id });
// In the component handler:
api.submit(request);
```

## Vue

- Keep generated WASM instances in `shallowRef`; use `markRaw` when inserting
  an instance into a reactive object. Avoid deep proxying foreign class instances.
- Pass the stored instance itself to a class-based WASM API.
- For structural DTOs, unwrap Vue proxies only at the boundary. `toRaw` is not
  a recursive snapshot; it does not remove separately stored nested proxies.

These fragments belong inside the component's setup scope; `order` is an
existing generated WASM instance.

**Prohibited:** deep-proxy the instance.

```ts
const selectedOrder = reactive(order);
```

**Preferred:** retain its identity and track replacement.

```ts
const selectedOrder = shallowRef(order);
// A handler passes selectedOrder.value to the generated API.
```

See [Vue's shallow and raw APIs](https://vuejs.org/api/reactivity-advanced.html).

## React

- React state does not require proxy removal. Pass generated structural DTOs
  directly, and retain generated class instances without cloning them.
- Use state when replacing a value must trigger rendering. Use a ref for a
  retained handle that does not determine rendering; changing a ref does not render.
- Create and release owned WASM resources in the component's lifecycle, not as
  a side effect of rendering. Keep cleanup paired with the resource's owner.

These fragments belong inside a component; `order` is an existing borrowed
WASM instance managed by its owner.

**Prohibited:** clone the instance into a plain object.

```ts
const orderRef = useRef({ ...order });
```

**Preferred:** keep the generated instance intact.

```ts
const orderRef = useRef(order);
// A handler passes orderRef.current to the generated API.
```

See [React's ref semantics](https://react.dev/reference/react/useRef).

## Keep UI adaptation at the caller

Do not add state methods or forwarding wrappers that only call another action.
Keep a method when it owns validation, lifecycle, or a real conversion. Removing
a framework proxy alone belongs at the UI call site.

These fragments assume generated `OrderRequest` and an existing typed `api`.

**Prohibited:** the state object adds an identical route to the same operation.

```ts
class EditorState {
  submit(request: OrderRequest) {
    return api.submit(request);
  }
}

// In the component handler:
editor.submit(request);
```

**Preferred:** the component calls the operation directly.

```ts
api.submit(request);
```

## Validation

- Test reactive DTO submission without JSON round-trips or type assertions.
- Check that class-based calls receive the original generated instance.
- Test component replacement and teardown against the object's ownership contract.
- Run the consuming framework's type checks and affected component tests.
