# Development Team

Team Gizmo uses this directory to select the owner of implementation work in
the consuming project.

## Agent catalog

- **[Development agent](dev-agent/AGENTS.md)**
  - Application and web implementation, tests, and corrections.
  - Repository automation associated with implementation work.
  - Rust, TypeScript, and web skills are selected according to the assignment.
- **[SRE agent](sre-agent/AGENTS.md)**
  - Intended scope: infrastructure, development environments, and operational reliability.
  - Status: role instructions are not yet defined; the linked file is a placeholder.

## Assignment boundaries

Keep implementation with the development owner. Route security architecture
and review to the security team through Team Gizmo. Route instructions,
specifications, skills, and practice authoring to the AI team's context engineer.
Cross-team decisions remain with Team Gizmo; this index does not expand an
agent's assignment.

**Prohibited:** assign a developer a credential-storage fix and implicitly
authorize it to redefine the security policy and rewrite the agent instructions.

**Preferred:** Team Gizmo assigns the implementation and regression tests to
the development agent, security-policy questions to the security team, and
instruction changes to the context engineer. Each assignment identifies its
dependencies on the others.
