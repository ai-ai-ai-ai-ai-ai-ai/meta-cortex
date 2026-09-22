# Secret Lifecycle

## Priority

This is the P1 cross-language contract for secret plaintext, credentials,
private keys, recovery material, and decrypted payloads.

Every secret-bearing value has an explicit owner, purpose, lifetime, and
destruction event. Encryption at rest does not justify an unbounded plaintext
lifetime in memory.

**Prohibited:** apply secret redaction only to one language while another logs
the same credential.

**Preferred:** apply the same secret-lifecycle requirements at both boundaries,
using the relevant implementation skills for language-specific handling.

## Required actions

- Decrypt only the smallest value required for the current operation.
- Encrypt secret material before project-owned durable storage, replication, or
  transport.
- Preserve redaction through errors, diagnostics, tracing, telemetry, and test
  output.
- Test the operation-specific cleanup event and the enclosing lock or teardown
  event.

## Prohibited actions

- Do not persist secret plaintext in browser storage, caches, convenience
  state, URLs, application-owned clipboard history, logs, telemetry, or error
  messages.
- Do not keep a plaintext mirror beside an encrypted value or protected capability.
- Do not clone secret material to preserve an earlier state across a consuming
  transition.
- Do not retain whole decrypted records when one field or projection is
  sufficient.
- Do not add plaintext fallback, compatibility storage, or recovery behavior.

## Validation

- Inventory every creation, copy, conversion, log, persistence, and cleanup
  path for the changed secret value.
- Verify the smallest plaintext projection crosses each boundary.
- Search changed logs, errors, fixtures, snapshots, and telemetry for secret
  values.
- Treat an unowned lifetime, plaintext persistence, or sensitive log as a P1
  finding.
