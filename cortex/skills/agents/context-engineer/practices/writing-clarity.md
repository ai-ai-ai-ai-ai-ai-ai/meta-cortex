# Writing Clarity

Dense prose hides constraints and makes instructions harder to follow.
Keep one independent idea per sentence.

## Required actions

### Atomic content

- Separate independent facts, rules, actors, and commands.
- Use short sentences for facts that stand alone.
- Use bullets when several facts share one topic.
- Keep necessary reasoning connected rather than turning it into disconnected bullets.

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

### Mappings and diagrams

- Represent repeated fields and exact mappings as enclosed structured lists.
- Key each entry by a bold primary item.
- Put its properties in nested bullets.
- Use Mermaid for architecture maps, flowcharts, and sequence diagrams.
- Use ordered or unordered lists for execution procedures.
- Inspect repository structure directly with the host's filesystem tools.
- Use at most a flat subsystem list when documenting repository organization.

### Host capacity

- Refer to capacity reported by the active host.
- Treat session allocation as current availability.
- Preserve the distinction between availability and architecture limits.

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

## Validation

1. Read each changed sentence for one-pass comprehension.
2. Split independent rules and actors into their own units.
3. Check list grouping against semantic ownership.
4. Check for tables, static trees, and ASCII graphics.
5. Report grouping defects outside the write scope without expanding the edit.

Literal code examples retain their syntax.
Do not use code fences to disguise prohibited document structure.
