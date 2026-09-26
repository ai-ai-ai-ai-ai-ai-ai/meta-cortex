# Practice Knowledge Graphs

Use a skill's hierarchical `index.yaml` catalogs as a rule-level map before
editing its Markdown practices. A file list is not enough: readers need the
actual requirements,
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
- **Source:** a mandatory `source: path.md#section-heading` reference to the exact
  Markdown section containing the rule and its examples; a document-only path
  is insufficient.

Include validation, migration, and boundary constraints. Merge repeated wording
of the same decision; do not drop its exception or replace several decisions
with “follow best practices.” Keep code and extended rationale in the source.

**Prohibited:** “Domain states — enums, options, and booleans.”

**Preferred:** keep each decision in a named YAML entry, with separate ordered
items for its requirements and exceptions:

```yaml
rules:
  - id: domain_states:boolean_conversion
    source: ../domain-states.md#convert-external-records-into-owned-types
    items:
      - Allow destination-owned From<bool> only to convert external flags.
      - Use TryFrom when validation can fail.
      - Boolean application fields and APIs remain prohibited.
```

Keep file, ownership, exclusions, and related-practice metadata at the practice
level. Preserve every existing summary item, exception, check, and relationship
when migrating a catalog. Wrap long scalar text across YAML lines; do not combine
separate decisions into one prose block. Rules, rationale, and examples remain
in their canonical Markdown practices.

**Prohibited:** replace the rule's item sequence with a long scalar containing
all its requirements, or move the authoritative practice into YAML.

The summary is precise enough to compare with another rule without guessing its
policy. It does not create a second independently editable policy.

## Find the owner and inspect overlaps

1. Read the target skill's entry point and navigate to the affected catalog
   branches using the loading procedure below.
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

Catalog each practice once as an owning entry within its skill. Related links
and cross-rule
references may repeat, but identify one canonical owner for each decision.
Keep the skill entry point linked to the root catalog instead of maintaining
another full index. Keep loading requirements in that skill entry point and
preserve them when moving an index.
Leaf practices may link directly to shared prerequisites, including through
`../` paths, without circular loading or restarting agent routing.

- **Prohibited:** permit `From<bool>` in the practice while the graph still says
  “no boolean parameter under any circumstances.”

- **Preferred:** preserve the rule name and update its boundary exception, the related
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

Use heading-derived `source` anchors and validate the actual heading, including
duplicate
heading suffixes. Put the rule and its examples under a focused heading when an
existing section is too broad. Update callers whenever a heading changes. Do not
add HTML anchors, numeric codes, or circular links just to manufacture a target.

**Prohibited:** a numbered code linked only to the document root.

**Preferred:** use the readable rule name and its exact source section:

```yaml
id: wasm_contracts:abi
source: ../wasm-contracts.md#construct-what-the-abi-declares
```

The paths above are illustrative syntax, not paths relative to this authoring
practice. A real catalog must resolve its links from its own location.

## Split catalogs by subject

- Every catalog directory has its own `index.yaml`. Parent catalogs contain
  `kind: navigation`, a `title`, and an ordered `entries` sequence. Each entry
  contains `title`, a relative `path`, and a brief `summary`.
- Group large catalogs by subject, then give each practice namespace a directory
  such as `practices/modeling/domain_types/index.yaml`. Do not inline every
  descendant rule in its parent. Do not create empty directories or indexes.
- A `kind: practice` leaf contains `owner`, `title`, `source_title`, `source`, `owns`,
  `excludes`, `relationships`, `related`, and `rules`. Ownership and relationship
  prose use item sequences. Related entries contain `title` and `path`; rules
  contain `id`, `source`, and ordered `items`. Empty metadata sequences are valid
  when the previous catalog supplied none; rule and item sequences are nonempty.
- Use the closed [rule-name enum](../scripts/src/ts/rule-name.ts) for rule and
  comparison IDs and the [practice-owner enum](../scripts/src/ts/practice-owner.ts)
  for each practice's `owner`. Keep source locations separate from owner identity.
  Add or remove enum members with the corresponding catalog entries; the vocabulary
  parity test rejects missing or unused members. Decoding rejects unregistered names.
- Preserve original subject groupings. Keep readable `practice:decision` IDs
  stable; the namespace identifies a decision, while `source` identifies its
  canonical Markdown owner. A practice can own a related namespace's decision.
- Put each cross-rule comparison in its own `kind: check` leaf, with `title`,
  `overview`, `prohibited`, `preferred`, and `compare`. Preserve the prose as item
  sequences and the compared rules as `id` and `source` references. Its parent
  catalog supplies a short summary so readers can select the relevant check.
- Resolve every path relative to the YAML file containing it. Update all callers
  when moving an index. Keep one catalog copy; remove superseded Markdown indexes.
- Keep team documentation catalogs navigation-only. Put their rules and
  explanations in the owning Markdown documents.

**Prohibited:** rename a 1,400-line Markdown index to YAML and make every worker
load it, or copy its rules into each parent catalog.

**Preferred:** a small root points to Modeling; Modeling points to
`domain_types/index.yaml`; that leaf contains the domain-type rule summaries
and links to the existing Markdown practice.

## Load only selected branches

1. Read the skill entry point and its mandatory prerequisites. These requirements
   still apply to focused assignments; catalog selection does not waive them.
2. Read each entry of the current navigation catalog in sequence. Select branches
   covering the assignment using their summaries. Record the selected paths and
   scope; do not recursively load unrelated branches.
3. For each selected practice leaf, visit every rule and its `items` in order.
   Read its canonical Markdown practice in full, including exceptions and
   examples. For each rule, record applicability and the resulting check or
   action; give a reason when it does not apply. Reuse a source already loaded.
4. Load related practices and cross-rule checks when the task crosses their
   boundaries. These references describe review relationships; they do not
   instruct a leaf to reload its parent or restart routing. Apply cross-language
   prerequisites when that boundary is involved.
5. Supply subagents only the required role and skill context, mandatory
   prerequisites, selected catalog paths, and relevant Markdown sources. Retain
   the selected paths and rule IDs in the assignment so coverage can be reviewed.
6. When scope expands, select the newly relevant branches before further work.
   For catalog maintenance, update affected rule summaries, exceptions, ownership,
   section references, and comparisons in the same change as their source.

**Prohibited:** skim the first rule, assume the remaining entries were applied,
or load every sibling namespace into a focused review.

**Preferred:** for a domain-type review, traverse each item in the selected
`domain_types/index.yaml`, check it against the changed code, and bring in
construction or serialization guidance only when those boundaries are involved.

A parser can validate structure and tooling can enumerate entries in a fixed
order. YAML alone does not prove that an agent read, understood, or correctly
applied a rule. Keep mechanical validation separate from that judgment.
