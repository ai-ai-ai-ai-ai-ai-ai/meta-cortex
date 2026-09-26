# Focused Rules and Examples

Every substantive rule or explanatory section must teach one decision and
show a prohibited/preferred pair. Use code for programming decisions, prose
for writing decisions, and concrete scenarios for behavior or procedures.

## Required actions

### State one decision

- Name the condition where the instruction applies and the action it requires.
- Explain the consequence of the prohibited choice.
- Split independent decisions into separate sections, each with its own pair.
- Let one pair cover several statements only when all explain the same decision
  and the example demonstrates each of them.

- **Prohibited:** “Handle failures properly and keep documentation clean.”

This combines two subjects without specifying an action for either.

- **Preferred:** “When an example has not been executed, label it unverified.
  Do not describe it as passing.”

The condition and required report are explicit. Documentation layout belongs
in a separate section with its own example.

### Demonstrate the difference

- Label the alternatives **Prohibited** and **Preferred**.
- Keep the same situation and intended outcome in both alternatives.
- Show the actual wording, code, or sequence affected by the decision.
- Place the pair beside the rule and explain why the preferred version works.
- Include enough context to distinguish a violation from an allowed case.
- Demonstrate an exception with a concrete case showing its limit.

For the execution-reporting rule above, assume the author inspected an example
but did not run it.

- **Prohibited:** “The example passes.”

- **Preferred:** “Reviewed the example's parameter types; execution is unverified.”

Both report on the same review. The preferred report separates the evidence
obtained from the evidence still missing. If execution later succeeds, a report
may state “The example compiled with the documented supporting types.” That
does not establish that its behavior was tested.

### Keep examples with their authority

- Keep the rule and its examples in one owning practice.
- Keep team documentation catalogs limited to links and brief summaries.
- Skill knowledge graphs use brief decision and comparison cues under the
  [knowledge-graph rules](knowledge-graphs.md). Full requirements, exceptions,
  and examples stay in the authoritative source practice.
- Require a pair when a catalog entry introduces a new rule; move that rule
  into its owning practice instead of expanding the catalog.

**Prohibited catalog entry:** “Execution reports: never say an example passes
unless it was run. Bad: ‘passes.’ Good: ‘execution unverified.’”

**Preferred catalog entry:** “Execution reports: evidence labels and unverified
examples,” linked to the owning practice containing the rule and pair.

The team catalog identifies what to load. The practice supplies the explanation.
A skill graph can link related rules with short comparison cues.

## Prohibited actions

- Do not substitute generic advice or a decorative example for a concrete rule.
- Do not use an unrelated example or repeat a pair that teaches no new decision.
- Do not change the requirement merely to make its example easier to write.

**Prohibited:** “Communicate clearly. Good: ‘All done.’ Bad: ‘Done stuff.’”

**Preferred:** “When validation is incomplete, name the missing check.
Prohibited: ‘All done.’ Preferred: ‘Implementation is complete; browser
validation has not run.’”

The preferred pair demonstrates an observable reporting requirement rather
than a stylistic preference between two vague phrases.

## Validation

For each substantive section, identify its decision and its pair. Verify that
the pair demonstrates every requirement in that section and that the preferred
example complies with them.

- **Prohibited review:** “Every section has an example, so the document is clear.”

- **Preferred review:** “The failure-reporting section requires naming missing
  checks. Its preferred example names browser validation as unexecuted.”

The review must connect the example to the rule; counting code blocks or labels
does not establish that connection.
