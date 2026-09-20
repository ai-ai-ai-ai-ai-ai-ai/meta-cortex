# Development Team

Team Gizmo uses this directory to select the owner of design or implementation work in
the consuming project.

## Agent catalog

- **[Rust developer](rust-dev/AGENTS.md)**
  - Rust implementation, compiled tooling, tests, and corrections.
  - Rust domain behavior and Rust-owned WASM interfaces.
- **[TypeScript developer](typescript-dev/AGENTS.md)**
  - TypeScript and JavaScript implementation: browser components, application state, APIs, libraries, services, and tooling.
  - Functional tests, browser integration, and corrections for those implementations.
- **[Web designer](web-designer/AGENTS.md)**
  - UI/UX, navigation, layout, typography, responsive styling, and visual states.
  - Assigned markup/CSS and visual accessibility validation.
- **[SRE agent](sre-agent/AGENTS.md)**
  - Intended scope: infrastructure, development environments, and operational reliability.
  - Status: role instructions are not yet defined; the linked file is a placeholder.

## Assignment boundaries

Keep implementation with the development owner. Route security architecture
and review to the security team through Team Gizmo. Route instructions,
specifications, skills, and practice authoring to the AI team's tech writer.
Cross-team decisions remain with Team Gizmo; this index does not expand an
agent's assignment.

Assign web design to web-designer and JS/TS behavior and functional tests to
typescript-dev. A Svelte file may need both roles; Team Gizmo sequences edits
to shared components and supplies the design decisions to the implementation owner.
For work crossing these boundaries, give each agent a bounded assignment and
explicit dependencies. Pass these boundaries with each assignment; language
expertise does not authorize taking over another agent's work or feature coordination.

**Prohibited:** assign a developer a credential-storage fix and implicitly
authorize it to redefine the security policy and rewrite the agent instructions.

**Preferred:** Team Gizmo assigns the implementation and regression tests to
the agent owning the affected implementation, security-policy questions to the security team, and
instruction changes to the tech writer. Each assignment identifies its
dependencies on the others.
