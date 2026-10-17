# Focused Rules and Examples

Teach concrete decisions. Add an example when it clarifies a non-obvious choice,
exception, or boundary; omit examples that merely repeat an instruction.
A prohibited/required pair is useful when comparing alternatives, not as a quota
for every section. Subject requirements still apply: [Code Practice Writing](../../code-practice-writing/SKILL.md)
requires programming code pairs and owns their validation.
Use code for programming decisions, prose for writing decisions, and concrete
scenarios for behavior or procedures.
Local Git and verification architecture use the exception under [Demonstrate the difference](#demonstrate-the-difference).

## Required actions

### State one decision

- Name the condition where the instruction applies and the action it requires.
- Explain the consequence of the prohibited choice.
- Separate independent decisions; add sections only when they aid navigation.
- Let one example cover related statements when it demonstrates their decision.

- **Prohibited:** “Handle failures properly and keep documentation clean.”

This combines two subjects without specifying an action for either.

- **Required:** “When an example has not been executed, label it unverified.
  Do not describe it as passing.”

The condition and required report are explicit. Documentation layout belongs
in its own topic; an example is needed only if it clarifies that decision.

### Demonstrate the difference

Local Git workflow documentation follows
[Delivery Writing](../../delivery-writing/SKILL.md). Verification documentation follows
[Agent Verification](../../../../../../gizmo-team/agents/gizmo-prime/skills/agent-verification/SKILL.md).
Both describe concise architecture and expected results while leaving execution
methods to the agent. Those architecture statements do not require per-rule sections or prohibited/required examples.
This exception covers their role and handoff descriptions, not programming rules
or unrelated delivery contracts. For example, a statement that each writer owns
a worktree can stand alone; a Rust input-validation rule still needs its code pair.

- When contrasting alternatives, label them **Prohibited** and **Required**.
  Retain pairs required by subject guidance; do not add them solely for symmetry.
- Keep the same situation and intended outcome in both alternatives.
- Show the actual wording, code, or sequence affected by the decision.
- Place the pair beside the rule and explain why the required version works.
- Include enough context to distinguish a violation from an allowed case.
- Demonstrate an exception with a concrete case showing its limit.

For the execution-reporting rule above, assume the author inspected an example
but did not run it.

- **Prohibited:** “The example passes.”

- **Required:** “Reviewed the example's parameter types; execution is unverified.”

Both report on the same review. The required report separates the evidence
obtained from the evidence still missing. If execution later succeeds, a report
may state “The example compiled with the documented supporting types.” That
does not establish that its behavior was tested.

### Keep examples with their authority

- Keep the rule and its examples in one owning practice.
- Keep team documentation catalogs limited to links and brief summaries.
- Skill knowledge graphs use brief decision and comparison cues under the
  [knowledge-graph rules](knowledge-graphs.md). Full requirements, exceptions,
  and examples stay in the authoritative source practice.
- Move a new rule from its catalog entry into the owning practice. Apply that
  subject's example requirements there instead of expanding the catalog.

**Prohibited catalog entry:** “Execution reports: never say an example passes
unless it was run. Bad: ‘passes.’ Good: ‘execution unverified.’”

**Required catalog entry:** “Execution reports: evidence labels and unverified
examples,” linked to the owning practice containing the rule and any example.

The team catalog identifies what to load. The practice supplies the explanation.
A skill graph can link related rules with short comparison cues.

## Prohibited actions

- Do not substitute generic advice or a decorative example for a concrete rule.
- Do not use an unrelated example or repeat a pair that teaches no new decision.
- Do not change the requirement merely to make its example easier to write.

**Prohibited:** “Communicate clearly. Good: ‘All done.’ Bad: ‘Done stuff.’”

**Required:** “When validation is incomplete, name the missing check.
Prohibited: ‘All done.’ Required: ‘Implementation is complete; browser
validation has not run.’”

The required pair demonstrates an observable reporting requirement rather
than a stylistic preference between two vague phrases.

## Validation

Check each section's decision and preserve the subject's example requirements.
For local Git and verification architecture, check ownership, expected results,
and agent discretion. Where examples are present, verify that they clarify the
actual decision and comply with its requirements. Remove decorative repetition;
do not treat the absence of a generic pair as a defect.

- **Prohibited review:** “Every section has an example, so the document is clear.”

- **Required review:** “The failure-reporting section requires naming missing
  checks. Its required example names browser validation as unexecuted.”

The review must connect the example to the rule; counting code blocks or labels
does not establish that connection.
