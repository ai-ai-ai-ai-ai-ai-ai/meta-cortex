---
name: typescript-verification
description: Review committed TypeScript work using the shared verifier workflow and the canonical TypeScript YAML catalogs. Read-only; reports all issues to Team Gizmo.
---

# TypeScript Verification

Select the TypeScript catalog for the shared verification workflow. The shared
skill owns review instructions; this skill supplies the subject context.

## Required actions

1. Load and apply the shared
   [agent verification skill](../../../../../gizmo-team/agents/gizmo/skills/agent-verification/SKILL.md).
2. Set its catalog root to the
   [canonical TypeScript catalog](../../../typescript-dev/skills/ts-dev-skill/index.yaml).

**Prohibited:** supply only the browser indexes as the TypeScript review scope.

**Required:** supply the canonical root, including its practices and cross-rule
checks, to the shared workflow.
