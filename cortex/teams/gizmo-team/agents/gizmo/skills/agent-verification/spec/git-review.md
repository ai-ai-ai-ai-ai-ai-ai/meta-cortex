# Read the Assigned Git Revision

The verifier reviews committed content without changing the worker's checkout.
The [communication protocol](communication-protocol.md) owns messages and reports;
[Local Feature Work](../../../../../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md)
owns workspace and integration responsibilities.

## Review scope

- Resolve the exact final commit supplied by Gizmo and the fixed review base in assignment context.
- For a task spanning multiple commits, compare the base and final revision to cover the complete task.
- For an explicitly assigned single-commit review, use its first parent; a root commit adds its entire tree.
- Record the resolved base and final revision in the report so its coverage is reproducible.
- Missing objects or an ambiguous base are blockers; the current checkout is not a substitute.
- Include all changed paths and applicable metadata, including deletions, renames, binaries, and submodules.
- Inspect committed files and relevant unchanged callers; cite evidence from those revisions.
- Choose read-only Git tools appropriate to the review. Leave the worker's workspace unchanged.
- Request missing validation evidence through Gizmo and report limitations explicitly.

A two-commit task is reviewed from its assigned base through its final revision.
Reviewing only the second commit would omit part of that task. Repairs retain the
full task scope at the new revision, including earlier findings.
