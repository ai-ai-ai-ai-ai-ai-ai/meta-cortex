# Development Knowledge Base

Language-independent programming requirements belong here. Language-specific
workflows and implementation guidance remain in the agents’ skills.

## Programming

For authored code, tests, scripts, build logic, and code review, read the
applicable documents:

- [Function ownership](programming/function-ownership.md): functions, constants, and state belong with their owners.
- [Domain API integrity](programming/domain-api-integrity.md): preserve domain boundaries and coherent APIs.
- [Source file size](programming/source-file-size.md): keep source files within the project’s size rules.
- [Testing and regression](programming/testing-pyramid-and-regression.md): test at the appropriate boundary and reproduce defects before fixing them.
- [Library selection](programming/prefer-popular-libraries.md): select dependencies and commodity helpers.

These documents apply across programming languages. Apply them alongside the
relevant language skill; they are not a Rust-only policy.

**Prohibited:** apply the regression procedure only to Rust while changing the
same behavior in TypeScript without it.

**Preferred:** use the programming requirements for both implementations, then
apply each language’s skill to its implementation details.
