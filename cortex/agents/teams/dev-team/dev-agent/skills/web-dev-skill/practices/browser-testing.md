# Browser Testing

## Browser integration

- **Playwright tests own observable browser integration:**
   - Cover critical user flows such as unlock, save, local provider sync,
     recovery, import, secret disclosure, and conflict UI.
   - Cover browser-only sequencing, persistence, visibility, clipboard,
     download, multi-tab, extension, and origin behavior.
   - Do not use browser tests to prove mathematical or algorithmic correctness
     that portable Rust can establish directly.

## Suite coverage

When a Playwright suite partitions specifications across projects, require
   every non-demo behavior specification to appear exactly once in the shared
   executable gate manifest. Suites that rely on default `testDir` discovery
   do not need a redundant manifest.

### Unit-first browser failure loop

Use this procedure for a failing web or extension e2e scenario.

**Required actions**

1. Read the saved job output, app logs, error context, and Playwright trace.
   Identify the first failing behavior and its owning boundary before changing
   code.
2. Select the smallest applicable existing regression framework.
   Use the framework that exercises the failing ownership boundary.
3. Apply the mandatory regression procedure in the common testing practices before fixing the defect.
   - Exercise actual transport contracts such as typed `Result` values.
   - Do not use permissive mocks that return a shape production cannot return.
4. Make the smallest owning correction and retain the authored regressions.
5. Keep the browser assertion for browser validation.
   - For a browser-only defect, cover the closest deterministic unit contract
     and retain the browser-level regression.
   - Unit evidence narrows the repair loop. It does not replace e2e acceptance.
   - Diagnose returned failing-job evidence before the next repair.
   - Author the applicable unit regressions before changing that repair's code.

**Prohibited actions**

- Do not weaken assertions, increase timeouts, or skip a failing scenario as
  the fix.
- Do not create a new test framework when an existing owner can express the
  behavior.
- Do not measure coverage quality by test count alone. Require meaningful
  contract and branch evidence.


Record applicable browser regression results for changed user flows.
Every non-demo behavior specification must belong to an executable gate.
