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
  [tech writer](agents/teams/ai-team/tech-writer/AGENTS.md)
  loads its authoring skills in role-defined order. Supply common coding and
  implementation-language practices for programming examples, and security
  prerequisites when the subject involves security.
- For Dockerfiles, container builds, BuildKit configuration, or container cache
  evidence, load [common coding](skills/dev/coding-skill/SKILL.md) before the
  [Docker skill](agents/teams/sre-team/docker-specialist/skills/docker-skill/SKILL.md). Also load
  [common security](skills/security/security-skill/SKILL.md) when the assignment
  handles credentials, private keys, recovery material, or decrypted payloads.
- For Kubernetes manifests, workloads, or cluster execution-boundary checks,
  load [common coding](skills/dev/coding-skill/SKILL.md) before the
  [Kubernetes skill](agents/teams/sre-team/kubernetes-specialist/skills/kubernetes-skill/SKILL.md).
  Also load [common security](skills/security/security-skill/SKILL.md) when the
  assignment handles credentials, private keys, recovery material, or decrypted
  payloads.
- For cloud-native infrastructure or operational configuration, load
  [common coding](skills/dev/coding-skill/SKILL.md) before the
  [cloud-native skill](agents/teams/sre-team/cloud-native/skills/cloud-native-skill/SKILL.md).
  Also load [common security](skills/security/security-skill/SKILL.md) when the
  assignment handles credentials, private keys, recovery material, or decrypted
  payloads.
- For Rust code, load
  [Rust development](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/SKILL.md).
- For TypeScript, JavaScript, or Svelte scripts, load
  [TypeScript development](agents/teams/dev-team/typescript-dev/skills/ts-dev-skill/SKILL.md).
- For web design, load
  [web design](agents/teams/dev-team/web-designer/skills/web-design-skill/SKILL.md).
  Supply it to browser UI implementation assignments alongside TypeScript
  development. Design-only assignments do not require TypeScript; markup,
  styling, or component edits receive the applicable coding prerequisites.
- For repository scripts, CI, or build tooling, load the development skill
  for the implementation language.
- For secret handling in implementation or review, load
  [secret lifecycle](agents/teams/security-team/security-agent/skills/secret-lifecycle-skill/SKILL.md)
  after common security, regardless of the assigned agent's team.

## Cross-language prerequisites

For Rust/WASM consumers, including TypeScript and web implementations, load:

- [Rust–TypeScript separation](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/boundaries/rust-typescript-code-separation.md).
- [WASM contracts](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/boundaries/wasm-contracts.md).
- [WASM UI integration](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/boundaries/wasm-ui-integration.md) for reactive UI consumers.
- [Domain types](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/modeling/domain-types.md) and
  [serialization boundaries](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/boundaries/serialization-boundaries.md) for value and ABI design.
- [WASM name coherence](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/boundaries/rust-wasm-name-coherence.md).
- [Rust error handling](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/behavior/error-handling.md) and
  [domain states](agents/teams/dev-team/rust-dev/skills/rust-dev-skill/practices/modeling/domain-states.md)
  when interpreting Rust failure and absence contracts.

## Skill placement

Team-root skill directories such as `agents/teams/<team>/skills/` are
prohibited. Place specialized skills under their owning agent directory. Keep
common generic skills in `skills/`.

## Validation

- Verify that every selected specialization receives its common prerequisites.
- Carry applicable cross-language and security context with the implementation assignment.
- Keep routing here; keep technical requirements in their owning skills and practices.
