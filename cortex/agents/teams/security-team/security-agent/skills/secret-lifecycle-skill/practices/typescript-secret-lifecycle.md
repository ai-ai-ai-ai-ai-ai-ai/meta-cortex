# TypeScript Secret Lifecycle

TypeScript and Svelte own only the required browser interaction lifetime. They
must not become an alternate secret domain or persistence layer. Follow the
product lifecycle authority for the affected flow.

- Keep TypeScript plaintext limited to the browser interaction that requires
  display, editing, copying, form filling, or immediate submission.
- Represent a TypeScript secret interaction with an explicit lifecycle state.
- Clear TypeScript and Svelte references on hide, cancel, submit, replacement,
  component teardown, vault lock, logout, timeout, and failure.
- Keep long-lived browser state as an opaque Rust/WASM capability or encrypted
  representation.
- Do not claim JavaScript string clearing provides deterministic memory
  zeroization. Clear references and keep the lifetime narrow instead.
- Verify TypeScript cleanup on every terminal interaction and enclosing session
  teardown.
