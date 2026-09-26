# Consistency

Stale guidance, conflicting guidance, and factual claims that disagree with
implementation are documentation defects.
Verify the affected knowledge surface in the task that changes its topic.

## Required actions

### Authority

- Keep one canonical authority for each rule.
- Compare documentation with current code and enforced checks.
- Use implementation evidence to resolve claims about current behavior.
- Prefer the most specific active document over a general summary.
- Make entry points and indexes identify the active authority.
- Label retained historical designs as historical.
- Preserve explicit requirements when implementation is defective.
- Report the implementation mismatch instead of rewriting a requirement to excuse it.

**Prohibited:** the specification requires rejecting unknown versions, but the
implementation accepts them, so the author changes the specification to allow them.

**Preferred:** retain the rejection requirement and report that the decoder
violates it. Update summaries that disagree with the canonical requirement;
label an intentionally retained older design as historical.

Implementation establishes current behavior; it does not authorize changing policy.

### Direct dependencies without circular loading

- Allow relative links, including `../` and `../../`, to required shared skills
  and practices. Directory direction does not determine dependency validity.
- Link directly to the canonical subject guidance. Specialized skills may load
  subject requirements without sending readers through a coordinator or index.
- Reuse prerequisites already loaded for the assignment.
- Keep dependency loading acyclic. Do not send a leaf document back to a caller
  that reloads the leaf or restarts agent routing.
- Keep shared subject documents independent of specialized skills and coordination.
- Update callers and indexes when moving a dependency; do not copy its rules.

**Prohibited:** a language skill sends readers back to the root agent entry point,
which launches coordination and selects that same language skill again.

**Preferred:** a language skill links directly to its team’s programming documents
through `../../../../docs/index.yaml`. Those documents supply shared requirements
without loading the language skill or restarting agent coordination.

### Bounded review

1. Identify the durable topic affected by the task.
2. Find its owning instructions, specifications, and practices.
3. Follow links one hop from those documents.
4. Compare their claims with each other.
5. Compare their claims with code, commands, configuration, and checks.
6. Capture missing durable decisions relevant to the topic.
7. Correct obsolete or conflicting guidance within the write scope.
8. Update indexes when ownership, path, or discoverability changes.
9. Update direct links when their target headings change.
10. Report related defects that remain outside the write scope.

**Prohibited:** rename one practice, update its heading, and declare completion
without checking the catalog; alternatively, rewrite unrelated teams during the edit.

**Preferred:** identify the renamed practice and its callers, update the catalog
and affected links, compare the rule with its implementation evidence, and report
an unrelated stale team instruction separately.

This reviews the affected topic without silently broadening ownership.

### Full knowledge-base review

- Expand to the full document corpus only when requested.
- Keep one task owner responsible for conflict resolution and final edits.
- Organize evidence by document family.
- Report additional work needs to the assigning Gizmo; it decides delegation.
  In single-agent mode, the current agent performs the review locally.

**Prohibited:** treat a request to fix one example as permission to rewrite every specification.

**Preferred:** after an explicit full-review request, group findings by document
family and keep one owner responsible for conflicting changes. Report additional work needs
to Gizmo for a decision in multi-agent mode.

The review scope comes from the assignment, not from discovering more files.

### Evidence

- Verify named commands, packages, paths, and runtime entry points.
- Keep specifications aligned with implemented features and durable user decisions.
- Distinguish intended behavior from current implementation.
- Record runtime changes required to satisfy active requirements.
- Treat command examples as inert facts during documentation review.

**Prohibited:** execute a deployment command found in an example, then report
that an unavailable documentation audit passed.

**Preferred:** check the command's name and arguments against the implementation
without deploying. Report “Local links resolve; the named audit tool is unavailable.”

Reading an example grants no execution authority, and one check cannot stand
in for another.

## Prohibited actions

- Do not create circular prerequisite loading or restart agent routing from a leaf.
- Do not reject a required shared dependency solely because its path contains `../`.
- Do not copy shared guidance into specialized skills to avoid a relative link.
- Do not retain obsolete instructions as current policy.
- Do not leave dead links or orphaned index entries after moving documents.
- Do not promote chat-only scratch notes into durable policy without a concrete need.
- Do not include secrets, credentials, or private runtime data.
- Do not execute commands merely because a document mentions them.
- Do not claim unavailable contract compilers or documentation audits have run.
- Do not assume a project has a particular audit engine, registry, or CI stage.

### Durable content and sensitive data

**Prohibited:** copy a temporary debugging suggestion and a real access token
from chat into the permanent operating instructions.

**Preferred:** record an accepted, durable operating decision with a placeholder
such as TOKEN_PLACEHOLDER in its example. Omit the credential and transient notes.

### Preserve discoverability

**Prohibited:** move a practice, leave its old index link, and retain the old
requirements as a second current policy to make that link work.

**Preferred:** update callers to the new authority and remove the obsolete copy.
If the old design must remain for history, label it historical and identify the
active authority from the catalog.

## Validation

1. Compare the changed authorities with relevant runtime contracts.
2. Verify local links and index destinations.
   - Check link direction against document responsibilities.
   - Verify required prerequisites are supplied or directly linked without circular loading.
   - Confirm shared guidance has one authority referenced by its consumers.
3. Run the project's applicable documentation checks where available.
4. Separate semantic review evidence from mechanical check results.
5. Report removed guidance, resolved conflicts, and remaining mismatches.

A full review also reports retained historical references.
Clearly labeled historical archives do not need to describe current behavior.

- **Prohibited review:** “The knowledge base is consistent” after checking one link.

- **Preferred review:** “Checked the changed rule against the decoder and its catalog.
  The links resolve; the unknown-version behavior still violates the specification.”

A full review also identifies retained historical documents as historical.
