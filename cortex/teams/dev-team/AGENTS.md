# Development Team

Team Gizmo uses this directory to select the owner of design or implementation work in
the consuming project.

## Agent catalog

- **[Rust developer](agents/rust-dev/AGENTS.md)**
  - Rust implementation, structural refactors, compiled tooling, tests, and corrections.
  - Rust domain behavior, contract changes, and Rust-owned WASM interfaces.
  - Verifier: [Rust verifier](agents/rust-verifier/AGENTS.md).
- **[Rust architecture reviewer](agents/rust-refactoring/AGENTS.md)**
  - Read-only architecture review after successful Rust verification of the full worker commit.
  - Grounded improvement proposals or no-change conclusions returned to Team Gizmo.
- **[Rust verifier](agents/rust-verifier/AGENTS.md)**
  - Read-only, exhaustive Rust catalog compliance review of committed work.
  - Reports compliance evidence and repair requirements to Team Gizmo; read-only.
- **[TypeScript developer](agents/typescript-dev/AGENTS.md)**
  - TypeScript and JavaScript implementation: browser components, application state, APIs, libraries, services, and tooling.
  - Functional tests, browser integration, and corrections for those implementations.
  - Verifier: [TypeScript verifier](agents/typescript-verifier/AGENTS.md).
- **[TypeScript verifier](agents/typescript-verifier/AGENTS.md)**
  - Read-only, exhaustive TypeScript catalog compliance review of committed work.
  - Reports compliance evidence and repair requirements to Team Gizmo; read-only.
- **[Web designer](agents/web-designer/AGENTS.md)**
  - UI/UX, navigation, layout, typography, responsive styling, and visual states.
  - Assigned markup/CSS and visual accessibility validation.

## Assignment boundaries

Keep implementation with the development owner. Report security verification
and documentation needs to the assigning Team Gizmo. Gizmo decides whether to
assign a security review or instructions, specifications, skills, and practice
authoring to the AI team's tech writer.
Cross-team decisions remain with Team Gizmo; this index does not expand an
agent's assignment.

Team Gizmo assigns web design to web-designer and JS/TS behavior and functional tests to
typescript-dev. It assigns new Rust behavior, domain work, contract changes, and
Rust-owned WASM work, structural refactors, and their tests/checks to rust-dev.
After Rust verification passes, it assigns architecture review to rust-refactoring
under the [Rust architecture handoff](../gizmo-team/docs/agent-verification.md#review-rust-architecture-after-verification).
Architectural proposals return to Team Gizmo for a scope decision and any Rust
developer assignment. The reviewer never implements them.

A Svelte file may need web design and TypeScript implementation; Team Gizmo
sequences edits to shared components and supplies the design decisions to the
implementation owner. For work crossing these boundaries, give
each agent a bounded assignment and explicit dependencies. Pass these boundaries
with each assignment; language expertise does not authorize taking over another
agent's work or feature coordination.

- **Prohibited:** assign a developer a credential-storage fix and implicitly
  authorize it to redefine the security policy and rewrite the agent instructions.

- **Required:** Team Gizmo assigns the implementation and regression tests to
  the agent owning the affected implementation, security-policy questions to the security team, and
  instruction changes to the tech writer. Each assignment identifies its
  dependencies on the others.

## Team knowledge

The [knowledge base](docs/index.yaml) holds the team’s shared subject
requirements. Agents link the relevant knowledge alongside their own skills.

## Team circuit breaker

Apply the [subject-specific circuit breaker](CIRCUIT-BREAKER.md) to this
team’s assignments.
