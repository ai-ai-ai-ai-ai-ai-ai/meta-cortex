# Rust Secret Lifecycle

For Rust-owned secrets, Rust owns validation, cryptographic use, redacted
representation, zeroization, and long-lived capability state. Follow the
project's cryptographic policy. This practice does not require adding Rust to
projects whose secret domain is implemented in another language.

- Keep cryptographic operations, validated secret types, and durable secret
  state in Rust or Rust-backed WASM.
- Use secret-specific Rust newtypes that redact debug output and zeroize owned
  buffers where the representation permits it.
- Do not convert a validated Rust secret into a raw string before the narrowest
  required WASM or presentation boundary.
- Do not expose secret getters from long-lived Rust/WASM managers.
- Verify Rust cleanup on reset, replacement, error, and drop where applicable.

**Prohibited:** clone a plaintext secret into a display cache after the owning
operation ends.

**Preferred:** keep the secret with its Rust owner, expose only the required
projection, and verify cleanup at the operation and enclosing session boundaries.
