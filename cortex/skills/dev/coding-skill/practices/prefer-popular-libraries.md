# Prefer Popular Libraries

Prefer a well-known library for commodity mechanics before writing boilerplate.
Keep domain validation and product policy in project-owned code.

## Scope

Apply this practice when choosing third-party dependencies or deciding whether
to implement commodity helpers, such as diffs, parsers, or HTTP utilities.

The library-selection requirement does not apply to:

- Project domain models, cryptography, authentication, vault storage, or cross-language contracts.
- Generated bindings and toolchain-pinned packages.

## Required actions

1. Search for a mature library before implementing non-domain boilerplate.
2. Check adoption and maintenance before adding or reviewing a dependency.
   - Prefer clear majority adoption, high ecosystem download counts, and active maintenance.
   - Require at least 100 GitHub stars when a GitHub repository is available.
3. Keep domain rules, cryptography, vault policy, and product invariants in
   project-owned domain code.
4. Review every failed dependency-selection finding before acceptance.

For example, use a mature diff library to generate unified patches instead of
writing YAML value-kind switches and recursive object diffs by hand.

## Prohibited actions

- Do not select obscure packages with very few stars or near-zero downloads
  unless the user explicitly requires that package.
- Do not delegate product policy to a library chosen for commodity mechanics.

## Validation

- Verify current download counts, repository stars, and maintenance status.
- Check the selected dependency against the adoption requirements above.
- Confirm that domain validation and product policy remain project-owned.
