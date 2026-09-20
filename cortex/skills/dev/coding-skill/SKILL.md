---
name: coding-skill
description: Common best practices for software development and code review.
---

# Common Coding Skill

Apply these language-independent practices to the consuming project's authored code.

- Include tests, scripts, build logic, and agent tooling.
- Keep these practices independent of agents, teams, and specialized skills.
- Follow explicit requirements when illustrative examples differ.

## Required actions

1. Read each applicable practice in full once per task context:
   - [Function ownership](practices/function-ownership.md).
   - [Domain API integrity](practices/domain-api-integrity.md).
   - [Source file size](practices/source-file-size.md).
   - [Testing and regression](practices/testing-pyramid-and-regression.md).
2. Apply [library selection](practices/prefer-popular-libraries.md) when selecting
   dependencies or implementing commodity helpers.
3. Follow linked technical practices when the changed code reaches that boundary.
4. Review compliance explicitly when static tooling is unavailable.
5. Report validation evidence accurately.

## Prohibited actions

- Do not broaden a narrow exception or turn a requirement into a preference.
- Do not treat missing static tooling as a waiver.
