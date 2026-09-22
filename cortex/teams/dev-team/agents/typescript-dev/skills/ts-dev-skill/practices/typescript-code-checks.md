# TypeScript Code Checks

## Required actions

### Establish repeatable checks

Establish mandatory formatting, type-checking, and lint gates for the consuming
project. Inspect its package manifests, lockfile, workspace layout, TypeScript
configurations, framework, and existing verification commands first. Extend the
existing project-owned check entry point when a gate is missing. Use the chosen
package manager and locally installed tools; preserve the project's formatter,
linter, framework, and compiler settings. Coordinate pipeline changes with the
CI/CD owner under the active development mode.

For a package already using npm, Prettier, TypeScript, and ESLint, this example
`package.json` fragment defines the three gates. Merge it into existing scripts;
do not replace existing tests or other verification steps.

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

Cover all applicable workspace packages and authored source, tests, tooling,
and configuration. Use project-reference-aware commands for referenced projects
and the framework's checker for component files; plain `tsc` does not check
Svelte or Vue templates. In JavaScript projects, use the existing JS/framework
checker or establish suitable `checkJs` coverage. Keep generated and vendor
files under their owning tools rather than linting them as authored source.

A transpiler or bundler build does not replace type checking. Run the project's
required build separately and require warning-free output. Make lint warnings
fail verification, using `--max-warnings 0` for ESLint or the installed linter's
equivalent. Apply framework warning-failure options where supported and inspect
output for warnings that do not affect exit status.

**Prohibited:** treat a successful bundler build as proof of type correctness,
or run ESLint with its default warning threshold and accept remaining warnings.

**Preferred:** run formatter checks, the appropriate type/component checker,
and lint with zero warnings, then run the required build and tests.

### Fix diagnostics before completion

Fix formatting violations, type errors, and all encountered lint, framework,
and build warnings, including pre-existing diagnostics. Correct their causes,
then rerun the gates after the final edit. Formatter or linter autofixes require
review and a subsequent check. Keep behavioral tests and
[unused-code enforcement](web-unused-code.md) alongside these gates.

Do not weaken compiler settings, disable rules, expand ignores, add type-check
suppression comments, hide output, or swallow failure exit codes merely to pass.
Existing narrow external-contract exceptions remain governed by their owning
practices; they do not authorize new warning bypasses. Repair dependency and
generated-code diagnostics through their owning dependency or generator. Report
out-of-scope corrections for coordinated repair; unresolved warnings still block
successful completion.

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

Report the actual commands, package/workspace roots, checked configurations,
and results. Completion requires successful formatting, type checking, linting,
and required builds with no warnings or errors. Missing tools, failed checks,
unverified required packages, and remaining diagnostics are blockers, not passes.

**Prohibited:** “TypeScript verified” after checking only the application package
while the required tooling package still has lint warnings.

**Preferred:** “Formatting and type checks passed for both packages. Application
lint passed; tooling lint reported one warning. Verification remains incomplete
until the warning is fixed and the checks pass.”
