---
name: rust-verification
description: Review committed Rust work using the shared verifier workflow and the canonical Rust YAML catalogs. Read-only; reports all issues to Team Gizmo.
---

# Rust Verification

Select the Rust catalog for the shared verification workflow. The shared
skill owns review instructions; this skill supplies the subject context.

## Required actions

1. Load and apply the shared
   [agent verification skill](../../../../../gizmo-team/agents/gizmo/skills/agent-verification/SKILL.md).
2. Set its catalog root to the
   [canonical Rust catalog](../../../rust-dev/skills/rust-dev-skill/index.yaml).

**Prohibited:** supply only the modeling indexes as the Rust review scope.

**Required:** supply the canonical root, including its practices and cross-rule
checks, to the shared workflow.
