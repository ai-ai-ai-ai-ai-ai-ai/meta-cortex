# Evidence for Every Rust Practice

This procedure guides evidence collection for the complete Rust catalog review.
The linked YAML leaves own the decision cues; this document adds no Rust policy.
Read only those indexes for practice context. Keep Markdown source links as
citations under the skill's index-only loading rule.

## Required actions

### Gather evidence from the catalog snapshot

1. Discover practices and checks from the canonical catalog, in its order.
   Use the families below to identify committed evidence worth inspecting.
2. Read relevant surrounding code through the committed Git reads procedure.
   Trace changed declarations to their owners, constructors, callers, and tests.
   Search results locate evidence; read the code before making a decision.
3. Attach the evidence to each rule/file decision in the existing report.
   Cite the reviewed revision's paths and lines, or its exact validation result.
4. For an inapplicable rule, name the absent capability or boundary and the
   inspected evidence establishing its absence. Do not infer applicability from
   a filename extension or the project's description alone.
5. If required evidence is unavailable or a cue is ambiguous, record a blocker.
   Preserve all other decisions and findings. Ask Gizmo for the missing evidence
   or subject-owner decision without loading practice Markdown.

**Prohibited:** search for `bool`, find no matches, and declare the Rust change
compliant without inspecting the rest of the catalog or the inferred API types.

**Required:** inspect each discovered rule and its relevant committed context.
For `api_inputs:one_input`, cite method signatures and their callers; retain
separate decisions for state modeling, tests, and every other rule.

### Modeling evidence

Inspect the representation and every entry path that can construct it.
Keep each leaf's rule decisions separate, even when they share code evidence.

- **[Domain types](../../../../rust-dev/skills/rust-dev-skill/practices/modeling/domain_types/index.yaml)**
  - Evidence: value declarations, existing equivalent types, conversions,
    persisted fields, API signatures, and callers that consume their values.
- **[Domain states](../../../../rust-dev/skills/rust-dev-skill/practices/modeling/domain_states/index.yaml)**
  - Evidence: authored and inferred alternatives, dependency-result conversion,
    enum payloads, predicate consumers, absence handling, and exhaustive decisions.
- **[Struct construction](../../../../rust-dev/skills/rust-dev-skill/practices/modeling/struct_construction/index.yaml)**
  - Evidence: field visibility, literals, conversion derives, validating entry
    paths, and every path that constructs a workflow capability.
- **[Default values](../../../../rust-dev/skills/rust-dev-skill/practices/modeling/default_values/index.yaml)**
  - Evidence: default derives, selected enum variants, field semantics, and
    consumers relying on the resulting initial value.

**Prohibited:** approve `struct_construction:initial_state` because a wrapper
uses a derive, without inspecting which workflow state it constructs.

**Required:** inspect the conversion destination and capability entry paths.
Cite them separately for construction and workflow rules; report any violation
with the callers that can bypass the intended transition.

### Behavior evidence

Follow the execution path through its actual owners and external adapters.
Inspect signatures and transitions as well as function bodies.

- **[Branching and exhaustive matching](../../../../rust-dev/skills/rust-dev-skill/practices/behavior/branching/index.yaml)**
  - Evidence: decision expressions, the complete variant vocabulary, catch-all
    arms, and tests distinguishing the selected behaviors.
- **[Function ownership](../../../../rust-dev/skills/rust-dev-skill/practices/behavior/function_ownership/index.yaml)**
  - Evidence: receivers, associated functions, traits, free functions, owning
    state, dependency direction, execution nesting, and lint exceptions.
- **[API inputs](../../../../rust-dev/skills/rust-dev-skill/practices/behavior/api_inputs/index.yaml)**
  - Evidence: non-receiver parameters, request fields, call sites, command
    decoding, and the external contract behind any fixed signature.
- **[Workflow typestate](../../../../rust-dev/skills/rust-dev-skill/practices/behavior/workflow_typestate/index.yaml)**
  - Evidence: phase types, transition receivers, capability visibility,
    construction paths, runtime effect checks, and illegal-transition evidence.
- **[Owned updates](../../../../rust-dev/skills/rust-dev-skill/practices/behavior/owned_updates/index.yaml)**
  - Evidence: update receivers, returned replacements, caller assignments,
    unchanged fields, and external mutation contracts.
- **[Error handling](../../../../rust-dev/skills/rust-dev-skill/practices/behavior/error_handling/index.yaml)**
  - Evidence: concrete error types, conversions and retained causes, missing
    input paths, panic calls, test propagation, and error dependencies.

**Prohibited:** approve `owned_updates:consume_replacement` after reading only
the consuming signature, without checking how callers use the returned value.

**Required:** inspect the update and its call sites at the assigned SHA.
Attach evidence for both consumption and replacement use, and evaluate error
paths and transition rules independently where they intersect.

### Boundary evidence

Trace both sides of each affected boundary, including non-Rust consumers.
Missing generated declarations or consumer code are evidence gaps when needed
to decide an applicable rule; they do not justify a pass.

