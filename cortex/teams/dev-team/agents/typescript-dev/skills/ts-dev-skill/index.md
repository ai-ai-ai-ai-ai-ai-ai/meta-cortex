# TypeScript Knowledge Graph

This is the skill's rule-level catalog. Namespaced rule names identify individual decisions,
including exceptions and checks. Each rule has one canonical source; the source
practice supplies the full rationale and examples. The catalog is a synchronized
index, not an independent policy override.
Read the whole catalog before adding, moving, or changing a rule, then read its
owner and the related practices affected by the change. Extend an existing owner
unless the rule introduces a distinct subject. Update this catalog when ownership
or paths change. Update affected rule summaries in the same edit as their source.
Do not duplicate this catalog in the skill entry point.

Use readable `practice:decision` names. Keep names stable when wording changes;
update all references when a decision is renamed or moved. Each rule name links
to the exact source section, not merely the document. Rule summaries include scope and exceptions so a
reader can detect contradictions without opening every file.

Related entries are review relationships, not instructions for leaf documents to
link back here. Apply the relevant cross-language practices when the assignment crosses that boundary.

For implementation, apply the core practices. Load Domain structure and Explicit
state together. Load the upstream Effect guidance before effectful work, including
Serial operation queues. Select task-specific and supporting practices when their
subjects are involved; Svelte practices apply only to Svelte projects. Preserve
the project’s stack and command runner. Rust ownership applies when the project
uses Rust/WASM; TypeScript may own domains otherwise. Read selected practices in
full, including exceptions and
validation. Existing code does not weaken their requirements.

## Core practices

### Branching and exhaustive matching

- **File:** [Branching and exhaustive matching](../../../../docs/programming/branching-and-exhaustive-matching.md).
- **Owns:** Language-independent branching policy and exhaustive domain decisions.
- **Does not own:** Language syntax, examples, and enforcement belong to the language practices.
- **Related:** [Explicit state](practices/typescript-explicit-state.md), [Enums instead of booleans](practices/typescript-enums-over-booleans.md), [Code checks](practices/typescript-code-checks.md).

