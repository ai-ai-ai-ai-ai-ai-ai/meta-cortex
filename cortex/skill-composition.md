# Skill Composition

Select skills by the work an assignment contains. Load common prerequisites
before specialized skills. Pass the selected instructions and resolved document
locations through delegation so each agent can load its assigned context directly.

## Required actions

1. Identify the assignment's subjects using the selections below.
2. Load each applicable common skill before its specialized extensions.
3. Load each selected skill's applicable practices in full.
4. Include the selected skills, prerequisite context, and document locations in
   the assignment. Reapply these selections when its scope changes.

## Common prerequisites

- For authored code, tests, scripts, build logic, or code review, load
  [common coding](skills/dev/coding-skill/SKILL.md).
- For dependency selection or commodity helpers, also load
  [common library selection](skills/dev/coding-skill/practices/prefer-popular-libraries.md).
- For security work or secret handling, load
  [common security](skills/security/security-skill/SKILL.md).

## Specialized selections

- For documentation assignments, the
  [context engineer](agents/teams/ai-team/context-engineer/AGENTS.md)
  loads its authoring skills in role-defined order. Supply common coding and
  implementation-language practices for programming examples, and security
  prerequisites when the subject involves security.
- For Rust code, load
  [Rust development](agents/teams/dev-team/dev-agent/skills/rust-dev-skill/SKILL.md).
- For TypeScript, JavaScript, or Svelte scripts, load
  [TypeScript development](agents/teams/dev-team/dev-agent/skills/ts-dev-skill/SKILL.md).
- For web work, load TypeScript development before
  [web development](agents/teams/dev-team/dev-agent/skills/web-dev-skill/SKILL.md).
- For repository scripts, CI, or build tooling, load
  [repository automation](agents/teams/dev-team/dev-agent/skills/repository-automation-skill/SKILL.md)
  and the development skill for the implementation language.
- For secret handling in implementation or review, load
  [secret lifecycle](agents/teams/security-team/security-agent/skills/secret-lifecycle-skill/SKILL.md)
  after common security, regardless of the assigned agent's team.

## Cross-language prerequisites

For Rust/WASM consumers, including TypeScript and web implementations, load:

- [Rust–TypeScript separation](agents/teams/dev-team/dev-agent/skills/rust-dev-skill/practices/rust-typescript-code-separation.md).
- [WASM name coherence](agents/teams/dev-team/dev-agent/skills/rust-dev-skill/practices/rust-wasm-name-coherence.md).
- [Rust error handling](agents/teams/dev-team/dev-agent/skills/rust-dev-skill/practices/error-handling.md) and
  [domain states](agents/teams/dev-team/dev-agent/skills/rust-dev-skill/practices/domain-states.md)
  when interpreting Rust failure and absence contracts.

## Validation

- Verify that every selected specialization receives its common prerequisites.
- Carry applicable cross-language and security context with the implementation assignment.
- Keep routing here; keep technical requirements in their owning skills and practices.
