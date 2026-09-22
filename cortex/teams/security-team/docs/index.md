# Security Knowledge Base

Security requirements shared across languages and implementation workflows
belong here. Skills provide subject-specific implementation guidance.

## Secret handling

Read [secret lifecycle](secret-lifecycle.md) for credential and secret ownership,
storage, redaction, lifetime, and cleanup requirements. These requirements apply
wherever secret material is handled, regardless of programming language.

**Prohibited:** apply secret redaction only to one language while another logs
the same credential.

**Preferred:** apply the same secret-lifecycle requirements at both boundaries,
using the relevant implementation skills for language-specific handling.