- **[branching:no_boolean_if](../../../../docs/programming/branching-and-exhaustive-matching.md#use-patterns-instead-of-boolean-if-conditions)**

  - Match named domain alternatives directly; prohibit ordinary boolean conditions
    throughout authored code, including guards, validation, tests, and tooling.
  - Convert required raw inputs and dependency predicates at their boundary;
    name boolean outcomes before choosing workflow actions.
  - Keep conversions on existing owners without decorative branching abstractions.
  - Prefer native patterns; use library matchers only when native constructs cannot
    clearly express the pattern. Preserve exhaustiveness during migration.

- **[branching:no_ternary](../../../../docs/programming/branching-and-exhaustive-matching.md#do-not-use-ternary-conditionals)**

  - Prohibit ternary conditional operators where available; use explicit patterns.

- **[branching:closed_matches](../../../../docs/programming/branching-and-exhaustive-matching.md#close-every-domain-match)**

  - Name every variant in closed domain decisions and reject fallbacks that
    silently absorb future variants; check exhaustiveness statically.
  - Group named alternatives only when they share behavior.
  - Distinguish full decisions from focused payload extraction and open-input matching.

- **[branching:validation](../../../../docs/programming/branching-and-exhaustive-matching.md#validation)**

  - Verify that adding a variant fails incomplete decisions under required static checks.
  - Review focused patterns, unmatched handling, and boundary conversions.
  - Test variants separately when outcomes or payloads differ.

### Function ownership

- **File:** [Function ownership](practices/typescript-function-ownership.md).
- **Owns:** Owners of functions, constants, and state; static construction and component handlers.
- **Does not own:** Parameter count belongs to Single parameter; nominal values belong to Domain structure.
- **Related:** [Single parameter](practices/typescript-single-parameter.md), [Domain structure](practices/typescript-domain-structure.md).

- **[function_ownership:instances](practices/typescript-function-ownership.md#use-instances-for-owned-behavior)**

  - Put behavior on meaningful concrete owners or typed enum companions.
  - Static methods are only narrow construction builders, while
    execution/validation/formatting/dispatch belong to instances.

- **[function_ownership:nesting](../../../../docs/programming/function-ownership.md#limit-nesting-and-abstraction)**

  - Limit combined callback and control-flow nesting to two execution scopes.
  - Flatten first; reject helper chains and new abstractions added only to meet
    the depth limit.

- **[function_ownership:meaningful_state](practices/typescript-function-ownership.md#use-instances-for-owned-behavior)**

  - Give instances the state/request/capability they own.
  - Reject empty containers, renamed execution-builders, and primitive/enum prototype
    mutation.

- **[function_ownership:constants](practices/typescript-function-ownership.md#own-constants-and-mutable-state)**

  - Put constants on their owner as static readonly and mutable state on instances.
  - Prohibit free functions, module const/let/var, function-valued global constants, and
    mutable statics.
  - Test-runner callbacks may contain scenario steps and assertions; put reusable
    test helpers on fixture or scenario owners.

- **[function_ownership:component_scope](practices/typescript-function-ownership.md#keep-component-ownership-local)**

  - Keep parameters and locals inside owned methods.
  - Component handlers/lifecycle callbacks and local state belong to the component only
    when tied to its interaction/state, not module-script globals.

- **[function_ownership:shared_behavior](practices/typescript-function-ownership.md#keep-component-ownership-local)**

  - Move shared component behavior to its meaningful domain/application owner.


### Single parameter

- **File:** [Single parameter](practices/typescript-single-parameter.md).
- **Owns:** Argument count, semantic request aggregation, and fixed-signature exceptions.
- **Does not own:** Object argument declarations belong to Named arguments; placement belongs to Function ownership.
- **Related:** [Named arguments](practices/typescript-named-args.md), [Function ownership](practices/typescript-function-ownership.md).

- **[single_parameter:one_parameter](practices/typescript-single-parameter.md#collect-independent-inputs-in-one-request)**

  - Limit every authored function, method, constructor, and arrow to zero or one
    parameter, including tooling and Svelte.
  - Generated bindings are excluded.

- **[single_parameter:semantic_request](practices/typescript-single-parameter.md#collect-independent-inputs-in-one-request)**

  - Use one named semantic request for multiple inputs.
  - Reject generic Args/CallbackArgs/PutArgs/line-derived names.

- **[single_parameter:named_shapes](practices/typescript-single-parameter.md#name-object-shaped-parameters)**

  - Object-shaped parameters, including arrays/tuples/maps/sets/records/mapped types,
    require named contracts.
  - Reject inline object/array/tuple annotations even in helpers and destructuring.

- **[single_parameter:explicit_omission](practices/typescript-single-parameter.md#do-not-disguise-additional-inputs)**

  - Do not fake multiple inputs with optional undefined parameters.
  - Model omissions explicitly.
  - Defaults belong at the call site or body, not in another positional argument.

- **[single_parameter:callback_returns](practices/typescript-single-parameter.md#name-object-shaped-parameters)**

  - An object return type inside a function-valued parameter may be inline.
  - That does not exempt the callback own input contract.

- **[single_parameter:host_signatures](practices/typescript-single-parameter.md#keep-fixed-host-signatures-at-the-edge)**

  - Retain multi-input host callbacks only at the required external edge, with a focused
    documented suppression.
  - Never exempt project-authored APIs.

- **[single_parameter:validation](practices/typescript-single-parameter.md#validation)**

  - Enforce `max-params: [error, 1]` plus semantic request review and verify every host
    exception.


### Named arguments

- **File:** [Named arguments](practices/typescript-named-args.md).
- **Owns:** Named object parameter types and explicitly typed call arguments, including compiler-rune exceptions.
- **Does not own:** Argument count belongs to Single parameter; domain value identity belongs to Domain structure.
- **Related:** [Single parameter](practices/typescript-single-parameter.md), [Domain structure](practices/typescript-domain-structure.md), [Svelte state modeling](practices/svelte-state-modeling.md).

- **[named_args:named_contracts](practices/typescript-named-args.md#name-the-parameter-contract)**

  - Every object-shaped parameter uses a semantic named type/interface/generated
    contract, including mapped types, arrays, tuples, sets, maps, and records.
  - Apply to authored source, tests, configuration, and tooling; generated
    declarations are excluded.

- **[named_args:typed_bindings](practices/typescript-named-args.md#name-and-type-object-arguments)**

  - Every object call argument is a named explicitly typed value.
  - Reject inline literals, generic operation-only names, and generated-name/import
    tricks.

- **[named_args:literal_locations](practices/typescript-named-args.md#name-and-type-object-arguments)**

  - Allow object literals when constructing that named value or returning from a
    function/build callback.
  - Callback object returns do not exempt input contracts.

- **[named_args:no_bypasses](practices/typescript-named-args.md#name-and-type-object-arguments)**

  - Do not bypass named arguments with assertions,
    conditional/assignment/logical/sequence expressions, or statically resolvable spread
    values.

- **[named_args:rune_exceptions](practices/typescript-named-args.md#limit-rune-exceptions-to-the-compiler-forms)**

  - Direct object arguments to $state, $state.raw, $derived, and $bindable are
    compiler-rune exceptions.
  - $state.snapshot and ordinary calls are not.

- **[named_args:no_object_defaults](practices/typescript-named-args.md#keep-object-defaults-out-of-parameters)**

  - Reject object-valued parameter defaults of every shape, including bindings/factory
    results/class instances.
  - Apply defaults at the caller or body.

- **[named_args:validation](practices/typescript-named-args.md#validation)**

  - Checks must recursively inspect wrapped/qualified references, inline arrays/tuples
    and imported generic names.
  - Prefer callee-exported or generated domain request types and keep lint checks
    passing.


### Domain structure

- **File:** [Domain structure](practices/typescript-domain-structure.md).
- **Owns:** Nominal values, named domain contracts, and application API structure.
- **Does not own:** Detailed ownership belongs to Function ownership; absence representation belongs to Explicit state.
- **Related:** [Function ownership](practices/typescript-function-ownership.md), [Explicit state](practices/typescript-explicit-state.md), [Concrete values](practices/typescript-no-unknown.md).

- **[domain_structure:named_values](practices/typescript-domain-structure.md#preserve-value-identity)**

  - Give every
    domain/application/workflow/lifecycle/policy/mode/command/configuration/persistence/owned-contract
    value a meaningful named type.

- **[domain_structure:vocabulary_ownership](practices/typescript-domain-structure.md#preserve-value-identity)**

  - In Rust/WASM projects, consume generated portable product/security vocabulary
    and keep browser/lifecycle/presentation enums in TypeScript.
  - TypeScript may own domain vocabulary in other projects; do not mirror Rust-owned contracts.

- **[domain_structure:nominal_identity](practices/typescript-domain-structure.md#preserve-value-identity)**

  - Use nominal branded/opaque scalar types and named aggregates/unions.
  - Primitive aliases, raw primitives, and inline nested unions do not preserve
    identity.

- **[domain_structure:preserve_types](practices/typescript-domain-structure.md#preserve-value-identity)**

  - Preserve domain types recursively in public/private parameters, returns, fields,
    locals, constants, containers, state, and tests.
  - Do not unwrap just to pass between layers.

- **[domain_structure:trusted_construction](practices/typescript-domain-structure.md#construct-trusted-values-at-the-boundary)**

  - Construct opaque values through validating owners with private brands/unchecked
    construction.
  - Prohibit application casts that fabricate brands or writable validation bypasses.

- **[domain_structure:external_conversion](practices/typescript-domain-structure.md#construct-trusted-values-at-the-boundary)**

  - Normalize external data immediately.
  - Keep primitives only inside their value types or required edges, including typed
    user content and locale keys.

- **[domain_structure:typed_failures](practices/typescript-domain-structure.md#keep-failures-and-secrets-with-their-owners)**

  - Use Effect Schema and typed error channels for effectful decoding.
  - Tag actionable failures, preserve concrete sources, and catch only where
    meaning/recovery/presentation is added.

- **[domain_structure:behavior_ownership](practices/typescript-domain-structure.md#keep-capabilities-behind-their-transitions)**

  - Apply meaningful function ownership and narrow static builders.
  - Reject module/namespace/Utils ownership, empty containers, and renamed static
    execution.

- **[domain_structure:legal_transitions](practices/typescript-domain-structure.md#keep-capabilities-behind-their-transitions)**

  - Model named state transitions with private advanced construction and
    state-appropriate operations.
  - Do not mutate parallel flags or invent lifecycles for pure behavior.

- **[domain_structure:typed_yaml](practices/typescript-domain-structure.md#serialize-yaml-from-typed-values)**

  - Prohibit building YAML from literals, templates, concatenation, fragments,
    indentation, or replacement, including catalogs, recovery, and valid fixtures.
  - Construct canonical typed records and serialize at I/O; branding, assertions,
    and subsequent parsing cannot repair string-based construction.
  - Keep raw input only at external decoders and deliberate malformed/unsupported
    test cases; handwritten YAML files and documentation are not builders.
  - Review producers and test escaping/round trips separately from compiler checks.

- **[domain_structure:versioned_schemas](practices/typescript-domain-structure.md#version-owned-persisted-formats)**

  - Give TypeScript-owned persisted/wire schemas a named version, current writer,
    supported-reader set, unsupported-version failure, and explicit migration.

- **[domain_structure:secrets](practices/typescript-domain-structure.md#keep-failures-and-secrets-with-their-owners)**

  - Follow supplied secret lifecycle rules.
  - Do not persist/log plaintext or retain temporary secret state beyond its
    interaction.

- **[domain_structure:nested_vocabulary](practices/typescript-domain-structure.md#nest-vocabulary-that-shares-an-owner)**

  - Nest same-prefix concepts under an owning object/operation vocabulary and keep YAML
    nesting aligned with TypeScript shapes.

- **[domain_structure:field_vocabulary](practices/typescript-domain-structure.md#nest-vocabulary-that-shares-an-owner)**

  - Closed field allow-lists use enum vocabulary through one named typed request.
  - Reject string sets and Record<string, string> substitutes.

- **[domain_structure:failure_codes](practices/typescript-domain-structure.md#keep-failures-and-secrets-with-their-owners)**

  - Use enum failure codes.
  - Freeform detail text is only boundary context, not the failure discriminant.
  - Reject thrown strings or generic Error as actionable domain contracts.

- **[domain_structure:no_result_utilities](practices/typescript-domain-structure.md#keep-failures-and-secrets-with-their-owners)**

  - Do not add Result/Maybe utilities, neverthrow, or handwritten Promise failure
    workflows.
  - Use Effect for effectful commands and concrete E with code/context.

- **[domain_structure:codec_outcomes](practices/typescript-domain-structure.md#keep-failures-and-secrets-with-their-owners)**

  - Codec-local decode outcomes may accumulate field issues but cannot become
    repository-wide Result utilities.
  - Rust keeps standard Result and dependency/generated declarations are external.

- **[domain_structure:validation](practices/typescript-domain-structure.md#validation)**

  - Review named values/unions, failure sources, versions/migrations, ownership, and
    plaintext lifetime across changed scopes.


### Explicit state

- **File:** [Explicit state](practices/typescript-explicit-state.md).
- **Owns:** Enum-backed unions, absence normalization, forbidden sentinels, and unit versus value-returning void.
- **Does not own:** Boolean policy belongs to Enums instead of booleans; rune initialization belongs to Svelte state modeling.
- **Related:** [Domain structure](practices/typescript-domain-structure.md), [Enums instead of booleans](practices/typescript-enums-over-booleans.md), [Svelte state modeling](practices/svelte-state-modeling.md), [Upstream Effect guidance](SKILL.md#effect-use-installed-documentation).

- **[explicit_state:named_unions](practices/typescript-explicit-state.md#name-the-state-and-its-payload)**

  - Use named enum-backed discriminated unions for
    product/workflow/lifecycle/resource/UI alternatives.
  - Fields and generics reference the named union rather than inline alternatives.

- **[explicit_state:vocabulary_ownership](practices/typescript-explicit-state.md#use-enum-members-throughout-the-contract)**

  - In Rust/WASM projects, put portable product states in Rust and consume original
    generated enums. TypeScript-owned domains define their states in TypeScript.
  - Keep browser protocol/lifecycle/presentation vocabularies in cohesive TypeScript
    enums.

- **[explicit_state:enum_members](practices/typescript-explicit-state.md#use-enum-members-throughout-the-contract)**

  - Use enum members for all closed discriminants, constructors, comparisons, switches,
    and fixtures.
  - Raw string-literal unions remain forbidden even for protocol field names other than
    kind/type.

- **[explicit_state:coherent_vocabulary](practices/typescript-explicit-state.md#use-enum-members-throughout-the-contract)**

  - Preserve externally required serialized enum values.
  - Do not centralize unrelated state vocabularies into generic repository-wide enums.

- **[branching:typescript_switch](practices/typescript-explicit-state.md#match-domain-values-directly)**

  - Use native switch, including inside Effect generators; keep Effect sequencing
    and error handling around native branches.
  - Prohibit boolean if/else-if/if-else, including outside Effect.

- **[branching:typescript_exhaustiveness](practices/typescript-explicit-state.md#match-decisions-exhaustively)**

  - Name every enum/union variant; group cases only for intentional shared output.
  - Reject default cases hiding future variants and ternary conditional operators.
  - Require the branching lint checks; TypeScript alone is insufficient.

- **[explicit_state:component_enums](practices/typescript-explicit-state.md#keep-component-enums-in-an-importable-module)**

  - Place runtime enums consumed by Svelte components in adjacent cohesive .ts modules
    and import them, not instance or module script blocks.
  - Validate actual rendering, not just type checks.

- **[explicit_state:state_payloads](practices/typescript-explicit-state.md#name-the-state-and-its-payload)**

  - Put payloads on owning variants and combine values that transition together.
  - Expose transitions rather than mutable handles.

- **[explicit_state:typed_failures](practices/typescript-explicit-state.md#keep-failure-state-typed)**

  - Store typed failure kinds/outcomes, not freeform messages or parallel error slots.
  - Localize text only at presentation.

- **[explicit_state:no_implicit_absence](practices/typescript-explicit-state.md#normalize-absence-at-entry)**

  - Prohibit authored null/undefined values and types, zero-argument modeled state
    runes, parameterless $bindable absence defaults, and optional state bags across
    source/tests/fixtures/demos/config/tooling.

- **[explicit_state:external_absence](practices/typescript-explicit-state.md#normalize-absence-at-entry)**

  - Normalize external lookup/parser/cache/DOM/browser absence immediately into semantic
    states using structural/capability checks.
  - Do not translate one sentinel into another.

- **[explicit_state:no_sentinel_wrappers](practices/typescript-explicit-state.md#normalize-absence-at-entry)**

  - Prohibit generic Option/Maybe/Present-Absent clones, fake defaults, sentinel
    strings, non-null assertions, casts, and decorative wrappers used to hide absence.

- **[explicit_state:unit_void](practices/typescript-explicit-state.md#distinguish-effects-from-absent-values)**

  - Allow void only for complete unit/effect returns, `Promise<void>`,
    synchronous-or-asynchronous effects, and unary discard.
  - Reject value-or-void contracts including nested generics and callback results.

- **[explicit_state:no_nullish](practices/typescript-explicit-state.md#keep-defaults-inside-the-selected-branch)**

  - Prohibit ?? and ??=.
  - Do not replace them with truthiness or ||.
  - Preserve valid false/zero/empty-string values and evaluate an alternate only in its
    chosen branch.

- **[explicit_state:defaults](practices/typescript-explicit-state.md#keep-defaults-inside-the-selected-branch)**

  - Destructuring defaults are allowed only when the boundary contract defines omission
    as that concrete value.
  - Otherwise require an explicit state.

- **[explicit_state:exhaustive_transitions](practices/typescript-explicit-state.md#keep-failure-state-typed)**

  - Match states exhaustively.
  - Do not collapse them into parallel booleans.
  - Same-prefix categories nest and closed field allow-lists use enums.

- **[explicit_state:effect_errors](practices/typescript-explicit-state.md#keep-failure-state-typed)**

  - Use Effect typed failures for effectful workflows and concrete codec-local
    accumulated issues.
  - Do not create a competing failure wrapper.

- **[explicit_state:semantic_assertions](practices/typescript-explicit-state.md#assert-states-not-absence-sentinels)**

  - Tests assert variants/required values/structural properties.
  - Prohibit toBeUndefined/toBeNull/toBeDefined and quoted-sentinel comparisons such as
    typeof checks.

- **[explicit_state:generated_exclusions](practices/typescript-explicit-state.md#validation)**

  - Exclude dependency/build/generated declarations from authored-token enforcement.
  - Adapters still normalize their results.

- **[explicit_state:validation](practices/typescript-explicit-state.md#validation)**

  - Inventory tokens and add transition plus positive/negative preflight fixtures.
  - Reject sentinel ABI type overrides and Rust Option exports.
  - Run formatting, application-state checks, and applicable browser checks.


### Enums instead of booleans

- **File:** [Enums instead of booleans](practices/typescript-enums-over-booleans.md).
- **Owns:** Semantic alternatives instead of boolean policy and state, with narrow boundary exceptions.
- **Does not own:** General union and absence rules belong to Explicit state.
- **Related:** [Explicit state](practices/typescript-explicit-state.md), [Domain structure](practices/typescript-domain-structure.md).

- **[enums_over_booleans:semantic_enums](practices/typescript-enums-over-booleans.md#name-the-decision-at-the-call-site)**

  - Replace
    domain/application/workflow/lifecycle/policy/mode/command/configuration/owned-contract
    booleans with meaningful enums, even when there are only two cases.

- **[enums_over_booleans:distinct_decisions](practices/typescript-enums-over-booleans.md#name-the-decision-at-the-call-site)**

  - Use distinct enum types for distinct policies, enum-backed unions for payloads, and
    generated Rust enums for Rust-owned portable/security vocabulary.
  - Keep TypeScript-owned domain vocabulary in its TypeScript owner.

- **[enums_over_booleans:no_decorative_enums](practices/typescript-enums-over-booleans.md#name-the-decision-at-the-call-site)**

  - Do not use decorative True/False or generic Yes/No/Enabled/Disabled enums without
    naming the actual domain decision.

- **[enums_over_booleans:payloads](practices/typescript-enums-over-booleans.md#model-related-flags-as-one-state)**

  - Match alternatives exhaustively, keep variant data on its owner, and declare unions
    separately instead of embedding value-or-false fields.

- **[enums_over_booleans:preserve_members](practices/typescript-enums-over-booleans.md#model-related-flags-as-one-state)**

  - Preserve enum members through calls, constructors, fixtures, comparisons, and
    protocol handling.
  - Do not serialize a redundant derived boolean.

- **[enums_over_booleans:boundary_exceptions](practices/typescript-enums-over-booleans.md#contain-required-boolean-contracts)**

  - Required platform/host signatures and fixed wire edges keep external booleans
    only until immediate domain normalization.

- **[enums_over_booleans:predicate_outcomes](practices/typescript-enums-over-booleans.md#name-predicate-outcomes-before-choosing-behavior)**

  - Match dependency predicates directly into domain enums before workflow actions or reporting.
  - Private or mechanical authored predicates still return named domain outcomes.
  - Inference, callbacks, and exhaustive boolean matchers do not satisfy this requirement.
  - Keep conversions on existing owners without extra wrappers or services.

- **[enums_over_booleans:observations](practices/typescript-enums-over-booleans.md#contain-required-boolean-contracts)**

  - Raw observations do not exempt application policy.
  - Normalize observations into named states and delegate portable decisions to the
    project’s domain owner.

- **[enums_over_booleans:exception_evidence](practices/typescript-enums-over-booleans.md#contain-required-boolean-contracts)**

  - Document each retained public parameter/field/lint exception.
  - Tests, scripts, and internal DTOs have no blanket exemption.

- **[enums_over_booleans:validation](practices/typescript-enums-over-booleans.md#validation)**

  - Inventory boolean contracts, replace coupled flags with legal unions, test new
    variants/transitions, and run state/type/behavior/format checks.
  - Old suppressions are migration debt.


### Concrete values

- **File:** [Concrete values](practices/typescript-no-unknown.md).
- **Owns:** Restrictions on object, unknown, any, and erased bags; immediate boundary decoding.
- **Does not own:** Named domain contracts belong to Domain structure; effectful decoding belongs to upstream Effect guidance.
- **Related:** [Domain structure](practices/typescript-domain-structure.md), [Upstream Effect guidance](SKILL.md#effect-use-installed-documentation).

- **[no_unknown:no_object](practices/typescript-no-unknown.md#do-not-erase-application-contracts)**

  - Prohibit object everywhere in authored TypeScript/Svelte/tooling, with no boundary
    exception.
  - Exclude generated declarations.

- **[no_unknown:unknown_boundary](practices/typescript-no-unknown.md#decode-unknown-only-at-an-unavoidable-edge)**

  - Allow unknown only at an unavoidable untyped external transport decoder that
    immediately validates into a concrete domain value or typed failure.

- **[no_unknown:concrete_inputs](practices/typescript-no-unknown.md#decode-unknown-only-at-an-unavoidable-edge)**

  - Use a concrete platform input type when available.
  - Never make generic-value APIs a preferred or copied application pattern.

- **[no_unknown:no_erased_substitutes](practices/typescript-no-unknown.md#do-not-erase-application-contracts)**

  - Do not substitute Object, {}, any, broad indexes, Record<string,...>, recursive
    JsonValue/ExternalValue bags, or generic promise results.

- **[no_unknown:decoder_scope](practices/typescript-no-unknown.md#decode-unknown-only-at-an-unavoidable-edge)**

  - Keep unknown values only between adjacent steps of a dedicated contiguous decoding
    pipeline.
  - Do not store them or pass them into commands/services/UI/domain state.

- **[no_unknown:catch_bindings](practices/typescript-no-unknown.md#keep-failures-concrete)**

  - Keep catch bindings unannotated or concrete.
  - Do not write catch(error: unknown).
  - Keep casts at the host boundary.

- **[no_unknown:typed_errors](practices/typescript-no-unknown.md#keep-failures-concrete)**

  - Use Effect typed errors for effectful work and concrete codec-local outcomes for
    decoding.

- **[no_unknown:enforcement](practices/typescript-no-unknown.md#validation)**

  - Enforce restricted types through ESLint.
  - Audit boundary unknown exceptions for immediate narrowing and reject generic-value
    escapes.


### Effect workflows

- **Source:** [Installed Effect documentation](SKILL.md#effect-use-installed-documentation).
- **Owns:** Effect's installed documentation owns API and implementation guidance.
- **Related:** [Domain structure](practices/typescript-domain-structure.md), [Serial operation queues](practices/typescript-serial-operation-queues.md).

- **[effect:upstream](SKILL.md#effect-use-installed-documentation)**

  - Before writing Effect code, read the installed `effect/AGENTS.md` completely.

- **[effect:version](SKILL.md#manage-the-pinned-release)**

  - Select the latest release on the chosen release channel when adopting or upgrading.
  - Pin one exact release across workspace packages; routine work uses its installed docs.
  - Identify prereleases and follow official migration guidance with required checks.

- **[effect:effectful_work](SKILL.md#choose-effect-for-workflows)**

  - Use Effect for materially changed effectful workflows, including scripts and
    tests; keep pure calculations with their existing domain owners.


## Task-specific practices

### Browser implementation

- **File:** [Browser implementation](practices/browser-implementation.md).
- **Owns:** Browser stack, component integration, translation integration, capabilities, and UI delivery.
- **Does not own:** Regression test design belongs to Browser testing; rune state belongs to Svelte state modeling.
- **Related:** [Browser testing](practices/browser-testing.md), [Svelte state modeling](practices/svelte-state-modeling.md).

- **[browser_implementation:stack](practices/browser-implementation.md#use-the-existing-ui-stack)**

  - Use the project’s UI framework, package manager, design tokens, primitives, and
    documented build commands. Apply Svelte 5 runes only to Svelte 5 consumers.

- **[browser_implementation:ui_libraries](practices/browser-implementation.md#use-the-existing-ui-stack)**

  - Reuse the project’s component, icon, and motion libraries; do not prescribe
    Tailwind, Vite, Bun, or Taskfile to projects that have not selected them.

- **[browser_implementation:no_parallel_stack](practices/browser-implementation.md#use-the-existing-ui-stack)**

  - Do not introduce a parallel UI system or replace the command runner incidentally.
  - Inspect project instructions and package.json before selecting dependencies.

- **[browser_implementation:impeccable](practices/browser-implementation.md#use-the-existing-ui-stack)**

  - Impeccable is opt-in only when explicitly requested by name.
  - Never automatically install/load/run it.

- **[browser_implementation:component_contracts](practices/browser-implementation.md#let-the-ui-framework-own-rendering-and-interactions)**

  - Keep markup readable and components thin.
  - Use typed props/generated bindings, semantic keyed collections, semantic HTML before
    ARIA patches, and package event conventions.

- **[browser_implementation:explicit_state](practices/browser-implementation.md#let-the-ui-framework-own-rendering-and-interactions)**

  - Follow explicit-state rules in UI components, with immediate external normalization rather
    than authored null/undefined.

- **[browser_implementation:cleanup](practices/browser-implementation.md#release-lifecycle-resources)**

  - Use framework lifecycle cleanup for listeners/observers/timers/animation state;
    return cleanup from $effect in Svelte.
  - Keep continuous pointer/scroll values outside broad component state, using
    CSS, observers, or narrow adapters.

- **[browser_implementation:controllers](practices/browser-implementation.md#release-lifecycle-resources)**

  - Reuse the project’s state ownership pattern, including existing .svelte.ts
    controllers in Svelte projects; do not add a second store architecture.

- **[browser_implementation:rust_ownership](practices/browser-implementation.md#let-the-ui-framework-own-rendering-and-interactions)**

  - Preserve core → WASM → presentation ownership in Rust/WASM projects.
  - Otherwise, keep domain decisions in their project-defined owner, which may be
    TypeScript. Components consume those decisions.

- **[browser_implementation:secret_surfaces](practices/browser-implementation.md#keep-secrets-out-of-incidental-surfaces)**

  - Do not expose secrets through URLs/logs/attributes/test IDs/analytics/hidden markup.
  - Never persist plaintext in convenience state.

- **[browser_implementation:disclosure_and_passkeys](practices/browser-implementation.md#keep-secrets-out-of-incidental-surfaces)**

  - Mask secrets until explicit reveal and clear temporary revealed/generated values on
    hide/dismissal.
  - Keep passkey creation explicit and do not infer missing credentials from
    cancellation.

- **[browser_implementation:capabilities](practices/browser-implementation.md#detect-capabilities-not-screen-size)**

  - Detect browser/extension capabilities and state rather than inferring them from
    viewport size.

- **[browser_implementation:translations](practices/browser-implementation.md#translate-visible-and-accessible-text)**

  - Route visible/accessibility strings through the project’s translation catalogs,
    preserve all supported locales, and forbid hidden inline-English fallbacks.
  - Retain Rust-owned catalogs where supplied; do not require Rust for localization.

- **[browser_implementation:validation](practices/browser-implementation.md#validation)**

  - Add focused browser coverage with the project’s tooling and run formatting/UI checks.
  - Inspect app logs before editing after a browser failure.


### Svelte state modeling

- **File:** [Svelte state modeling](practices/svelte-state-modeling.md).
- **Owns:** Explicit rune initialization, visual/lifecycle states, and co-transitioning UI payloads.
- **Does not own:** General absence rules belong to Explicit state; portable domain decisions use the supplied cross-language practices.
- **Related:** [Explicit state](practices/typescript-explicit-state.md), [Named arguments](practices/typescript-named-args.md), [Browser implementation](practices/browser-implementation.md).

- **[svelte_state_modeling:initialization](practices/svelte-state-modeling.md#initialize-every-modeled-rune)**

  - Initialize modeled rune state explicitly.
  - Prohibit zero-argument $state and implicit absent DOM references when authored code
    uses the reference.

- **[svelte_state_modeling:state_payloads](practices/svelte-state-modeling.md#move-related-values-together)**

  - Use named enum-backed visual/lifecycle unions, put payloads on variants, and group
    co-transitioning values rather than parallel optionals/booleans.

- **[svelte_state_modeling:generated_types](practices/svelte-state-modeling.md#preserve-generated-product-types)**

  - Keep portable workflows with the project’s domain owner: Rust in Rust/WASM
    projects, or TypeScript otherwise.
  - Preserve canonical enums/identifiers without widening them to string.

- **[svelte_state_modeling:external_absence](practices/svelte-state-modeling.md#move-related-values-together)**

  - Normalize external/browser/generated absence directly into semantic variants, not
    another sentinel.
  - Generated declarations are excluded but adapters are not.

- **[svelte_state_modeling:validation](practices/svelte-state-modeling.md#validation)**

  - Review rune declarations/clearing assignments, preserve typed identifiers, and run
    state preflight, diff/format checks, and applicable browser tests.


### Browser testing

- **File:** [Browser testing](practices/browser-testing.md).
- **Owns:** Observable browser integration, regression coverage, and failure investigation.
- **Does not own:** Browser implementation choices belong to Browser implementation; dead-code checks belong to Unused code.
- **Related:** [Browser implementation](practices/browser-implementation.md), [Unused code](practices/web-unused-code.md).

- **[browser_testing:browser_boundary](practices/browser-testing.md#test-the-boundary-that-can-fail)**

  - Use the project’s browser tooling for observable user/browser/extension
    integration, persistence, visibility, clipboard/download/multitab/origin behavior.
  - Test portable algorithms in their Rust or TypeScript domain owner.

- **[browser_testing:suite_gates](practices/browser-testing.md#validation)**

  - When specs are partitioned across projects, every non-demo behavior spec appears
    exactly once in the executable gate manifest.
  - Default discovery does not need a redundant manifest.

- **[browser_testing:diagnose_first](practices/browser-testing.md#repair-from-evidence-with-a-regression-first)**

  - Before fixing an E2E failure, inspect saved output/logs/context/trace, identify the
    owning boundary, and choose the smallest existing regression framework.

- **[browser_testing:regression_first](practices/browser-testing.md#repair-from-evidence-with-a-regression-first)**

  - Follow common regression-before-fix procedure with actual transport contracts and
    realistic mocks.
  - Make the smallest owning correction and retain regressions.

- **[browser_testing:retain_acceptance](practices/browser-testing.md#repair-from-evidence-with-a-regression-first)**

  - Keep browser assertions for acceptance, including browser-only defects with their
    closest deterministic unit contract.
  - Diagnose new failure evidence before each subsequent repair.

- **[browser_testing:no_weakened_tests](practices/browser-testing.md#do-not-weaken-the-failing-scenario)**

  - Do not fix failures by weakening assertions, extending timeouts, skipping scenarios,
    or inventing a new framework when an existing one covers the behavior.

- **[browser_testing:evidence](practices/browser-testing.md#validation)**

  - Measure meaningful contracts/branches rather than test count.
  - Record changed-flow browser results and ensure every behavior spec has an executable
    gate.


### Unused code

- **File:** [Unused code](practices/web-unused-code.md).
- **Owns:** Dead files, exports, members, dependencies, and limits of unused-code tooling.
- **Does not own:** Behavioral regression coverage belongs to Browser testing; dependency adoption belongs to Dependency selection.
- **Related:** [Browser testing](practices/browser-testing.md), [Dependency selection](practices/dependency-selection.md).

- **[web_unused_code:audit_scope](practices/web-unused-code.md#check-what-the-installed-tool-cannot-see)**

  - Audit unused files, exports, types, enum/class members, and dependencies across
    authored TS/Svelte, excluding generated/vendor declarations.

- **[web_unused_code:tool_blind_spots](practices/web-unused-code.md#check-what-the-installed-tool-cannot-see)**

  - TS/ESLint/Knip coverage differs by version.
  - When class members are not checked, explicitly inspect direct, optional-chained,
    internal, framework, generated, and test callers.

- **[web_unused_code:fix_findings](practices/web-unused-code.md#fix-findings-without-deleting-live-behavior)**

  - Delete or correctly connect valid findings.
  - Do not add ignores, reduce issue coverage, or retain callerless compatibility
    aliases.

- **[web_unused_code:live_markup](practices/web-unused-code.md#fix-findings-without-deleting-live-behavior)**

  - Search all consumers before removing state-controller members.
  - For live markup-only calls hidden from Knip, narrow the API to a private
    implementation behind an exported factory rather than suppressing or deleting
    behavior.

- **[web_unused_code:no_json_roundtrip](practices/web-unused-code.md#do-not-hide-reactive-state-behind-json)**

  - Reject JSON round-trip unwrapping.
  - Rune callers use snapshot at the boundary.

- **[web_unused_code:validation](practices/web-unused-code.md#validation)**

  - Run checks for every affected web project with zero findings and separately audit
    members the tool cannot trace.


### Serial operation queues

- **File:** [Serial operation queues](practices/typescript-serial-operation-queues.md).
- **Owns:** Ordered asynchronous work, per-operation failure, queue recovery, and idle barriers.
- **Does not own:** Effect API guidance belongs to the installed upstream documentation.
- **Related:** [Upstream Effect guidance](SKILL.md#effect-use-installed-documentation), [Function ownership](practices/typescript-function-ownership.md).

- **[serial_operation_queues:effect_queue](practices/typescript-serial-operation-queues.md#keep-the-queue-and-results-typed)**

  - Use an Effect Queue and one scoped FIFO consumer.
  - Keep internal scheduling in Effect and external Promise APIs at adapters, without
    public mutable Promise tails.

- **[serial_operation_queues:typed_completion](practices/typescript-serial-operation-queues.md#report-failure-without-stopping-later-work)**

  - Give each job a typed Deferred completion.
  - Publish its Exit to its caller so a failed operation does not stop later jobs.

- **[serial_operation_queues:idle_and_recovery](practices/typescript-serial-operation-queues.md#define-idle-and-recovery-explicitly)**

  - Implement onIdle as an ordered barrier after prior admissions, not an empty-queue
    check.
  - Recovery must settle/interrupt admitted work and release the old consumer.

- **[serial_operation_queues:scheduling](practices/typescript-serial-operation-queues.md#keep-the-queue-and-results-typed)**

  - Keep scheduling in TypeScript and policy in its domain owner, which is Rust in
    Rust/WASM projects.
  - Choose capacity/backpressure and retain richer priority/cancellation/expiry/close
    schedulers where required.

- **[serial_operation_queues:admission_and_shutdown](practices/typescript-serial-operation-queues.md#report-failure-without-stopping-later-work)**

  - Return Effect from enqueue and admit work when that effect runs.
  - Convert Queue admission rejection into a typed admission failure before
    awaiting completion; an unsubmitted job must not leave a caller waiting.
  - Scope the consumer and settle every in-flight/queued completion on shutdown, not
    only Queue waiters.

- **[serial_operation_queues:validation](practices/typescript-serial-operation-queues.md#validation)**

  - Test FIFO, one active operation, typed caller failures, continuation, idle barriers,
    cancellation, shutdown, and recovery against the pinned Effect release.



## Supporting practices

### TypeScript code checks

- **File:** [TypeScript code checks](practices/typescript-code-checks.md).
- **Owns:** Mandatory formatting, type checking, linting, warning-free builds, and check evidence.
- **Does not own:** Behavioral coverage belongs to Browser testing; dead-code analysis belongs to Unused code; pipeline implementation belongs to the CI/CD owner.
- **Related:** [Browser testing](practices/browser-testing.md), [Unused code](practices/web-unused-code.md), [Single parameter](practices/typescript-single-parameter.md).

- **[code_checks:establish](practices/typescript-code-checks.md#establish-repeatable-checks)**

  - Establish all three gates in existing project tooling; preserve the stack,
    package manager, compiler settings, and existing tests/verification steps.
  - Cover applicable packages and authored source, tests, tooling, and configuration;
    use reference-aware, component, or JS checkers where required.
  - Builds do not replace type checks; run required builds without warnings and
    make lint warnings fail, using the installed tool's supported options.
  - Keep generated/vendor files with their owners and coordinate pipeline changes.
  - Apply the branching checks; use upstream Effect guidance without an operator allowlist.

- **[code_checks:branching](practices/typescript-code-checks.md#check-branching)**

  - Reject IfStatement and ConditionalExpression across authored TypeScript/JavaScript.
  - Require switch-exhaustiveness-check with allowDefaultCaseForExhaustiveSwitch
    and considerDefaultExhaustiveForUnions both false, plus fallthrough checking.
  - Verify missing variants fail lint even with a default; preserve existing restrictions.

- **[code_checks:fix_diagnostics](practices/typescript-code-checks.md#fix-diagnostics-before-completion)**

  - Fix all encountered formatting, type, lint, framework, and build diagnostics,
    including pre-existing ones, and rerun gates after the final edit.
  - Review autofixes; retain behavioral tests and unused-code enforcement.
  - Do not weaken checks or suppress findings to pass; existing external-contract
    exceptions remain bounded by their owning practices.
  - Repair dependency/generator causes through their owners; report out-of-scope
    repairs as blockers rather than accept unresolved warnings.

- **[code_checks:evidence](practices/typescript-code-checks.md#report-verification-evidence)**

  - Report actual commands, roots, configurations, and results; require all gates
    and required builds to pass without warnings or errors before completion.
  - Missing tools, unchecked required packages, and remaining diagnostics block
    verification rather than count as success.

### Dependency selection

- **File:** [Dependency selection](practices/dependency-selection.md).
- **Owns:** TypeScript ecosystem adoption thresholds and manifest verification.
- **Does not own:** Prescribed framework choices belong to Browser implementation; dead dependencies belong to Unused code.
- **Related:** [Browser implementation](practices/browser-implementation.md), [Unused code](practices/web-unused-code.md).

- **[dependency_selection:thresholds](practices/dependency-selection.md#adoption-thresholds)**

  - Require at least 10,000 weekly npm downloads and 100 GitHub stars when a repository
    exists.

- **[dependency_selection:verification](practices/dependency-selection.md#adoption-thresholds)**

  - Inspect manifests and verify counts for dependency adoption/review.
  - Retain common exclusions for generated bindings and toolchain-pinned packages.



## Cross-rule consistency checks

Use these checks when a change touches both subjects. They describe how the
linked rules apply together; the source practices remain authoritative.

### One parameter still needs a named argument

Check the parameter declaration and the object supplied at each call site.

- **Prohibited:** Replace positional inputs with an anonymous object parameter or pass
  an unbound object literal to an ordinary method.
- **Preferred:** Declare a named request type, bind the object to an explicitly typed
  name, and pass that binding. Keep rune exceptions limited to the listed compiler
  forms.

**Compare:**

- [single_parameter:semantic_request](practices/typescript-single-parameter.md#collect-independent-inputs-in-one-request)
- [named_args:typed_bindings](practices/typescript-named-args.md#name-and-type-object-arguments)
- [named_args:rune_exceptions](practices/typescript-named-args.md#limit-rune-exceptions-to-the-compiler-forms)

### Named containers still need domain types

Inspect fields inside requests and state payloads, not just the outer type name.

- **Prohibited:** Call a request strongly typed while its identifiers are
  interchangeable strings and its decisions are boolean flags.
- **Preferred:** Use distinct identifier types, semantic enums for decisions, and named
  unions whose variants own their payloads.

**Compare:**

- [domain_structure:nominal_identity](practices/typescript-domain-structure.md#preserve-value-identity)
- [explicit_state:named_unions](practices/typescript-explicit-state.md#name-the-state-and-its-payload)
- [enums_over_booleans:semantic_enums](practices/typescript-enums-over-booleans.md#name-the-decision-at-the-call-site)

### Decoding ends before application workflows begin

Follow untrusted input from its decoder into the effectful workflow.

- **Prohibited:** Forward `unknown` beyond decoding, or make the workflow use a second
  failure wrapper because an external API returns a Promise.
- **Preferred:** Decode to a concrete value or concrete failure at the edge; preserve
  expected failures in the Effect error channel.

**Compare:**

- [no_unknown:decoder_scope](practices/typescript-no-unknown.md#decode-unknown-only-at-an-unavoidable-edge)
- [no_unknown:typed_errors](practices/typescript-no-unknown.md#keep-failures-concrete)
- [effect:upstream](SKILL.md#effect-use-installed-documentation)

### Reactive state must have a meaningful initial state

Check initialization and external absence handling together.

- **Prohibited:** Use an uninitialized rune or copy generated optional fields into
  authored optional application state.
- **Preferred:** Initialize a named state union and normalize external absence at entry;
  move each state and its payload together.

**Compare:**

- [explicit_state:external_absence](practices/typescript-explicit-state.md#normalize-absence-at-entry)
- [svelte_state_modeling:initialization](practices/svelte-state-modeling.md#initialize-every-modeled-rune)
- [svelte_state_modeling:state_payloads](practices/svelte-state-modeling.md#move-related-values-together)

### Shared vocabulary is not shared mutable state

Check what was moved from a component into an adjacent module.

- **Prohibited:** Move mutable component state into a module-global singleton when
  extracting its enum.
- **Preferred:** Export the enum from an importable module; retain interaction state and
  lifecycle cleanup with the owning component or controller.

**Compare:**

- [explicit_state:component_enums](practices/typescript-explicit-state.md#keep-component-enums-in-an-importable-module)
- [function_ownership:component_scope](practices/typescript-function-ownership.md#keep-component-ownership-local)
- [browser_implementation:cleanup](practices/browser-implementation.md#release-lifecycle-resources)

### Integration guidance does not select a replacement UI stack

Distinguish guidance for an existing framework consumer from authority to replace the
implementation stack.

- **Prohibited:** Replace an existing Svelte interface with React because the supplied
  WASM guidance explains React integration.
- **Preferred:** Preserve the project’s selected stack and commands. Apply Svelte, React,
  or Vue guidance to its matching consumer within the assigned scope.

**Compare:**

- [browser_implementation:stack](practices/browser-implementation.md#use-the-existing-ui-stack)
- [browser_implementation:no_parallel_stack](practices/browser-implementation.md#use-the-existing-ui-stack)

### Boolean exceptions stay with their language and boundary

Check the owner of an unavoidable boolean contract and the precise exception in the
applicable language practice.

- **Prohibited:** Treat a host signature or dependency predicate as permission
  for authored boolean decisions in either language.
- **Preferred:** Normalize required external booleans into named domain outcomes
  before workflow behavior. Keep conversions on their TypeScript or Rust owner.

**Compare:**

- [enums_over_booleans:boundary_exceptions](practices/typescript-enums-over-booleans.md#contain-required-boolean-contracts)
- [enums_over_booleans:observations](practices/typescript-enums-over-booleans.md#contain-required-boolean-contracts)
- [enums_over_booleans:exception_evidence](practices/typescript-enums-over-booleans.md#contain-required-boolean-contracts)

### Static findings must agree with browser reachability

Check markup, framework entrypoints, and runtime behavior before deleting a reported
unused symbol.

- **Prohibited:** Delete a handler used from markup because static tooling missed its
  call site, then weaken the failing browser test.
- **Preferred:** Confirm reachability, correct the finding or remove genuinely dead
  code, and keep the browser acceptance scenario intact.

**Compare:**

- [web_unused_code:tool_blind_spots](practices/web-unused-code.md#check-what-the-installed-tool-cannot-see)
- [web_unused_code:live_markup](practices/web-unused-code.md#fix-findings-without-deleting-live-behavior)
- [browser_testing:no_weakened_tests](practices/browser-testing.md#do-not-weaken-the-failing-scenario)

### Queue continuation must preserve completion and cleanup

Trace each admitted job through success, failure, recovery, and scope shutdown.

- **Prohibited:** Catch and discard a job failure to keep the worker alive, leave its
  completion unresolved, or assume queue shutdown settles every admitted job.
- **Preferred:** Complete each job with its typed outcome while allowing later work to
  run. Settle admitted work during shutdown; keep host-required Promise conversion at
  the adapter.

**Compare:**

- [serial_operation_queues:typed_completion](practices/typescript-serial-operation-queues.md#report-failure-without-stopping-later-work)
- [serial_operation_queues:admission_and_shutdown](practices/typescript-serial-operation-queues.md#report-failure-without-stopping-later-work)
- [effect:upstream](SKILL.md#effect-use-installed-documentation)