- **[Serialization boundaries](../../../../rust-dev/skills/rust-dev-skill/practices/boundaries/serialization_boundaries/index.yaml)**
  - Evidence: decoding destinations, serialization declarations, validation
    conversions, internal storage types, generated ABI, and round-trip tests.
- **[Rust–TypeScript separation](../../../../rust-dev/skills/rust-dev-skill/practices/boundaries/code_separation/index.yaml)**
  - Evidence: policy owners, browser observations, bridge adapters, generated
    contracts, presentation state, and affected consumer tests.
- **[WASM contracts](../../../../rust-dev/skills/rust-dev-skill/practices/boundaries/wasm_contracts/index.yaml)**
  - Evidence: generated declarations and construction APIs, identifier types,
    allocation owners, transfer paths, replacements, and cleanup.
- **[WASM UI integration](../../../../rust-dev/skills/rust-dev-skill/practices/boundaries/wasm_ui_integration/index.yaml)**
  - Evidence: reactive callers, DTO submission, generated instance identity,
    framework-specific adaptation, and component lifecycle paths.
- **[WASM and command name coherence](../../../../rust-dev/skills/rust-dev-skill/practices/boundaries/wasm_name_coherence/index.yaml)**
  - Evidence: exported symbols, generated imports, serialization attributes,
    command groups, dispatch, external protocol names, and migration authority.

**Prohibited:** mark all boundary rules inapplicable because the changed file
is Rust, even though it changes an exported contract used by a browser caller.

**Required:** inspect the generated declaration and that caller at the reviewed
revision. Evaluate representation, naming, reactivity, and allocation ownership
under their separate rules. Block a decision that needs unavailable bindings.

### Tooling evidence

Inspect project-wide configuration and validation alongside source changes.
Passing compilation alone cannot decide these practices.

- **[Rust code checks](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/code_checks/index.yaml)**
  - Evidence: workspace lint configuration, target scope, documented gates,
    diagnostics, and required command results tied to the reviewed SHA.
- **[Libraries](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/libraries/index.yaml)**
  - Evidence: manifests, enabled features, actual library usage, implemented
    capabilities, and any custom replacement for an existing library operation.
- **[Module layout](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/module_layout/index.yaml)**
  - Evidence: module declarations, old and new paths, imports, relative embedded
    assets, public references, and resolution evidence after moves.
- **[Paths and imports](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/path_imports/index.yaml)**
  - Evidence: imports and non-import paths across root forms, function call
    qualification, and the semantic context retained by the imports.
- **[Typed SQL construction](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/typed_sql/index.yaml)**
  - Evidence: query construction, identifier declarations, bound values,
    driver adapters, and callers supplying dynamic data.
- **[Dependency selection](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/dependency_selection/index.yaml)**
  - Evidence: dependency additions, lockfile changes, adoption verification,
    and documented exclusions supplied with the assignment.
- **[Macro minimization](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/macro_minimization/index.yaml)**
  - Evidence: authored macro definitions and uses, ecosystem derives,
    destination-owned mappings, and behavior preserved by macro replacements.
- **[Rust testing](../../../../rust-dev/skills/rust-dev-skill/practices/tooling/testing/index.yaml)**
  - Evidence: production owners and inline tests, domain and boundary assertions,
    regression evidence, coverage scope, exclusions, and measured results.

**Prohibited:** approve `testing:coverage` using a green test log with no
measured coverage, or approve dependency selection from a manifest alone.

**Required:** request the missing coverage or adoption evidence through Gizmo.
Keep these decisions blocked while preserving established source findings and
the outcomes of checks whose evidence is available.

### Cross-rule evidence

1. Load every leaf under the [cross-rule catalog](../../../../rust-dev/skills/rust-dev-skill/checks/index.yaml).
   Keep its comparison cues and referenced rule IDs in the catalog snapshot.
2. Inspect the joined path across the compared rules. For example, follow
   external input through conversion into retained state, or trace a generated
   object from reactive submission through replacement and final cleanup.
3. Record one change-wide decision for each check in addition to the rule/file
   decisions. Cite the relevant evidence on both sides of the comparison.

**Prohibited:** approve the UI-ownership check because DTO submission works,
without inspecting replacement or cleanup of retained WASM objects.

**Required:** trace submission, retained ownership, replacement, and teardown.
Record the check's own outcome and related rule decisions with their evidence.

## Prohibited actions

- Do not use this evidence reference as a fixed catalog or a second rule source.
- Do not omit a newly discovered practice because it lacks an entry here.
- Do not replace individual decisions with one outcome per family.
- Do not fabricate missing validation or resolve ambiguous cues from memory.

**Prohibited:** the catalog gains a practice, but the verifier skips it because
this reference does not mention it.

**Required:** inventory its rules and collect evidence from their loaded cues.
Report a reference-maintenance need separately; block only decisions whose
required evidence or meaning cannot be resolved.
