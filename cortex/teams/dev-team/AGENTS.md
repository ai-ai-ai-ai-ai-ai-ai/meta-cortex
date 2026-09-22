# Development Team

Team Gizmo uses this directory to select the owner of design or implementation work in
the consuming project.

## Agent catalog

- **[Rust developer](agents/rust-dev/AGENTS.md)**
  - New Rust implementation, compiled tooling, tests, and behavior corrections.
  - Rust domain behavior, contract changes, and Rust-owned WASM interfaces.
- **[Rust refactoring agent](agents/rust-refactoring/AGENTS.md)**
  - Behavior-preserving Rust structural refactors, their tests, and mandatory checks.
  - Module decomposition and ownership-preserving moves under existing contracts.
- **[TypeScript developer](agents/typescript-dev/AGENTS.md)**
  - TypeScript and JavaScript implementation: browser components, application state, APIs, libraries, services, and tooling.
  - Functional tests, browser integration, and corrections for those implementations.
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
Rust-owned WASM work to rust-dev. It assigns behavior-preserving Rust structural
refactors and their tests/checks to rust-refactoring. A Svelte file may need both
roles; Team Gizmo sequences edits to shared components and supplies the design
decisions to the implementation owner. For work crossing these boundaries, give
each agent a bounded assignment and explicit dependencies. Pass these boundaries
with each assignment; language expertise does not authorize taking over another
agent's work or feature coordination.

If a structural refactor reveals an intended behavior or contract change, route
that change through Team Gizmo to rust-dev before proceeding.

- **Prohibited:** assign a developer a credential-storage fix and implicitly
  authorize it to redefine the security policy and rewrite the agent instructions.

- **Preferred:** Team Gizmo assigns the implementation and regression tests to
  the agent owning the affected implementation, security-policy questions to the security team, and
  instruction changes to the tech writer. Each assignment identifies its
  dependencies on the others.

## Team knowledge

The [knowledge base](docs/index.md) holds the team’s shared subject
requirements. Agents link the relevant knowledge alongside their own skills.

## Team circuit breaker

Apply the [subject-specific circuit breaker](CIRCUIT-BREAKER.md) to this
team’s assignments.
