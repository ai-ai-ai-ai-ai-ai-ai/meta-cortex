# Source File Size and Architectural Decomposition

This is a hard, non-bypassable quality gate. A violation is P1 and blocks
acceptance until the file is brought within the limit through a cohesive change.

Keep authored source modules small enough to preserve clear ownership,
dependency direction, reviewability, and behavior-focused testing. Crossing the
threshold proves a gate violation; review still determines the cohesive domain
or architectural seam needed to correct it.

## Architectural warning signs

An oversized file commonly combines multiple domains, capabilities, lifecycle
phases, adapters, storage concerns, or orchestration layers. Warning signs
include:

- unrelated structs and implementations changing for different reasons;
- a service that owns policy, persistence, transport, mapping, and retries;
- a UI module that combines state, orchestration, rendering, and provider
  adapters;
- broad action contexts that expose an entire store or manager;
- attempts to comply by moving tests while retaining the same oversized abstraction;
- arbitrary half-splits or names such as `part1`, `part2`, or `continued`.

Moving tests alone can lower the line count while leaving the production
architecture untouched.

## Scope

Applies to all authored source code in the repository, including production
code, tests, scripts, build logic, and agent/CI tooling.

Excluded from counting:

- generated source and checked-in generated bindings;
- vendored third-party dependencies;
- build outputs, caches, coverage artifacts, and package-manager directories;
- non-source fixture data and documentation.

An exclusion must describe data provenance, not excuse authored source.

## Required actions

### Size limit

- Every authored source file: at most **1,000 lines**.

A file above 1,000 lines must be decomposed along a cohesive domain or
architectural seam. Line count alone does not diagnose the responsibility
that needs to change; test code does not justify an oversized abstraction.

### Decomposition

Before editing, identify why the file changes and who owns each responsibility.
Split production code along one or more real seams:

- domain or aggregate;
- capability or use case;
- policy versus mechanism;
- lifecycle phase;
- storage, transport, mapping, or orchestration boundary;
- platform-independent domain versus platform adapter;
- public facade versus internal implementation.

- Keep each extracted module cohesive and give it a meaningful domain name.
- Depend through the narrowest practical interface.
- Preserve dependency direction.
- Prefer capability interfaces over passing a whole state container.
- Keep tests with the architectural owner of the behavior they verify.

### Decomposition procedure

1. Inventory the file's production responsibilities and change reasons.
2. Name the architectural or domain seams before moving code.
3. Refactor production code into cohesive modules with narrow interfaces.
4. Confirm no extracted module is an arbitrary numbered fragment.
5. Preserve or add behavior-focused unit and integration tests at their
   correct boundaries.
6. Record source-size checks and review the decomposition.

### Static enforcement

A repository-wide source-size check must fail when any authored source file
crosses the uniform 1,000-line limit. Its failure message directs the agent to architectural
decomposition and explicitly rejects test-file and arbitrary splits.

Static line counting proves only that the hard quality gate passed or failed.
It cannot prove cohesion, identify the defective responsibility, or establish
dependency direction. Contract tests keep the limit wired into repository checks and
scanner diagnostics; code review verifies the actual decomposition seam.

## Prohibited actions

- Do not use authored-code allowlists, baselines, grandfathered violations, or changed-file-only exceptions.
- Do not use test extraction or arbitrary numbered splits to conceal an oversized abstraction.
- Do not use exclusions to excuse authored source.
- Do not make every extracted module depend on the original god object.

## Examples

- Rejected: move tests out while leaving the multi-responsibility service unchanged.
- Rejected: split a module into arbitrary numbered fragments.
- Accepted: extract provider query mapping, retry policy, and persistence into cohesive modules with narrow interfaces.
- Accepted: split a browser flow into lifecycle, enrollment, session, and transport capabilities while preserving a small facade.

## Validation

1. Check every authored source file against the 1,000-line limit.
2. Use the project's source-size checks to verify the limit and diagnostics.
3. Review cohesion, ownership, and dependency direction in each decomposition.
   Line counting alone cannot establish these properties.
