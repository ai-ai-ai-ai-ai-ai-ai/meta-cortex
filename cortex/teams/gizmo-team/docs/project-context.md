# Consuming Project Context

Every host agent, Gizmo coordinator, worker, and verifier loads the consuming
project's operational context before planning or doing assigned work.

## Required actions

### Discover repository and module scopes

1. Identify the consuming repository root and assigned worktree separately from
   the library root. Installed `.meta-cortex/` contains framework roles and skills;
   consuming `.cortex/` contains project instructions and documentation.
2. Identify affected project, package, and module directories from the task,
   actual files, and build manifests. Include each ancestor directory from the
   repository root through every affected module.
3. Inspect those directories for applicable `AGENTS.md`, `.cortex/AGENTS.md`,
   and `.cortex/docs/`. Discover relevant architecture, specifications, and
   requirements from instructions, available indexes, filenames, and contents.
4. Follow project-declared context locations and relevant references, including
   shared and sibling context. Resolve links relative to their containing file.
   Record resolved paths and the scope each governs.
5. If no module is known yet, load repository context and inspect the layout to
   identify candidate scopes before module-specific planning.

**Prohibited:** work in `apps/mobile/client/` after reading only root
`AGENTS.md`, assuming nested `.cortex/` context cannot exist.

**Required:** inspect the repository, `apps/`, `apps/mobile/`, and
`apps/mobile/client/` for applicable instructions and project documentation.
Keep the installed framework location separate from these project scopes.

### Load focused documents in full

1. Read applicable instructions, including discovered `.cortex/AGENTS.md`.
2. Use available navigation indexes to select relevant architecture,
   specification, and requirement documents. Read selected Markdown in full,
   including constraints, examples, and relevant references.
3. Without an index, inspect actual `.cortex/docs/` files and select by purpose
   and content. An absent index never excuses skipping discovered documentation.
   Leave unrelated documents unloaded.
4. Record optional context locations that are absent. A project without
   `.cortex/` continues with its other applicable instructions and documents.
   A discovered required instruction or relevant document that cannot be read
   blocks dependent work; report its resolved path through the reporting line.
5. Resolve conflicts under the host's instruction hierarchy and applicable
   project instructions. Report unresolved requirements before dependent work.

**Prohibited:** skip `service/.cortex/docs/architecture.md` because there is no
index, or treat an unreadable relevant specification as absent optional context.

**Required:** read the architecture and relevant specification in full. Report
an unreadable specification and stop its dependent work. If `service/.cortex/`
is absent, record that absence and use other applicable service context.

### Carry and refresh assignment context

1. Supply every assignment with repository root, worktree, library root,
   affected scopes and ancestor chains, resolved instruction and document paths,
   selected indexes, and optional absences or required-context blockers.
2. Each receiving agent reads its relevant operational project context before
   planning or work. Parent reading and inherited conversation do not establish
   that the receiver loaded it. Reuse content already read by that same agent
   when scope and revision remain applicable.
3. When authorized work expands to another module, discover its ancestors and
   relevant sibling context before further affected work. Refresh selected
   documents and handoffs when paths, revisions, or scope change. Report proposed
   scope changes through the existing coordination hierarchy.
4. Verifiers read consuming-project operational instructions and relevant
   architecture, specifications, and requirements in full. Framework subject
   practice review remains index-only under the verifier's review protocol.
   Project context does not authorize loading worker skills or framework
   subject-practice Markdown.

**Prohibited:** widen work from `services/api/` to `services/auth/` without
reading auth context, or skip the API specification during index-only review.

**Required:** discover and load relevant auth context and pass updated scoped
paths through Gizmo. The verifier reads the project specification while retaining
framework practice source links as catalog citations.

### Map context to the actual layout

Use build membership and task dependencies to identify scopes. These examples
illustrate discovery; they do not require new context directories.

- **Monorepo**
  - For `apps/web/` and `packages/session/`, inspect both ancestor chains and
    scoped `.cortex/` context, including shared architecture referenced by either.
- **Gradle multiproject build**
  - Read settings to locate included projects. Work in `mobile-app/` includes
    repository and `mobile-app/.cortex/` context when present. A change reaching
    another included project adds that sibling's ancestor chain and context.
- **Rust workspace**
  - Read workspace membership. Work in `crates/storage/` includes repository,
    `crates/`, and storage context when present. Crossing into `crates/cli/`
    adds its chain and relevant documentation.

**Prohibited:** assume all included projects or workspace crates share only
root context because they belong to one build.

**Required:** inspect actual affected modules and newly relevant sibling scopes.
Read their relevant context before work; leave unrelated sibling docs unloaded.
