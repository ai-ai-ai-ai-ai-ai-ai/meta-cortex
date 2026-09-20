# Prefer Popular Libraries

## Purpose

Before writing boilerplate, prefer a well-known library that already solves the
problem. Reject obscure packages that almost nobody uses.

## Problem Pattern

Agents reinvent diffs, parsers, HTTP helpers, or small utilities by hand.

Or they add a niche dependency with a handful of GitHub stars and almost no
downloads. That creates maintenance and supply-chain risk.

## Preferred Pattern

1. Before implementing non-domain boilerplate, search for a mature library.
2. Prefer packages with clear majority adoption:
   - high ecosystem download counts
   - substantial GitHub stars when a GitHub repo is available
   - active maintenance
3. Avoid libraries with very small stars or near-zero downloads unless the user
   explicitly requires that package.
4. Domain rules, cryptography, vault policy, and product invariants stay in
   project-owned domain code. Libraries help with commodity
   mechanics, not product policy.
5. Require at least 100 GitHub stars when a repository is available.

## Scope

Applies to:

- Choosing new third-party dependencies
- Deciding whether to hand-roll commodity helpers

Does not apply to:

- Project domain models, crypto, auth, vault storage, or cross-language contracts
- Generated bindings and toolchain-pinned packages

## Examples

- Before: hand-written YAML value-kind switches and recursive object diffs
- After: a mature diff library generates unified patches

## Decision checklist

- [ ] Ask whether a popular library already solves the commodity problem.
- [ ] Check stars/downloads before adding a dependency.
- [ ] Verify the popularity thresholds when adding or reviewing dependencies.
- [ ] Keep domain validation and product policy in project-owned code.

## Validation

Verify dependency download counts, repository stars, and maintenance status
against the thresholds above. Review every failed finding before acceptance.
