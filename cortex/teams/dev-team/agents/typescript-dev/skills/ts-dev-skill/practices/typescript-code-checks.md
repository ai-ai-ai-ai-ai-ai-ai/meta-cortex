# TypeScript Code Checks

## Required actions

### Establish repeatable checks

- Establish mandatory formatting, type-checking, and lint gates for the consuming project.
- Inspect the project's package manifests, lockfile, workspace layout, TypeScript
  configurations, framework, and verification commands first.
- Extend the existing project-owned check entry point when a gate is missing.
- Use the chosen package manager and locally installed tools.
- Preserve the project's formatter, linter, framework, and compiler settings.
- Apply the [branching checks](#check-branching) to authored TypeScript and
  JavaScript. Consult the [upstream Effect guidance](../SKILL.md#effect-use-installed-documentation)
  for Effect code; do not add a separate operator allowlist to the lint gate.
- Coordinate pipeline changes with the CI/CD owner under the active development mode.
- Enforce `max-depth: ["error", 2]` and `max-nested-callbacks` with
  `{ max: 2, checkConstructorCallCallbacks: true }` in adopted packages. Verify
  the installed ESLint version supports the constructor option. These are
  separate structural checks; review mixed callback/branch depth under the
  [TypeScript scope rules](typescript-function-ownership.md#count-execution-scopes).
  Confirm the previously nested form fails and the flattened form passes.

This `package.json` fragment assumes the package already uses npm, Prettier,
TypeScript, and ESLint.

- Merge these gates into the existing scripts.
- Preserve existing tests and other verification steps.

```json
{
  "scripts": {
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint . --max-warnings 0",
    "verify": "npm run format:check && npm run typecheck && npm run lint"
  }
}
```

- Cover all applicable workspace packages.
- Include authored source, tests, tooling, and configuration.
- Use project-reference-aware commands for referenced projects.
- Use the framework's checker for component files.
  - Plain `tsc` does not check Svelte or Vue templates.
- Use the existing JS/framework checker in JavaScript projects.
  - Establish suitable `checkJs` coverage when no checker exists.
- Keep generated and vendor files under their owning tools.
  - Do not lint them as authored source.
- Run type checking even when a transpiler or bundler build succeeds.
- Run the project's required build separately.
- Require warning-free build output.
- Make lint warnings fail verification.
  - Use `--max-warnings 0` for ESLint or the installed linter's equivalent.
- Apply framework warning-failure options where supported.
- Inspect output for warnings that do not affect exit status.

**Prohibited:** treat a successful bundler build as proof of type correctness,
or run ESLint with its default warning threshold and accept remaining warnings.

**Preferred:** run formatter checks, the appropriate type/component checker,
and lint with zero warnings, then run the required build and tests.

### Check branching

- Reject `IfStatement` and `ConditionalExpression` through the existing lint gate.
  Include pure code, adapters, tests, and tooling; Effect is not a scope boundary.
- Require `@typescript-eslint/switch-exhaustiveness-check` with
  `allowDefaultCaseForExhaustiveSwitch: false` and
  `considerDefaultExhaustiveForUnions: false`.
- Require fallthrough checking alongside exhaustiveness checking.
- Verify that a missing enum case fails lint, even when a `default` is present.
  TypeScript compilation alone does not prove every switch is exhaustive.

**Prohibited:** accept a switch because its `default` hides a newly added variant.

**Preferred:** apply these rules in the existing ESLint configuration. This is
its `rules` fragment; it assumes type-aware typescript-eslint is already configured.

```json
{
  "no-restricted-syntax": ["error", "IfStatement", "ConditionalExpression"],
  "no-fallthrough": "error",
  "@typescript-eslint/switch-exhaustiveness-check": ["error", {
    "allowDefaultCaseForExhaustiveSwitch": false,
    "considerDefaultExhaustiveForUnions": false
  }]
}
```

Merge the selectors with existing restrictions. Use the
[domain-switch examples](typescript-explicit-state.md#match-decisions-exhaustively)
to review the resulting code; the lint gate supplies enforcement.

### Fix diagnostics before completion

- Fix formatting violations and type errors.
- Fix all encountered lint, framework, and build warnings.
  - Include pre-existing diagnostics.
- Correct each diagnostic's cause.
- Rerun the gates after the final edit.
- Review formatter and linter autofixes.
  - Run the checks again afterward.
- Keep behavioral tests alongside these gates.
- Apply [unused-code enforcement](web-unused-code.md) alongside these gates.
- Do not weaken checks merely to pass.
  - Do not weaken compiler settings, disable rules, or expand ignores.
  - Do not add type-check suppression comments for that purpose.
  - Do not hide output or swallow failure exit codes.
- Apply existing narrow external-contract exceptions only as their owning practices permit.
  - These exceptions do not authorize new warning bypasses.
- Repair dependency diagnostics through the owning dependency.
- Repair generated-code diagnostics through the owning generator.
- Report out-of-scope corrections for coordinated repair.
- Do not report successful completion while warnings remain unresolved.

```sh
# Prohibited: hide warnings and turn lint failure into success.
eslint . --quiet || true
```

```sh
# Preferred: after fixing the diagnosed code, preserve the zero-warning gate.
eslint . --max-warnings 0
```

**Prohibited:** add `@ts-ignore` for an incompatible argument or disable the
unused-variable rule for an abandoned local value.

**Preferred:** correct the argument's contract or remove the unused value,
then rerun formatting, type checking, lint, and the required build/tests.

### Report verification evidence

- Report the commands actually run.
- Identify the package/workspace roots and configurations checked.
- Report the results actually verified.
- Require formatting, type checking, linting, and required builds to pass before completion.
  - Require no warnings or errors.
- Report missing tools and failed checks as blockers.
- Report unverified required packages and remaining diagnostics as blockers.

**Prohibited:** “TypeScript verified” after checking only the application package
while the required tooling package still has lint warnings.

**Preferred:** “Formatting and type checks passed for both packages. Application
lint passed; tooling lint reported one warning. Verification remains incomplete
until the warning is fixed and the checks pass.”
