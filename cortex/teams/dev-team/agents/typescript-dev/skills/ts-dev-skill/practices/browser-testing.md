# Browser Testing

The project's browser test tooling verifies observable browser integration.
The examples use Playwright. Test portable algorithms and product decisions
directly in their domain owner: Rust for Rust/WASM projects, or TypeScript when
it owns that domain. Browser tests must not reimplement those algorithms.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Test the boundary that can fail

Cover critical user flows and browser-only ordering, persistence, visibility,
clipboard/download, multi-tab, extension, and origin behavior. Do not claim a
rendered label proves domain calculations.

**Prohibited:**

```ts
// A UI label is used as the only proof of a domain calculation:
await expect(page.getByText("Total correct")).toBeVisible();
```

**Preferred:**

```ts
// In the existing browser scenario, after the domain calculation tests:
await page.getByRole("button", saveButton).click();
await expect(page.getByRole("status")).toHaveText(savedMessage);
```

## Repair from evidence, with a regression first

Read job output, app logs, error context, and trace before editing. Identify the
first failed boundary, choose the smallest existing test owner, and follow the
common regression-before-fix procedure. Mocks must honor production transport
contracts. Keep browser acceptance alongside the unit regression.

**Prohibited:**

```ts
// A mock succeeds with a value the production port cannot return:
port.save = () => Promise.resolve(receipt);
```

**Preferred:**

```ts
// Production port returns an Effect with a typed success/failure contract:
port.save = () => Effect.succeed(receipt);
```

## Do not weaken the failing scenario

Fix the owning defect, not the evidence. Do not increase timeouts, skip the
scenario, weaken assertions, or invent a test framework when one already fits.
For every subsequent repair, inspect the new failure evidence first.

**Prohibited:**

```ts
test.skip("saved state survives reload", scenario);
```

**Preferred:**

```ts
test("saved state survives reload", scenario);
```

## Validation

- In partitioned suites, place every non-demo behavior spec exactly once in the executable gate manifest.
- Default testDir discovery needs no duplicate manifest; every behavior spec still needs an executable gate.
- Record affected user-flow results and meaningful contract/branch evidence, not test count.
- Browser-only defects retain browser regressions and the closest deterministic unit contract.
