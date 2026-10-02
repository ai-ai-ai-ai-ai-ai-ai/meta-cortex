---
name: tech-writer-verification
description: Review committed documentation using the shared verifier workflow and complete writing YAML catalogs. Read-only; reports every issue and blocker to Team Gizmo.
---

# Tech Writer Verification

Select the writing catalog for the shared verification workflow. The shared
skill owns review instructions; this skill supplies the subject context.

## Required actions

1. Load and apply the shared
   [agent verification skill](../../../../../gizmo-team/agents/gizmo/skills/agent-verification/SKILL.md).
2. Set its catalog root to the [writing review catalog](index.yaml), which
   composes Context Engineering, Code Practice Writing, Delivery Writing, and
   Local Feature Work without copying their canonical rules.

**Prohibited:** supply only Context Engineering or load the writer's role,
authoring skills, or Markdown practices as review authority.

**Required:** supply the complete writing catalog to the shared workflow and
record every rule/file and cross-rule decision, including applicability reasons.
