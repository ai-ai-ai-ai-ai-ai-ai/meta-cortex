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

Run the bundled Vale and remark checks against actual Markdown files.
Initialization installs mise, Bun, Vale, and the shared script dependencies.
Individual skills reuse those installations. Run these commands from the
library root (`cortex/` here, `.meta-cortex/` in an installed project).

Check the framework:

```sh
bun run docs:check
```

Check selected project documents using paths relative to the library root:

```sh
bun run docs:check ../AGENTS.md ../docs
```

Quoted glob patterns and absolute paths are also supported. Dependency folders,
Git metadata, and Rust build output are excluded. A selection matching no
Markdown files fails. Both tools report file locations; a finding or tool failure
makes the command fail. Checks never rewrite documents.

**Prohibited:** send an agent-authored description of a document and claim its
source was checked.

**Preferred:** pass its path, run the checks, and fix the findings in the file.

### Check coverage

- **Vale:** checks repeated words, sentence spacing, and Cortex product-name
  spellings. The selected [styles](scripts/styles/README.md) ship with the framework;
  no per-task style download is needed.
- **remark:** parses Markdown, including frontmatter and GitHub tables. Standard
  plugins check local file links, heading anchors, reference definitions, and
  authored HTML. External URLs are not fetched.
- **Article plugin:** checks empty H2/H3 sections, more than three consecutive
  prose paragraphs, procedure headings without numbered actions, and tables.
- **Practice-index plugin:** checks local `practices/` files against the index's
  `File:` or `Source:` entries, duplicate owning entries, duplicate rule names,
  and rule links missing heading anchors. Links to shared practices outside that
  directory remain prerequisites; semantic ownership still needs review.

Meaning, rule completeness, and cross-document policy conflicts remain semantic
review tasks. An absent index is not proof of coverage. The checker validates
existing practice indexes and does not invent them.

**Prohibited:** report complete semantic coverage because the command passed.

**Preferred:** report which files passed and separately describe the ownership,
policy, and example review performed.

### Maintain the checks

1. Prefer existing Vale rules and remark plugins for standard checks.
2. Keep only Cortex-specific structural rules in `scripts/src/ts`.
3. Put regression fixtures in `scripts/src/test` and run the workspace checks.
4. Preserve [Nook's MIT notice](scripts/LICENSE.nook) for the adapted article checks
   and Google's notice alongside its selected rule.

Run after changing the implementation:

```sh
bun run verify
bun run docs:check
```

**Prohibited:** add a custom request protocol or Markdown parser around the tools.

**Preferred:** configure the maintained tools and add a small plugin only for a
Cortex rule they do not provide.
