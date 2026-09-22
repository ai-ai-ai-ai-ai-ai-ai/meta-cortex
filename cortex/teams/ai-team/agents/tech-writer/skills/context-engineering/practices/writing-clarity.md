# Writing Clarity

Dense prose hides constraints and makes instructions harder to follow.
Keep one independent idea per sentence.

## Required actions

### Atomic content

- Separate independent facts, rules, actors, and commands.
- Use short sentences for facts that stand alone.
- Use bullets when several facts share one topic.
- Keep necessary reasoning connected rather than turning it into disconnected bullets.

**Prohibited:** “Read the schema, preserve its version, run the decoder tests, and update the release instructions.”

**Preferred:**

- Read the schema before editing its decoder.
- Preserve the schema version unless the task includes a migration.
- Run the decoder tests after changing its behavior.
- Update release instructions only if the release procedure changes.

Each bullet has one action and condition. The reason for reading the schema
stays attached to the decoder change.

### Instruction grouping

- Begin instructional structure with `Required actions`, then `Prohibited actions`.
- Place domain-specific groups beneath the appropriate branch.
- Omit a branch only when no instruction of that kind exists.
- Group large lists by genuine semantic domains.
- Preserve a homogeneous peer list when it has no meaningful domain split.
- Preserve a single ordered procedure when subdivision would break its meaning.
- Keep conditional substeps beneath the action that owns them.
- Keep negative failure conditions beneath their owning procedure action.
- Use nested items only when the parent owns the children.

**Prohibited:** “Required actions, part 1: load input; save output. Part 2: if decoding fails, report it.”

**Preferred:**

1. Decode the input.
   - If decoding fails, report the malformed field and stop.
2. Save the decoded output.

The failure belongs to decoding, not to an arbitrary second group. A separate
prohibition such as deleting the input belongs under Prohibited actions.

### Mappings and diagrams

- Represent repeated fields and exact mappings as enclosed structured lists.
- Key each entry by a bold primary item.
- Put its properties in nested bullets.
- Use Mermaid for architecture maps, flowcharts, and sequence diagrams.
- Use ordered or unordered lists for execution procedures.
- Inspect repository structure directly with the host's filesystem tools.
- Use at most a flat subsystem list when documenting repository organization.

**Prohibited:** a rendered table of agents and paths, or an ASCII directory tree copied into the instructions.

**Preferred:**

- **Reviewer**
  - Input: changed specification and its examples.
  - Output: findings tied to individual requirements.
- **Author**
  - Input: accepted findings.
  - Output: corrected specification.

The repeated fields belong beneath each role. Inspect the filesystem for current
paths; use a Mermaid diagram when the relationship itself needs visualization.

### Host capacity

- Refer to capacity reported by the active host.
- Treat session allocation as current availability.
- Preserve the distinction between availability and architecture limits.

**Prohibited:** “Launch at most eight workers; the framework always has eight slots.”

**Preferred:** “Read the host's current available capacity before dispatching
independent assignments. Queue remaining work until capacity becomes available.”

A session allocation is a runtime observation, not an architectural limit.

## Prohibited actions

- Do not pack independent requirements into one long sentence.
- Do not use rendered Markdown tables.
- Do not include static directory trees or nested file inventories.
- Do not use ASCII art, box drawings, or manual text flowcharts.
- Do not divide lists into arbitrary item-count chunks.
- Do not invent semantic domains for a homogeneous list.
- Do not detach failure conditions from their procedure to create a polarity branch.
- Do not encode, infer, or repeat a fixed numeric agent concurrency cap.
- Do not pre-budget dispatch waves against an invented numeric limit.
- Do not refactor out-of-scope documents merely because they contain grouping defects.

### Prohibited presentation patterns

**Prohibited:** wrap an ASCII directory tree in a code fence and call it an example;
then split the surrounding rules into “first ten” and “remaining ten.”

**Preferred:** describe only the relevant subsystem names and inspect their
actual paths. Group the rules by their decisions, keeping a homogeneous list intact.

Literal source-code examples retain their syntax; fences do not make an authored
navigation tree or arbitrary grouping acceptable.

## Validation

1. Read each changed sentence for one-pass comprehension.
2. Split independent rules and actors into their own units.
3. Check list grouping against semantic ownership.
4. Check for tables, static trees, and ASCII graphics.
5. Report grouping defects outside the write scope without expanding the edit.

Literal code examples retain their syntax.
Do not use code fences to disguise prohibited document structure.

**Prohibited review:** “The prose is shorter, so it is clear.”

**Preferred review:** “Separated the author and reviewer actions, kept the
failure branch beneath decoding, and found no tables or copied directory trees.”

Report an out-of-scope grouping defect instead of rewriting that document.
