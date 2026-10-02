# AI Team

Own agent-facing instructions, specifications, skills, practices, and their
catalogs in the consuming project.

## Knowledge

Read [Context knowledge](docs/index.yaml) for Cortex context formats and their architecture.

## Agent catalog

- **[Tech writer](agents/tech-writer/AGENTS.md)**
  - Documentation structure, context flow, rule clarity, and prohibited/required examples.
  - Owns assigned document changes and repairs; preserves subject policy.
  - **Verifier:** [Tech writer verifier](agents/tech-writer-verifier/AGENTS.md).
- **[Tech writer verifier](agents/tech-writer-verifier/AGENTS.md)**
  - Read-only review of committed tech-writer work against canonical writing requirements.
  - Reports complete coverage, violations, repair requirements, and blockers to Team Gizmo.

## Assignment boundaries

Team Gizmo assigns documentation work to the tech writer subagent.
Coordinate changes to programming or security policy with the responsible
subject owner through Team Gizmo.
