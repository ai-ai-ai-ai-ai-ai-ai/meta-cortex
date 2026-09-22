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

**Prohibited:** “Caching: speed, expiry, origin, retries, performance.”

**Preferred:** “Cache successful lookups until their expiry. This avoids repeated
origin requests while bounding staleness. After expiry, fetch a fresh result.”

The explanation connects the decision, reason, and consequence instead of
leaving a disconnected list of keywords.

### Rules articles

- Use unordered lists for requirements that share a topic.
- Put one invariant, choice, actor, or failure condition in each item.
- Keep siblings at the same semantic level.
- Nest details only beneath their owning item.
- Use bold labels when they improve scanning.
- Place substantial rationale below its rule or in a named explanation article.

**Prohibited:** “The author and reviewer should keep examples accurate, validate them, and maybe label failures.”

**Preferred:**

- The author records the execution result beside the example review.
- The reviewer checks that the recorded result supports the claim.
- An unexecuted example is labeled unverified.

The peer items distinguish the actors and the reporting condition.

### Procedure articles

1. State each action as an imperative step.
2. Nest substeps beneath their owning action.
3. Put conditional branches beneath the applicable step.
   - State the condition before its resulting action.
4. Name observable results.
5. End with validation or a terminal outcome.

**Prohibited:** “Validation includes artifacts, checks, and fixing failures.”

**Preferred:**

1. Build the example with its declared supporting types.
   - If compilation fails, record the diagnostic and correct the example.
2. Run the behavior checks.
3. Record the compiler and behavior results separately.

The order is executable, failure handling stays with its step, and the final
step names the evidence produced.

### Reference articles

- Use bullets for short catalogs.
- Use enclosed lists keyed by bold primary items for repeated fields.
- Keep explanations as named properties beneath the corresponding entry.
- Use code blocks for literal syntax, commands, and examples.
- Link to authoritative rules instead of creating independently maintained
  policies in lookup material. Skill knowledge graphs may include synchronized
  rule summaries and cross-rule comparisons under the
  [knowledge-graph rules](knowledge-graphs.md).

**Prohibited:** “Error handling: use typed failures; never unwrap; here is the entire error policy again.”

**Preferred:** “Error handling: typed failures and propagation,” linked to the
owning practice. A command reference may show the literal command in a code block.

A reference selects an authority instead of becoming another copy of it.

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

**Prohibited:** separate top-level headings for “Decode,” “Malformed input,”
and “Report malformed input,” even though the latter two only describe decoding.

**Preferred:** an H2 for “Import,” an H3 for “Decode input,” and a conditional
substep for reporting a malformed field. Keep an independent “Export” topic at H2.

Move callers' heading links when a topic moves; do not preserve a dead anchor
merely because the document still has a similarly named title.

### Action blocks

- State the outcome when an article defines an action.
- Identify inputs needed to begin.
- Use ordered steps when sequence matters.
- Keep failure handling with its owning procedure action.
- Define observable validation.
- Use substantial subheadings or short bold labels according to content size.

**Prohibited:** “Update the catalog.”

**Preferred:** “Given the renamed practice and its old path, replace that path
in the catalog and its callers. Verify that every changed link resolves.”

The input, edit, and observable completion are explicit without an empty
heading for each sentence.

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

### Presentation without policy changes

**Prohibited:** replace “reject unsupported versions” with “prefer supported
versions” while adding headings and describing the change as formatting.

**Preferred:** preserve “reject unsupported versions” and move it beneath the
owning validation section. Remove an empty summary heading instead of treating
it as completed guidance.

### Markdown and managed markers

**Prohibited:** add an HTML table or hidden HTML comment to carry authored rules.

**Preferred:** use a keyed Markdown list for the rules. Preserve an installer’s
required start/end markers verbatim when editing their surrounding text.

A literal HTML syntax example belongs in code or escaped text. It is not a
mechanism for hiding instructions or rendering a prohibited structure.

## Validation

1. Identify each article's purpose and primary body shape.
2. Verify that headings and lists reflect actual ownership.
3. Verify that procedure sections contain ordered actions.
4. Check that substantive sections contain meaningful content.
5. Check that repeated fields use enclosed lists.
6. Verify preserved meaning and affected navigation.

Mechanical checks can detect syntax defects.
Semantic review must establish that the chosen structure fits the content.

- **Prohibited review:** “The document has headings, so its structure passes.”

- **Preferred review:** “The import section uses ordered actions, its failure
  branch stays beneath decoding, and the updated catalog targets the new heading.”

Heading presence is a syntax fact; useful grouping requires semantic review.
