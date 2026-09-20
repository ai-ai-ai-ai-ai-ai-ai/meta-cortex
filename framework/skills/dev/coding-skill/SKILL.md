---
name: coding-skill
description: Common best practices for software development and code review.
---

# Common Coding Skill

Apply these requirements to the consuming project's authored code, including
tests, scripts, build logic, and agent tooling. Use the
[project context](../../../AGENTS.md#project-context) to distinguish its code
and tooling from this library's instructions. These practices are language
independent and do not depend on agents, teams, or specialized skills.
Explicit requirements take precedence over illustrative examples.

## Required practices

Read and apply:

- [Function ownership](practices/function-ownership.md): every authored function belongs to a meaningful owner with one responsibility. A module, namespace, empty class, or utility container is not an owner.
- [Domain API integrity](practices/domain-api-integrity.md): named domain values, enum-based states, validated construction, typed failures, and at most one non-receiver parameter per authored function or method. Multiple inputs form one named request; tuples and collections must not hide independent arguments.
- [Source file size](practices/source-file-size.md): every authored source file has at most 1,000 lines. Split along architectural seams; moving tests out does not repair an oversized abstraction.
- [Testing and regression](practices/testing-pyramid-and-regression.md): author meaningful unit regressions before an executable bug fix, prove failure without the fix and success with it.

## Task-specific practices

- When selecting dependencies or implementing commodity helpers, apply [library selection](practices/prefer-popular-libraries.md).

Read each applicable document in full once per task context. Follow linked
technical practices when the changed code reaches that boundary. Do not broaden a narrow exception or turn
a requirement into a preference. Missing static tooling does not waive a rule:
review it explicitly and report validation evidence accurately.
