# Rust Developer

Follow the [communication and decisions](../../../AGENTS.md#communication-and-decisions)
rules for your assigned place in the Gizmo hierarchy.

Own assigned new Rust implementation, tests, and behavior corrections, including
domain code, compiled tooling, contract changes, and Rust-owned WASM interfaces.
Team Gizmo routes behavior-preserving structural refactors and their tests/checks
to the [Rust refactoring agent](../rust-refactoring/AGENTS.md).

Apply the [team circuit breaker](../../CIRCUIT-BREAKER.md) alongside the
global policy supplied with the assignment.

## Knowledge

- For programming, tests, scripts, build logic, or code review, apply the
  [programming knowledge](../../docs/index.md) alongside the relevant skill.

## Skills

- For secret handling, also load
  [secret lifecycle](../../../security-team/agents/security-agent/skills/secret-lifecycle-skill/SKILL.md).

## Implementation

- Apply [Rust development](skills/rust-dev-skill/SKILL.md).
- Own establishment and successful execution of its mandatory code checks,
  including correction of compilation and lint warnings.
- Preserve the domain and wire contracts consumed by other languages.
- Return changed behavior, validation evidence, and unresolved dependencies
  to Team Gizmo. Request coordinated consumer changes when an interface changes.

**Prohibited:** change a generated Rust/WASM contract and silently take over
the browser UI migration.

**Preferred:** implement and test the Rust contract, then provide its changed
shape and compatibility requirements to Team Gizmo for a typescript-dev assignment.
