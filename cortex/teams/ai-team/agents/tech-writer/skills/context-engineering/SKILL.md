---
name: context-engineering
description: Write and maintain agent-facing specifications, instructions, skills, and practices. Keep their structure, authority, links, and content consistent.
---

# Context Engineering

Keep the consuming project's persistent agent context readable and accurate.
This includes specifications, instructions, skills, practices, and their indexes.
Identify relevant documents by their purpose and the project's conventions.
Discover their locations from project instructions and actual files.

## Required actions

### Authoring

- Apply [writing clarity](practices/writing-clarity.md) to changed prose.
- Apply [focused rules and examples](practices/focused-examples.md) to every substantive rule or explanatory section, whether it concerns code, prose, or behavior.
- Apply [article structure](practices/article-structure.md) to changed documents.
- Apply [consistency](practices/consistency.md) to authority, context flow, and link direction.
- Apply [practice knowledge graphs](practices/knowledge-graphs.md) when selecting
  rule owners, changing requirements or exceptions, or updating a skill catalog.
- Treat violations of these practices as P1 documentation defects.
- Preserve exact policy meaning when changing presentation.
- Keep each policy in one canonical document.
- Use links to compose policies instead of copying them.

**Prohibited:** rewrite a rule for convenience, copy it into two skills, and
report that adding headings proves the documentation is correct.

**Preferred:** preserve the requirement in its owning practice, add the focused
example there, and update its catalog link. Review meaning separately from link checks.

### Scope and ownership

- Keep edits within the task's bounded document scope.
- Keep subject ownership with the task owner when applying this skill.
- Give domain-specific authoring extensions a domain-specific name.
- Keep those extensions limited to additional domain requirements.
- Apply these practices to this skill when editing it.

**Prohibited:** a task to clarify one Rust example creates a second generic
writing skill and rewrites every team's instructions.

**Preferred:** improve the assigned example using the existing writing practices.
Keep Rust-only example requirements in the programming extension and report
unrelated findings without editing them.

## Prohibited actions

- Do not duplicate or partially restate this skill in another authoring skill.
- Do not infer an additional agent role from loading a writing skill.
- Do not assume a particular repository layout, installer, or development workflow.
- Do not broaden a scoped edit into a full knowledge-base rewrite.
- Do not claim that reading documents establishes a successful mechanical audit.

**Prohibited:** loading this skill spawns an unsolicited writer role, assumes
an installer layout, and claims that reading the files completed an audit.

**Preferred:** the already assigned owner uses the project's actual document
locations and reports the specific semantic and mechanical checks performed.

## Validation

1. Review meaning, scope, and document ownership.
2. Check the changed document against the applicable authoring practices, including whether each substantive section's examples demonstrate its decision.
3. Verify affected paths, links, headings, and indexes.
4. Run applicable checks provided by the consuming project.
5. Report the checks actually run and any unresolved inconsistencies.

**Prohibited report:** “All documentation validated.”

**Preferred report:** “Reviewed the changed section against the four practices.
Its local links resolve; the code example was reviewed but not executed.”

## Executable audits

Use the co-located [scripts](scripts/package.json) for deterministic checks of
supplied document facts. They provide a local YAML command interface with a
command catalog; they do not require an MCP server or Loom.

### Prepare and discover

1. Resolve the Meta-Cortex library root as `library_root` (`cortex/` in this
   repository, `.meta-cortex/` in an installed project).
2. Install the root workspace once with Bun 1.3.14:

   ```sh
   cd "$library_root"
   bun install --frozen-lockfile --ignore-scripts
   ```

   The root manifest and lockfile cover all skill script packages. The hoisted
   linker shares one root `node_modules/`; Bun reuses its home-directory cache
   (`~/.bun/install/cache`). Do not create per-skill installs, lockfiles, caches,
   or temporary runtime copies. Keep dependency versions aligned across skills
   so Bun does not need nested installations for conflicts.

3. Discover command schemas and complete YAML examples:

   ```sh
   bun teams/ai-team/agents/tech-writer/skills/context-engineering/scripts/src/ts/cli.ts --request-yaml='version: 1
   tools:
     list: {}'
   ```

4. Adapt a returned `exampleYaml` to the assigned documents and pass it as one
   quoted `--request-yaml` argument. Responses are YAML on stdout.
   Exit codes: `0` for discovery or no findings, `1` for findings, `2` for an
   invalid request or a response exceeding its limit.

**Prohibited:** claim that catalog discovery audited the repository.

**Preferred:** invoke an audit with the relevant facts and report its findings
separately from semantic review.

### Select a command

- **`articles.audit`:** accepts document paths and ordered semantic blocks.
  It checks empty H2/H3 articles, more than three consecutive prose blocks,
  explicitly procedure-labeled sections without ordered actions, and tables.
  These checks adapt Nook's skill scripts; they do not prove writing quality.
- **`navigation.audit`:** accepts documents, their owning graph paths and exact
  heading anchors, and the graphs' named owning entries. It checks missing owners,
  missing entries or targets, missing anchors, foreign ownership, and duplicate
  rule names within a graph. Distinct rules may link to the same section.

Supply the complete document/graph inventory for the scope being checked.
Only put owning entries in `graphs.entries`; related links and prerequisites
are not ownership declarations. Each entry supplies its `rule` name, `target`,
`anchor`, and source `line`. Paths identify supplied facts, not files to open.
Catalog examples and unit fixtures use synthetic paths; replace them with facts
from the assigned documents.
Use normalized project-relative paths and resolve relative links before passing
navigation facts. An empty `anchor` means a document-level link.

Article blocks distinguish substantive `paragraph`, `visible-ordered-list`, and
`structure` content from `transparent` definitions or empty elements. Use
`density-separator` for image-only paragraphs or thematic breaks, `heading`
with depth/text, and `table` for rendered Markdown tables. An ordered example
inside a quote, code block, or footnote is not a `visible-ordered-list` action.

This iteration does not parse Markdown, discover files, generate graphs, check
HTML, or infer semantic ownership. The caller supplies those facts; omitted or
incorrect facts limit the evidence. Requests are limited to 64 KiB and responses
to 256 KiB. The scripts reject unknown fields, versions, duplicate YAML keys,
anchors, aliases, tags, directives, and multiple YAML documents.

**Prohibited:** send a filename alone and report that its contents were checked.

**Preferred:** supply the document's semantic blocks or navigation inventory,
inspect the returned findings, and state the audited scope.

### Maintain scripts

- Keep source in `scripts/src/ts` and tests in `scripts/src/test`.
- Run `bun run verify` at the library root after changing code.
- Update dependencies through the root workspace and commit its `bun.lock`.
- Update discovery examples with their request contracts. Every example must
  remain directly invocable.
- Preserve [Nook's MIT notice](scripts/LICENSE.nook) with the adapted code.
- Keep Nook's policy registry, Loom adapters, and agent lifecycle outside this
  skill. Audit commands only return findings about supplied facts.

**Prohibited:** make an audit dispatch agents or read commands from Markdown.

**Preferred:** keep execution limited to the selected, statically defined audit.
