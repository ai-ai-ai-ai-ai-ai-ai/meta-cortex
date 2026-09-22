# Practice Knowledge Graphs

Use a skill's `index.md` as a rule-level map before editing its
practices. A file list is not enough: readers need the actual requirements,
prohibitions, exceptions, and checks to detect contradictions across subjects.
The source practice remains the authority for explanation and examples.

## Inventory decisions, not just files

Each practice entry contains its file, owned subjects, excluded neighboring
subjects, related practices, and the complete list of its distinct rules.
For every rule, record:

- **Rule name:** a readable `practice:decision` namespace, such as
  `wasm_contracts:abi`; do not use opaque numbered codes.
- **Decision:** the required or prohibited behavior, not a topic label.
- **Scope and exceptions:** when it applies and what narrowly permits deviation.
- **Source:** a mandatory link to the exact Markdown section containing the
  rule and its examples. Link the rule name itself as `path.md#section-heading`;
  a document-only link is insufficient.

Include validation, migration, and boundary constraints. Merge repeated wording
of the same decision; do not drop its exception or replace several decisions
with “follow best practices.” Keep code and extended rationale in the source.

**Prohibited:** “Domain states — enums, options, and booleans.”

**Preferred:** keep the linked rule name on its own line, with separate nested
bullets for its requirements and exceptions:

```markdown
- **[domain_states:boolean_conversion](practices/modeling/domain-states.md#convert-external-records-into-owned-types)**

  - Allow destination-owned From<bool> only to convert external flags.
  - Use TryFrom when validation can fail.
  - Boolean application fields and APIs remain prohibited.
```

Keep file, ownership, and related-practice metadata at the practice level.
Add requirements beneath the existing rule name instead of extending a single
paragraph. Wrap long bullet text across source lines; keep each link intact.

**Prohibited:** append decisions, exceptions, and checks to one long line after
the rule link, separated by semicolons.

The summary is precise enough to compare with another rule without guessing its
policy. It does not create a second independently editable policy.

## Find the owner and inspect overlaps

1. Read the target skill's entry point and complete knowledge graph.
2. Locate the affected rule names and their canonical owners. Read those practices
   in full, including examples that can contradict the stated rule.
3. Read related rules and the prerequisites loaded for the assignment. Compare
   their scope, exceptions, and validation obligations.
4. Extend the existing owner. Create a practice only for a distinct subject with
   an explicit boundary; add its rules to the graph in the same change.

If no graph exists, inspect the current catalog and source practices. Do not
invent a location or create an unrelated catalog during a scoped edit.

**Prohibited:** add a new API-input constructor policy because that file is open,
without checking the existing construction rule or its exceptions.

**Preferred:** locate the construction rule name, read its owner, and compare it
with API-input and typestate rules. Update the existing construction policy and
any affected examples rather than creating a competing requirement.

## Synchronize source and catalog

Change a rule and its summary together. Update its scope, exceptions, sources,
and affected relationships, not just its filename. When moving a rule, preserve
its name and point it to the new owner. When splitting one decision into several,
retain the original name for the surviving decision and choose new names for the
others. Remove deleted names and update every reference; do not retain meaningless aliases.

Catalog each practice once as an owning entry. Related links and cross-rule
references may repeat, but identify one canonical owner for each decision.
Keep the skill entry point linked to the graph instead of maintaining another
full index. Preserve implementation loading requirements when moving an index.
Leaf practices may link directly to shared prerequisites, including through
`../` paths, without circular loading or restarting agent routing.

**Prohibited:** permit From<bool> in the practice while the graph still says
“no boolean parameter under any circumstances.”

**Preferred:** preserve the rule name and update its boundary exception, the related
raw-conversion entry, and their examples together. The graph and source now state
the same allowed behavior.

## Make conflicts visible

Record overlaps using rule names and explain their relationship: prerequisite,
specialization, application of another rule, or unresolved conflict. Different
filenames or languages do not establish precedence. Do not silently weaken a
policy or turn an implementation defect into an exception to make the graph neat.
Resolve conflicts using the authorized task context; otherwise record the exact
incompatible requirements and report the outstanding decision.

**Prohibited:** copy both “never rename” and “rename every external field” into
separate entries and report that every file is cataloged.

**Preferred:** identify the two rule names and state the precise external-protocol
exception authorized by the task. If no exception has been authorized, retain
both source facts and explicitly mark the conflict as unresolved.

## Validate rule coverage and meaning

- Review every source section, normative paragraph, list, exception, example, and
  validation requirement against the graph. Every distinct decision must be
  represented; file-count parity does not establish rule completeness.
- Verify unique names, one owning entry per practice, valid source/related links and section anchors,
  no stale paths, and no circular prerequisite loading.
- Compare changed summaries with their sources, including negative examples and
  limits. Check related rule names for conflicting scopes or exceptions.
- Report mechanical results separately from the semantic coverage review and
  unresolved conflicts. Do not claim automated semantic completeness.

**Prohibited report:** “All rules are covered” because every Markdown file has
one link in the graph.

**Preferred report:** “Every practice has an owning entry, rule names are unique, and
links resolve. Reviewed its rule/exception sections against the summaries;
the queue and Effect requirements still need a documented boundary decision.”

## Make rules directly navigable

Use heading-derived anchors and validate the actual heading, including duplicate
heading suffixes. Put the rule and its examples under a focused heading when an
existing section is too broad. Update callers whenever a heading changes. Do not
add HTML anchors, numeric codes, or circular links just to manufacture a target.

**Prohibited:** a numbered code linked only to the document root.

**Preferred:** use the readable rule name and its exact source section:

```markdown
[wasm_contracts:abi](practices/boundaries/wasm-contracts.md#construct-what-the-abi-declares)
```

The links above are illustrative syntax, not paths relative to this authoring
practice. A real catalog must resolve its links from its own location.
