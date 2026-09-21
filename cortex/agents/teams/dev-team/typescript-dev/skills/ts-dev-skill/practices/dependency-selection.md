# TypeScript Dependency Selection

## Adoption thresholds

Before adding or reviewing an npm dependency, inspect the owning manifest and
verify its current adoption:

- At least **10,000 weekly npm downloads**.
- At least **100 GitHub stars**, when a repository is available.

Keep the common exclusions for generated bindings and toolchain-pinned packages.
A prescribed library choice and a popularity check are separate decisions.

**Prohibited:** “This package is popular; add it,” without checking the counts.

**Preferred:** record the package, source URLs, check date, weekly downloads,
repository stars, and the resulting decision. If an exclusion applies, name the
exact generated or pinned dependency contract rather than waiving the threshold.

## Validation

Verify the source counts and manifest entry. Do not treat old review counts as
current evidence or introduce runtime code to enforce dependency popularity.
