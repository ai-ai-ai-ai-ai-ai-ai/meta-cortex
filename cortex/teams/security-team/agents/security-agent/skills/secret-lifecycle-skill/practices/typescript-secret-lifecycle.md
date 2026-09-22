# TypeScript Secret Lifecycle

In Rust/WASM projects, TypeScript owns only the required browser interaction
lifetime and must not duplicate the Rust secret domain or persistence layer.
In TypeScript-only projects, the TypeScript domain owner may implement secret
operations under the same [shared lifecycle requirements](../../../../../docs/secret-lifecycle.md).
Follow the product lifecycle authority for the affected flow.

- Keep plaintext limited to the operation that requires it. In the browser,
  this includes display, editing, copying, form filling, or immediate submission;
  in a TypeScript service, bind it to the owning request or resource scope.
- Represent a TypeScript secret interaction with an explicit lifecycle state.
- Clear TypeScript and Svelte references on hide, cancel, submit, replacement,
  component teardown, vault lock, logout, timeout, and failure.
- Keep long-lived browser state as an opaque capability or encrypted
  representation. Use the Rust/WASM capability when Rust owns the secret.
- Do not claim JavaScript string clearing provides deterministic memory
  zeroization. Clear references and keep the lifetime narrow instead.
- Verify TypeScript cleanup on every terminal interaction and enclosing session
  teardown.

**Prohibited:** retain a revealed credential in component state after its dialog
closes, or retain request plaintext in a service-wide cache.

**Preferred:** release the operation's plaintext references at completion and
teardown while preserving only the approved opaque or encrypted representation.
