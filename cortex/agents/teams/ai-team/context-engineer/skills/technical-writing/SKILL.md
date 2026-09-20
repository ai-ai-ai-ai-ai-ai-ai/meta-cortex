---
name: technical-writing
description: Write and maintain agent-facing specifications, instructions, skills, and practices. Keep their structure, authority, links, and content consistent.
---

# Technical Writing

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
2. Check the changed document against all four practices, including whether each substantive section's examples demonstrate its decision.
3. Verify affected paths, links, headings, and indexes.
4. Run applicable checks provided by the consuming project.
5. Report the checks actually run and any unresolved inconsistencies.

**Prohibited report:** “All documentation validated.”

**Preferred report:** “Reviewed the changed section against the four practices.
Its local links resolve; the code example was reviewed but not executed.”
