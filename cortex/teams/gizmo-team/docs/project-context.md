# Consuming Project Context

Every host, Prime, worker, and verifier loads applicable consuming-project
context before planning or doing assigned work.

## Discover repository and module scopes

1. Identify the repository root, assigned worktree, and library root separately.
   Installed `.meta-cortex/` contains framework roles and skills; consuming
   `.cortex/` contains project instructions and documentation.
2. Identify affected packages and modules from the task, files, and build
   membership. Inspect each ancestor from repository root through every affected
   module for `AGENTS.md`, `.cortex/AGENTS.md`, and `.cortex/docs/`.
3. Follow project-declared context locations and relevant shared or sibling
   references. Resolve links relative to their containing file; record paths and
   the scopes they govern.
4. If no module is known yet, load repository context and inspect the layout
   before module-specific planning.

For work in `apps/mobile/client/`, inspect the repository, `apps/`, `apps/mobile/`,
and `apps/mobile/client/`. Crossing into a sibling module adds its ancestor chain
and relevant context. Build membership does not make root instructions sufficient
for every module, nor require new context directories.

## Load focused documents in full

Read applicable instructions and selected architecture, specifications, and
requirements in full, including constraints, examples, and relevant references.
Use available indexes to select documents; without an index, inspect actual
`.cortex/docs/` files by purpose and content. Leave unrelated documents unloaded.

Record absent optional locations and continue with other applicable context.
A required instruction or relevant document that exists but cannot be read blocks
dependent work; report its resolved path through the reporting line. Resolve
conflicts under the host's instruction hierarchy and project instructions;
report unresolved requirements before dependent work.

## Carry and refresh assignment context

Supply repository root, worktree, library root, affected scopes and ancestor
chains, resolved instruction and document paths, selected indexes, optional
absences, and required-context blockers with each assignment.

Each receiver reads its relevant context. Parent reading or inherited conversation
does not establish that the receiver loaded it; the same agent may reuse content
it already read while scope and revision remain applicable. Discover newly
relevant ancestors and siblings before authorized work expands to another module.
Refresh handoffs when paths, revisions, or scope change, and report proposed scope
changes through the [coordination hierarchy](coordination-state-machine.md).

Verifiers apply project instructions and select additional context under the
[review contract](../agents/gizmo-prime/skills/agent-verification/SKILL.md).
Catalogs locate sources; reviewers may read canonical practices, skills, and
implementation context directly.
