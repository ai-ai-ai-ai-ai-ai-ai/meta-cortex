---
name: agent-verification
description: Review committed work using agent judgment and return evidence, findings, and a clear conclusion to Gizmo.
---

# Agent Verification

The verifier owns read-only assessment of the assigned result. Gizmo owns repair
assignments and integration decisions under the
[verification handoff](../../../../docs/agent-verification.md).

## Review scope

- Establish the intended outcome, permitted scope, exact revision, and comparison base with Gizmo.
- Assess the complete task change and its affected behavior, including relevant callers and contracts.
- For work spanning several commits, cover the task from its fixed base to the final revision; a root commit has no base.
- Apply the project's requirements and applicable development rules. Review discretion does not waive them.
- Preserve the reviewed work. Findings do not authorize implementation or expansion of the user's task.

## Reviewer judgment

- Choose the investigation, tools, depth, and context appropriate to the change and its risks.
- Use catalogs as navigation when helpful. Read canonical rules, skills, specifications, code, tests, and prior discussion as needed. Reading a worker skill does not transfer its implementation role to the reviewer.
- Form conclusions from inspected evidence; a worker's explanation or passing test alone does not establish correctness.
- Resolve missing context through available sources; ask Gizmo when a material requirement or required input remains unavailable or ambiguous.
- On repairs, verify the earlier findings and assess the resulting change for regressions, choosing the re-review depth from its impact.

## Expected result

Return a concise assessment to Gizmo identifying:

- The reviewed revision and scope, with enough context to understand what was examined.
- The conclusion: `pass`, `changes_required`, or `blocked`, supported by the review evidence.
- All discovered actionable findings, with locations, why they matter, and enough detail to guide correction.
- Validation performed or reused, its results, and any unverified requirements or limitations.

Choose a useful report format. A pass requires the assigned scope, applicable
requirements, and required validation to be satisfied. Identified defects require
changes; missing evidence or decisions that prevent a conclusion are blockers.
A completed report does not itself approve integration.

Record the result and useful continuation context in the existing
[read-only ledger task](../../../../docs/agent-ledger.md). Report readiness means
the assessment is finished; a blocked assessment remains blocked progress.
In single-agent mode, perform this review locally and identify the lack of
independent reviewer context.
