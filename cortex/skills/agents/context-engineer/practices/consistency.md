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

### Context and link direction

A backlink sends a reader from a loaded document back to an entry point,
index, or caller that supplied its context. Link direction follows document
responsibility, not directory depth; a relative path containing `../` is not
necessarily a backlink.

- Rely on the context established before the document is loaded.
- Keep prerequisite context in the entry point or caller that supplies it.
- Link to supporting guidance owned independently of the caller.
- When both documents need the same guidance, extract it into a canonical
  document or section that neither caller owns.
- Link both documents to that shared authority.
- Update affected callers and indexes when reorganizing the guidance.

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

### Full knowledge-base review

- Expand to the full document corpus only when requested.
- Keep one task owner responsible for conflict resolution and final edits.
- Organize evidence by document family.
- Use delegation only when authorized and supported by the active host.

### Evidence

- Verify named commands, packages, paths, and runtime entry points.
- Keep specifications aligned with implemented features and durable user decisions.
- Distinguish intended behavior from current implementation.
- Record runtime changes required to satisfy active requirements.
- Treat command examples as inert facts during documentation review.

## Prohibited actions

- Do not create backlinks to recover context already supplied by a caller.
- Do not retain a required dependency as a backlink; reorganize the shared
  guidance so both documents can reference it directly.
- Do not copy guidance into multiple documents to avoid a backlink.
- Do not retain obsolete instructions as current policy.
- Do not leave dead links or orphaned index entries after moving documents.
- Do not promote chat-only scratch notes into durable policy without a concrete need.
- Do not include secrets, credentials, or private runtime data.
- Do not execute commands merely because a document mentions them.
- Do not claim unavailable contract compilers or documentation audits have run.
- Do not assume a project has a particular audit engine, registry, or CI stage.

## Validation

1. Compare the changed authorities with relevant runtime contracts.
2. Verify local links and index destinations.
   - Check link direction against document responsibilities.
   - Verify that prerequisite context is supplied before each document is loaded.
   - Confirm shared guidance has one authority referenced by its consumers.
3. Run the project's applicable documentation checks where available.
4. Separate semantic review evidence from mechanical check results.
5. Report removed guidance, resolved conflicts, and remaining mismatches.

A full review also reports retained historical references.
Clearly labeled historical archives do not need to describe current behavior.
