# Article Structure

Visible structure must match the meaning of the content.
Choose the body shape for each substantive H2 or H3 article.

## Required actions

### Explanation articles

- Open with the conclusion, purpose, or owned question.
- Use prose for rationale, tradeoffs, history, and causal explanation.
- Split parallel facts into bullets.
- Introduce a subheading only when the subtopic is independently navigable.
- End with implications or a decision when the explanation drives action.

### Rules articles

- Use unordered lists for requirements that share a topic.
- Put one invariant, choice, actor, or failure condition in each item.
- Keep siblings at the same semantic level.
- Nest details only beneath their owning item.
- Use bold labels when they improve scanning.
- Place substantial rationale below its rule or in a named explanation article.

### Procedure articles

1. State each action as an imperative step.
2. Nest substeps beneath their owning action.
3. Put conditional branches beneath the applicable step.
   - State the condition before its resulting action.
4. Name observable results.
5. End with validation or a terminal outcome.

### Reference articles

- Use bullets for short catalogs.
- Use enclosed lists keyed by bold primary items for repeated fields.
- Keep explanations as named properties beneath the corresponding entry.
- Use code blocks for literal syntax, commands, and examples.
- Link to authoritative rules instead of duplicating them in lookup material.

### Hierarchy

- Use H2 for a major article owned by the document.
- Use H3 for a substantial subarticle owned by its H2.
- Use nested lists for containment, branches, or substeps.
- Use flat lists for semantic peers.
- Use paragraphs to explain relationships.
- Use H4 through H6 only when they provide useful navigation.
- Keep transitions visible when an article combines body shapes.
- Update document indexes when ownership, paths, or discoverability change.
- Update direct heading links when their target changes.

### Action blocks

- State the outcome when an article defines an action.
- Identify inputs needed to begin.
- Use ordered steps when sequence matters.
- Keep failure handling with its owning procedure action.
- Define observable validation.
- Use substantial subheadings or short bold labels according to content size.

## Prohibited actions

- Do not use authored HTML, including inline HTML and comments.
- Do not use rendered Markdown tables.
- Do not number unordered facts as if they were procedural steps.
- Do not hide parent-child relationships in flat bullets.
- Do not add deep nesting for decoration.
- Do not create a heading for every sentence.
- Do not add empty boilerplate sections.
- Do not change policy under the guise of a presentation-only rewrite.
- Do not treat a title or empty structural element as substantive content.

Literal HTML examples belong in code or escaped text.
Externally managed file markers are integration artifacts, not authored guidance.
Preserve their required syntax when editing surrounding prose.

## Validation

1. Identify each article's purpose and primary body shape.
2. Verify that headings and lists reflect actual ownership.
3. Verify that procedure sections contain ordered actions.
4. Check that substantive sections contain meaningful content.
5. Check that repeated fields use enclosed lists.
6. Verify preserved meaning and affected navigation.

Mechanical checks can detect syntax defects.
Semantic review must establish that the chosen structure fits the content.
