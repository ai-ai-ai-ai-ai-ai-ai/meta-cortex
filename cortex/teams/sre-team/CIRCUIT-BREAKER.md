# Operations Circuit Breaker

Apply these subject-specific rules alongside the global circuit-breaker policy
already supplied with the assignment. Use its stop-and-recover procedure when
a rule is violated. These rules apply to the subject, including work or review
by an agent from another team.

## Rebuilding a remote runner

Send authorized task selectors to the existing runner and use its terminal
result. Do not add local selector catalogs, aliases, fallback resolution,
pre-dispatch builds, or simulations to predict whether dispatch will succeed.
Keep permission, typed-input, and write-scope checks at their owning boundary.

**Prohibited:** reject `deploy-preview` because it is absent from an invented
local catalog, then mock the runner's environment and retry behavior.

**Preferred:** dispatch `deploy-preview` and report the runner's result, including
an unknown-selector error. If assigned to change the runner's actual contract,
change and test that contract directly.

## Rebuilding the build cache

Let the build tool decide cache validity and reuse. For Docker layers, use
Docker and BuildKit. Do not implement custom layer keys, invalidation, cache
selection, or build-record pin/unpin lifecycles outside those tools.

**Prohibited:** write a controller that decides which Docker layers remain valid
and pins their build records.

**Preferred:** import BuildKit cache, run the real build, and export the updated
cache. For cache work, test cold, warm, import, and export builds; inspect their
artifacts and statistics against the project's cache-health requirements.

## Retrying an ordering defect

Order jobs with dependencies and pass immutable outputs or artifacts. After
deployment, check the required revision once and report a deterministic mismatch.
Do not hide it behind convergence retries, cache-busting counters, or timeouts.

**Prohibited:** repeatedly query deployment metadata until it happens to match
the commit expected by a job that started too early.

**Preferred:** make verification depend on deployment and pass its revision
output directly. Waiting through a tool's supported completion API is allowed;
use its bounded retries only for documented transient failures.
