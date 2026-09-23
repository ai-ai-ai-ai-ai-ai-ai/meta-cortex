# Rust Knowledge Graph

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

For implementation, refactoring, review, and tooling, always load Domain types,
Domain states, Module layout, and Rust code checks as required by the skill entry point. Select
additional entries covering the decisions being changed and load those practices
in full. Include related subjects when the change crosses their boundaries.

## Modeling

### Domain types

- **File:** [Domain types](practices/modeling/domain-types.md).
- **Owns:** Value identity, newtypes, validation, external raw-value conversions, and domain-module placement.
- **Does not own:** Runtime alternatives belong to Domain states; constructor syntax belongs to Struct construction.
- **Related:** [Domain states](practices/modeling/domain-states.md), [Struct construction](practices/modeling/struct-construction.md), [Serialization boundaries](practices/boundaries/serialization-boundaries.md).

- **[domain_types:reuse](practices/modeling/domain-types.md#required-actions)**

  - Reuse an equivalent core type before adding another struct or enum.
  - Use concrete values unless a real shared contract requires generics or trait
    objects.

- **[domain_types:concrete_modules](practices/modeling/domain-types.md#required-actions)**

  - Keep domain types, their validation, and focused tests in owning domain modules, not
    loose files at the core src root.
  - Re-export stable public types through lib.rs.

- **[domain_types:nominal_values](practices/modeling/domain-types.md#required-actions)**

  - Give every domain scalar a distinct newtype in public/private fields, parameters,
    returns, locals, constants, tests, and recursively nested containers.
  - Variable names and primitive aliases do not suffice.

- **[domain_types:primitive_storage](practices/modeling/domain-types.md#required-actions)**

  - Keep primitive representation inside its owning value or a required external edge.
  - User text and locale keys also require meaningful domain types.

- **[domain_types:metadata_meaning](practices/modeling/domain-types.md#classify-metadata-by-meaning)**

  - Classify metadata contents before choosing types: enums for choices, named
    records for composites, and distinct newtypes for atomic prose.
  - Help text and output placement do not exempt structured content from modeling.
  - Structured examples follow Serialization boundaries' typed construction rule.

- **[domain_types:structured_strings](practices/modeling/domain-types.md#normalize-structured-strings-into-domain-components)**

  - Normalize structured strings into independently meaningful typed components;
    use domain types for dynamic parts and reuse canonical behavioral values.
  - Keep fixed wording in renderers, free-form prose in named text values, and
    external parsing/encoding at adapters; do not store redundant composite text.
  - Existing string wire contracts may render normalized models at the edge;
    wire-shape changes follow versioning/migration policy.

- **[domain_types:validated_records](practices/modeling/domain-types.md#construction-and-representation)**

  - Required persisted or signed values use validated required newtypes.
  - Preserve validation during deserialization.

- **[domain_types:parse_states](practices/modeling/domain-types.md#classify-primitive-wrapper-input-with-explicit-states)**

  - Prohibit primitive-wrapper TryFrom/FromStr and equivalent hidden-Result APIs;
    classify input through enums naming success and every rejection state.
  - Match classifications in callers, catalogs, and fixtures; no into_result shortcut
    or serialization detour. Keep validated payloads private.
  - Genuine representation conversion and I/O retain typed Result errors. Serde's
    enum-to-value adapter only maps states to its required Result interface.

- **[domain_types:closed_vocabulary](practices/modeling/domain-types.md#model-a-known-vocabulary-as-a-closed-enum)**

  - Inspect the owning catalog; use a complete closed enum for known identities and
    reject unregistered names. Keep dynamic session/task identities separate.
  - Construct variants directly and use named typed constants for reusable quantities.

- **[domain_types:ownership_hierarchy](practices/modeling/domain-types.md#preserve-ownership-hierarchies-in-enum-payloads)**

  - Preserve catalog containment in nested enums: each team encloses only its role
    enum, and coordinators retain their own group. Reject flat leaf catalogs and
    independent owner/role fields that permit invalid combinations.
  - Team-specific APIs take the team's leaf enum; shared ledgers take the enclosing
    identity. Preserve containment in wire schemas, assignments, and history.
  - Verify role membership against each parent's catalog, not just a combined set;
    prove invalid combinations fail compilation and boundary decoding.

- **[domain_types:external_conversions](practices/modeling/domain-types.md#external-raw-values)**

  - Convert uncontrolled external primitives and records immediately through
    destination-owned From classification, or TryFrom for genuine representation conversion.
  - Conversion parameters may be raw, but application contracts may not.

- **[domain_types:external_records](practices/modeling/domain-types.md#external-raw-values)**

  - Do not retain a dependency-owned raw record inside an application wrapper.
  - Let destination field types own their conversions.

- **[domain_types:conversion_traits](practices/modeling/domain-types.md#standard-conversions)**

  - Use From for infallible conversion/classification and TryFrom with a concrete
    error for genuine representation conversion, not primitive-wrapper validation.
  - Do not panic, discard meaning, or default invalid input to force From.

- **[domain_types:operation_boundaries](practices/modeling/domain-types.md#standard-conversions)**

  - Keep context-dependent policy, effects, and authorization-sensitive transitions as
    named operations.
  - A single argument alone does not make an operation a conversion.

- **[domain_types:private_construction](practices/modeling/domain-types.md#standard-conversions)**

  - Preserve private validated construction and legal capability transitions when
    implementing conversion traits.

- **[domain_types:wasm_values](practices/modeling/domain-types.md#wasm--js-boundary)**

  - Preserve identifier/count wrappers across Rust/WASM calls.
  - Unwrap only at a required external edge and parse incoming wire strings before core
    behavior.

- **[domain_types:constants](practices/modeling/domain-types.md#single-field-primitive-wrapper)**

  - Use meaningful associated constants for common values.
  - Keep dynamic values on the conversion path.

- **[domain_types:wire_shape](practices/modeling/domain-types.md#single-field-primitive-wrapper)**

  - Choose transparent serialization only when the wire must remain primitive.
  - Retain the wrapper shape when the wire requires a value field.

- **[domain_types:wrapper_access](practices/modeling/domain-types.md#access-wrappers-through-patterns-or-domain-methods)**

  - Prohibit numeric field access throughout authored code, including wrapper
    implementations, conversions, tests, and adapters.
  - Use meaningful destructuring patterns or domain methods that retain domain
    types; preserve privacy and keep primitive extraction at its owning boundary.
  - Retain approved derives and the existing prohibition on application tuples.

- **[domain_types:aggregates](practices/modeling/domain-types.md#aggregate-construction)**

  - Construct multi-field aggregates with named literals and reject From<(A, B, C)> for
    independent fields.
  - Validation must not expose restricted fields.

- **[domain_types:versions](practices/modeling/domain-types.md#model-supported-schema-revisions-explicitly)**

  - Name each supported schema revision; use exhaustive version dispatch and separate
    payload types for differing shapes. Reject unsupported wire values at entry.
  - Keep independent consumer/test version fields typed; primitive wire values stay
    in boundary classifiers and invalid fixtures, not decoded application records.
  - Retain documented migration support before advancing the current version.

- **[domain_types:release_versions](practices/modeling/domain-types.md#enumerate-supported-application-releases)**

  - Parse supported application/framework releases into closed enums, not validated
    strings or arbitrary semantic-version records. Reject unknown/retired identities.
  - Require package-version/enum correspondence at compile time, exhaustive wire
    mappings, and typed consumer decoding; test both known and unsupported releases.

- **[domain_types:update_revisions](practices/modeling/domain-types.md#distinguish-schema-revisions-from-update-counters)**

  - Keep optimistic-lock revisions as open validated counters; use observed tokens
    and named domain transitions instead of guessed numeric fixtures.

- **[domain_types:named_records](practices/modeling/domain-types.md#replace-positional-tuples-with-named-records)**

  - Replace positional multi-value tuples with named domain structs throughout
    application code and fixtures; match existing records directly.
  - Unit and single-field newtypes are distinct; contain dependency-required
    tuples at the exact adapter boundary.

- **[domain_types:api_inventory](practices/modeling/domain-types.md#domain-api-enforcement)**

  - Inventory primitive APIs recursively, including generic defaults, bounds, aliases,
    re-exports, and inherited methods.
  - A public numeric lint alone does not cover the rule.

- **[domain_types:lint_exceptions](practices/modeling/domain-types.md#domain-api-enforcement)**

  - Use raw_numeric_public_api where available.
  - Scope any required serialization/database/FFI lint expectation to the exact item and
    document the edge, never blanket-suppress a crate/module/type.


- **[domain_types:semantic_review](practices/modeling/domain-types.md#validation)**

  - Before handoff, inventory changed code and touched aggregates, including
    siblings, private fields, constants, examples, tests, and moved code.
  - Classify choices, open content, representation storage, and exact external
    contracts; preserve named values through construction and encoding.
  - Report semantic review scope and exceptions separately from mechanical checks;
    numeric lints and text searches do not establish full compliance.

### Domain states

- **File:** [Domain states](practices/modeling/domain-states.md).
- **Owns:** Runtime alternatives, state-owned payloads, exhaustive decisions, Option/boolean prohibitions, and external-record conversion.
- **Does not own:** Legal transition sequences belong to Workflow typestate; value identity belongs to Domain types.
- **Related:** [Domain types](practices/modeling/domain-types.md), [Workflow typestate](practices/behavior/workflow-typestate.md), [Error handling](practices/behavior/error-handling.md).

- **[domain_states:no_option](practices/modeling/domain-states.md#replace-option-with-meaningful-states)**

  - Prohibit authored Option fields, parameters, returns, aliases, and stored locals,
    including tests, caches, filters, parsers, and adapters.
  - Use meaningful state enums.

- **[domain_states:named_absence](practices/modeling/domain-states.md#replace-option-with-meaningful-states)**

  - Do not replace Option with generic Maybe/Present-Absent wrappers, sentinels, or
    decorative variants that still hide meaning.

- **[domain_states:dependency_options](practices/modeling/domain-states.md#translate-dependency-results-immediately)**

  - Consume dependency Option results immediately into a named outcome or typed error.
  - Do not retain/forward them or author Option-returning trait implementations.

- **[domain_states:option_review](practices/modeling/domain-states.md#review-the-option-prohibition)**

  - Review explicit and inferred authored Option uses and dependency-result handling.
  - Exclude dependency-generated implementations from the authored-code requirement.
  - Do not ban Option through Clippy or add wrapper modules and lint allowances for derives.

- **[domain_states:empty_text](practices/modeling/domain-states.md#represent-empty-prose-as-a-value)**

  - Classify empty free-form prose with infallible From and meaningful domain states.
  - Protect nonempty payload construction, preserve whitespace and established wire
    shapes, and distinguish empty text from missing or malformed input.

- **[domain_states:required_values](practices/modeling/domain-states.md#require-values-that-cannot-be-absent)**

  - Required identities/signed values remain required; persistence does not make
    empty prose invalid.
  - Reject missing or invalid input before domain construction rather than inventing
    Missing variants or empty strings.

- **[domain_states:drafts](practices/modeling/domain-states.md#require-values-that-cannot-be-absent)**

  - Model legitimate drafts separately.
  - Preserve established wire shapes through adapters and authorized migrations.

- **[domain_states:no_booleans](practices/modeling/domain-states.md#convert-external-records-into-owned-types)**

  - Use enums instead of authored domain/application booleans, even for two cases.
  - Reject boolean fields, ordinary parameters, returns, aliases, and stored locals.

- **[domain_states:boolean_conversion](practices/modeling/domain-states.md#convert-external-records-into-owned-types)**

  - Allow destination-owned From<bool> at external conversion boundaries, or TryFrom
    when conversion can fail.
  - Prohibit enum-to-bool conversions and serde(into = "bool") by default.
  - Allow them only for a required external interface or established backward compatibility.
  - Document the concrete contract at the boundary; keep new owned contracts as enums.
  - This is not permission for boolean application APIs.

- **[domain_states:external_records](practices/modeling/domain-states.md#convert-external-records-into-owned-types)**

  - Convert complete dependency-owned flag records into owned types.
  - Keep independent policies as distinct enums and reject invalid combinations with a
    typed failure.

- **[domain_states:raw_records](practices/modeling/domain-states.md#convert-external-records-into-owned-types)**

  - Do not redeclare external boolean DTOs or retain their raw records behind getters.
  - Decode raw JSON into owned states.

- **[domain_states:mechanical_predicates](practices/modeling/domain-states.md#convert-external-records-into-owned-types)**

  - Consume library predicate/operator booleans directly in control flow.
  - Do not expose authored boolean predicates or store mechanical results as policy.

- **[domain_states:no_derived_flags](practices/modeling/domain-states.md#convert-external-records-into-owned-types)**

  - Do not add is_* methods that merely reveal a variant, decorative True/False
    variants, or duplicate serialized boolean fields derivable from an enum.

- **[domain_states:variant_payloads](practices/modeling/domain-states.md#put-payloads-on-their-owning-variants)**

  - Put each payload on its owning variant.
  - Use a payload struct for multiple named fields, retain truthful unit/single-value
    variants, and do not reshape persisted variants for uniformity.

- **[domain_states:independent_dimensions](practices/modeling/domain-states.md#separate-independent-dimensions-nest-refinements)**

  - Keep independent dimensions in separate types.
  - Nest a category only when it refines its parent.

- **[domain_states:capabilities](practices/modeling/domain-states.md#put-payloads-on-their-owning-variants)**

  - Keep authorization capability construction private.
  - Model legal action sequencing with typestate rather than runtime flag bags.

- **[domain_states:exhaustive_matching](practices/modeling/domain-states.md#match-decisions-exhaustively)**

  - Match evolving decisions exhaustively.
  - Wildcard/early-exit branches may not silently classify future variants.
  - Use if let or positive let-else only when unmatched variants intentionally share
    handling.

- **[domain_states:decision_locality](practices/modeling/domain-states.md#match-decisions-exhaustively)**

  - Avoid negated compound conditions and deeply nested matches.
  - Keep decisions with their owners.

- **[domain_states:membership](practices/modeling/domain-states.md#consume-membership-results-as-control-flow)**

  - Use membership collections rather than repeated scans for uniqueness.
  - Consume HashSet insertion results directly and return a typed duplicate failure.

- **[domain_states:validation](practices/modeling/domain-states.md#validation)**

  - Test each state and invalid persisted input.
  - Review boundary conversions, payload ownership, and exhaustiveness.
  - Run affected tests and all-target Clippy with warnings denied.


### Struct construction

- **File:** [Struct construction](practices/modeling/struct-construction.md).
- **Owns:** Struct literals, single-field conversions, and constructor restrictions.
- **Does not own:** Choosing meaningful defaults belongs to Default values; capability transitions belong to Workflow typestate.
- **Related:** [Default values](practices/modeling/default-values.md), [Domain types](practices/modeling/domain-types.md), [Workflow typestate](practices/behavior/workflow-typestate.md).

- **[struct_construction:no_new](practices/modeling/struct-construction.md#no-constructor-indirection)**

  - Do not define new constructors or rename trivial construction to create.
  - Construction must keep field assignments visible.
  - Preserve validating conversions, invariant-enforcing fallible constructors,
    and legal capability transitions.

- **[struct_construction:derive_from](practices/modeling/struct-construction.md#single-field-derive-from)**

  - Derive derive_more::From with its from feature for infallible single-field wrappers.
  - Constrained wrappers use explicit classification enums; keep their fields private.

- **[struct_construction:initial_state](practices/modeling/struct-construction.md#single-field-derive-from)**

  - For generic workflows, manually implement only the allowed initial-state conversion.
  - Never derive blanket construction for advanced states.

- **[struct_construction:struct_literals](practices/modeling/struct-construction.md#multiple-fields-use-a-struct-literal)**

  - Use named struct literals for multiple independent fields.
  - Do not expose private validated capability fields to permit literals.
  - A named fallible constructor may accept one typed request to enforce an
    aggregate invariant; a renamed trivial constructor is still prohibited.


### Default values

- **File:** [Default values](practices/modeling/default-values.md).
- **Owns:** Meaningful struct defaults and enum default variants.
- **Does not own:** General construction syntax belongs to Struct construction; absence modeling belongs to Domain states.
- **Related:** [Struct construction](practices/modeling/struct-construction.md), [Domain states](practices/modeling/domain-states.md).

- **[default_values:valid_defaults](practices/modeling/default-values.md#choose-a-valid-default)**

  - Provide Default only for a meaningful valid starting value.
  - Never invent defaults for required or validated input.

- **[default_values:struct_defaults](practices/modeling/default-values.md#structs-derive-field-defaults)**

  - Derive Default when field defaults match the type semantics.
  - Use a manual implementation only for genuinely different defaults.

- **[default_values:enum_defaults](practices/modeling/default-values.md#enums-mark-the-default-variant)**

  - Use #[default] on the intended unit enum variant.
  - Implement Default manually when the default variant carries data.



## Behavior

### Function ownership

- **File:** [Function ownership](practices/behavior/function-ownership.md).
- **Owns:** Owners of methods, constants, and state; dependency direction; conversions versus operations.
- **Does not own:** Input shape belongs to API inputs; consuming updates belong to Owned updates.
- **Related:** [API inputs](practices/behavior/api-inputs.md), [Owned updates](practices/behavior/owned-updates.md), [Domain types](practices/modeling/domain-types.md).

- **[function_ownership:meaningful_owners](practices/behavior/function-ownership.md#choose-the-owner)**

  - Place every authored function on its meaningful struct, enum, or trait, including
    private/nested helpers and test fixtures.
  - Keep immediately used closures local.

- **[function_ownership:method_kinds](practices/behavior/function-ownership.md#choose-the-owner)**

  - Use receiver methods for instance behavior, associated functions for owned
    construction/stateless behavior, and traits only for genuine shared contracts or
    external interfaces.

- **[function_ownership:no_utility_containers](practices/behavior/function-ownership.md#choose-the-owner)**

  - Do not treat modules, Utils containers, empty catch-all types, or artificial
    lifecycles as meaningful ownership.

- **[function_ownership:constants_and_state](practices/behavior/function-ownership.md#own-constants-and-state)**

  - Put constants in the owner impl and mutable state in struct fields.
  - Forbid module const/static/static mut unless an exact external contract requires
    them.

- **[function_ownership:dependency_direction](practices/behavior/function-ownership.md#respect-domain-dependencies)**

  - Choose owners by knowledge and dependency direction: consumer interpretation belongs
    to the consumer.
  - Direct conversions use destination From/TryFrom.

- **[function_ownership:operations](practices/behavior/function-ownership.md#respect-domain-dependencies)**

  - Keep effectful/context-dependent policy as named operations and preserve validation
    and transition boundaries.

- **[function_ownership:boundary_functions](practices/behavior/function-ownership.md#keep-required-free-functions-at-the-boundary)**

  - Allow free compiler entrypoints, test-harness entries, and required external
    callbacks only at their exact boundary.
  - Delegate application behavior to an owner, not another free helper.
  - Test entrypoints may contain scenario setup, actions, and assertions; reusable
    test helpers belong to fixture owners.

- **[function_ownership:external_requirements](practices/behavior/function-ownership.md#keep-required-free-functions-at-the-boundary)**

  - Identify the actual compiler/harness/FFI/framework requirement.
  - Generated foreign declarations are not authored implementations, and local macros
    cannot bypass ownership.

- **[function_ownership:lint_exceptions](practices/behavior/function-ownership.md#check-ownership)**

  - Use ownership/suppression lints where available.
  - Document per-function checked FFI/framework expectations and reject blanket
    exemptions.

- **[function_ownership:lint_evidence](practices/behavior/function-ownership.md#check-ownership)**

  - Test lint exceptions against lookalike helpers and missing reasons.
  - Semantic review must still verify cohesion and behavior.

- **[function_ownership:migration](practices/behavior/function-ownership.md#check-ownership)**

  - Migrate one cohesive flow at a time, inventory construction and free functions,
    preserve unassigned ABI/wire contracts, and activate checks after migration.
  - Legacy functions are debt, not exceptions.


### API inputs

- **File:** [API inputs](practices/behavior/api-inputs.md).
- **Owns:** One non-receiver argument, semantic request types, and externally fixed signatures.
- **Does not own:** Request construction belongs to Struct construction; method placement belongs to Function ownership.
- **Related:** [Struct construction](practices/modeling/struct-construction.md), [Function ownership](practices/behavior/function-ownership.md).

- **[api_inputs:one_input](practices/behavior/api-inputs.md#one-non-receiver-input)**

  - Limit authored functions/methods/command handlers to one non-receiver input.
  - Self, &self, and &mut self do not count.

- **[api_inputs:semantic_requests](practices/behavior/api-inputs.md#required-actions)**

  - Use a semantic domain/operation request for independent inputs.
  - Pass an existing scalar newtype directly instead of wrapping one input without
    meaning.

- **[api_inputs:command_decoding](practices/behavior/api-inputs.md#required-actions)**

  - Destructure or match the request inside the owning operation.
  - Parse CLI input at the edge into one typed command.

- **[api_inputs:no_positional_bags](practices/behavior/api-inputs.md#prohibited-actions)**

  - Do not hide independent inputs in tuples/arrays/collections, generic
    Args/Params/Input/Options names, booleans, sentinels, or cross-workflow optionals.

- **[api_inputs:external_signatures](practices/behavior/api-inputs.md#fixed-signature-exceptions)**

  - Externally fixed trait/FFI/generated ABI/framework signatures may retain their
    required inputs only on the adapter.
  - Identify the contract and delegate with one named typed request.

- **[api_inputs:validation](practices/behavior/api-inputs.md#validation)**

  - Review non-receiver counts, semantic request construction, and the exact external
    justification for each retained multi-input signature.


### Workflow typestate

- **File:** [Workflow typestate](practices/behavior/workflow-typestate.md).
- **Owns:** Legal action sequencing, typed phases, consuming transitions, and private capability construction.
- **Does not own:** Runtime alternatives belong to Domain states; same-state replacement belongs to Owned updates.
- **Related:** [Domain states](practices/modeling/domain-states.md), [Owned updates](practices/behavior/owned-updates.md), [Struct construction](practices/modeling/struct-construction.md).

- **[workflow_typestate:typed_owner](practices/behavior/workflow-typestate.md#state-and-transitions)**

  - Prioritize typestate for meaningful new/changed action flows: domain-named
    owner<State>, distinct payload states, and transitions on specialized owner impls.

- **[workflow_typestate:consuming_transitions](practices/behavior/workflow-typestate.md#state-and-transitions)**

  - Consume self when a transition replaces capabilities.
  - Carry validated values forward and return exhaustive outcome enums for alternative
    next states and typed errors for failures.

- **[workflow_typestate:independent_states](practices/behavior/workflow-typestate.md#state-and-transitions)**

  - Keep independent state dimensions/domain objects separate.
  - Seal generic phases when external implementations could forge states.

- **[workflow_typestate:private_capabilities](practices/behavior/workflow-typestate.md#capability-construction)**

  - Keep advanced fields private, validate untrusted input before admitting
    capabilities, and permit construction only at allowed entry states.

- **[workflow_typestate:no_forged_capabilities](practices/behavior/workflow-typestate.md#capability-construction)**

  - Review Default/Deserialize/From/Clone/Copy for forged or duplicated capabilities.
  - Never deserialize directly into restricted states or clone one-use rights.

- **[workflow_typestate:runtime_authorization](practices/behavior/workflow-typestate.md#capability-construction)**

  - Recheck runtime authorization/freshness at effects and preserve cryptographic trust
    boundaries.
  - Typestate does not prove either.

- **[workflow_typestate:no_artificial_phases](practices/behavior/workflow-typestate.md#prohibited-actions)**

  - Do not impose a generic Session/Phase framework, optional stage field bags, or
    artificial phases on pure operations.

- **[workflow_typestate:initial_conversion](practices/behavior/workflow-typestate.md#publication-pipeline)**

  - Limit initial From to the initial state.
  - Let validated-data conversion validate and the workflow transition construct the
    advanced owner.

- **[workflow_typestate:validation](practices/behavior/workflow-typestate.md#validation)**

  - Migrate a focused flow without unrelated rewrites.
  - Test every outcome, typed failure, invalid input, secret destruction, and
    compile-time rejection of illegal construction/order/reuse.


### Owned updates

- **File:** [Owned updates](practices/behavior/owned-updates.md).
- **Owns:** Consuming replacement and justified in-place mutation.
- **Does not own:** Phase transitions belong to Workflow typestate; operation placement belongs to Function ownership.
- **Related:** [Workflow typestate](practices/behavior/workflow-typestate.md), [Function ownership](practices/behavior/function-ownership.md).

- **[owned_updates:consume_replacement](practices/behavior/owned-updates.md#replace-an-owned-value)**

  - Consume mut self for replacement updates and return Self or a typed result while
    preserving unchanged fields.
  - Prohibit borrowed mutation on authored value-update APIs, including private
    collection helpers and equivalent helpers taking &mut Owner.
  - Mark replacements must_use and rebind, chain, or fold their returned owners.
    Local mutation inside the consuming method remains permitted.

- **[owned_updates:external_mutation](practices/behavior/owned-updates.md#required-actions)**

  - Retain &mut self only at a required trait or externally owned mutation boundary with
    its exact justification.

- **[owned_updates:no_fake_actors](practices/behavior/owned-updates.md#required-actions)**

  - Do not add fake phases or actors to avoid a value update.
  - Use channels only for a real actor/concurrent owner.

- **[owned_updates:validation](practices/behavior/owned-updates.md#validation)**

  - Verify the previous value is consumed and all unaffected fields are preserved.


### Error handling

- **File:** [Error handling](practices/behavior/error-handling.md).
- **Owns:** Typed failures and sources, propagation, panic restrictions, and test error contracts.
- **Does not own:** Nonfailure alternatives belong to Domain states; decoding representations belongs to Serialization boundaries.
- **Related:** [Domain states](practices/modeling/domain-states.md), [Serialization boundaries](practices/boundaries/serialization-boundaries.md), [Rust testing](practices/tooling/rust-testing.md).

- **[error_handling:typed_failures](practices/behavior/error-handling.md#required-actions)**

  - Return standard Result and concrete operation-specific thiserror failures in
    production libraries, binaries, examples, and build scripts.

- **[error_handling:source_conversion](practices/behavior/error-handling.md#add-context-only-when-it-changes-the-error)**

  - Preserve typed sources.
  - Use #[from] and ? for direct conversion, map_err for added context or selection
    among same-source variants.

- **[error_handling:required_input](practices/behavior/error-handling.md#required-actions)**

  - Return a typed failure for missing/invalid required input.
  - Never erase the source into a string.

- **[error_handling:no_panics](practices/behavior/error-handling.md#propagate-errors-instead-of-panicking)**

  - Prohibit unwrap, expect, and expect_err throughout authored Rust, including fixture
    setup and tests.

- **[error_handling:test_errors](practices/behavior/error-handling.md#keep-anyhow-in-tests)**

  - Fallible tests return concrete Result or anyhow::Result and use ?.
  - Anyhow is test-only under dev-dependencies, not production or a Box<dyn Error>
    substitute.

- **[error_handling:codec_errors](practices/behavior/error-handling.md#required-actions)**

  - Use serde_json::Result when encoding/decoding JSON is the only failure.

- **[error_handling:error_tests](practices/behavior/error-handling.md#validation)**

  - Test expected error variants explicitly.
  - Deny unwrap_used/expect_used for all targets and keep their test allowances false.

- **[error_handling:enforcement](practices/behavior/error-handling.md#validation)**

  - Check production anyhow paths and dependency placement with available preflight
    tooling.
  - Do not duplicate Clippy using a bespoke scanner.



## Boundaries

### Serialization boundaries

- **File:** [Serialization boundaries](practices/boundaries/serialization-boundaries.md).
- **Owns:** Typed decoding/encoding, erased-value restrictions, dependency conversion, and serialization tests.
- **Does not own:** Object ownership belongs to WASM contracts; wire-name mapping belongs to WASM name coherence.
- **Related:** [Domain types](practices/modeling/domain-types.md), [Error handling](practices/behavior/error-handling.md), [WASM contracts](practices/boundaries/wasm-contracts.md), [WASM name coherence](practices/boundaries/rust-wasm-name-coherence.md).

- **[serialization_boundaries:typed_decoding](practices/boundaries/serialization-boundaries.md#decode-known-schemas-into-their-types)**

  - Decode known schemas directly into concrete records/enums at the I/O edge.
  - JSON trees, dyn Any, erased bags, and generic maps are not domain models.

- **[serialization_boundaries:validated_deserialization](practices/boundaries/serialization-boundaries.md#decode-known-schemas-into-their-types)**

  - Preserve validated newtype invariants during Deserialize.
  - An automatic derive must not bypass validating construction.

- **[serialization_boundaries:typed_construction](practices/boundaries/serialization-boundaries.md#construct-known-documents-from-typed-values)**

  - Construct known JSON/YAML from structs and enums, including catalog examples
    and valid fixtures; encode only at I/O.
  - Prohibit YAML string literals/fragments, string assembly, replacement, and
    encode-then-parse construction, including static discovery examples;
    text wrappers do not provide schema safety.
  - Keep malformed inputs raw at the decoder and dynamic values inside explicitly
    open extensions.

- **[serialization_boundaries:derive_first](practices/boundaries/serialization-boundaries.md#derive-serialization-instead-of-writing-boilerplate)**

  - Derive serialization and preserve enums in new owned wire contracts.
  - Apply domain-state exceptions before using boolean conversion attributes.
  - Prohibit handwritten traits, visitors, and callbacks that duplicate this support.
  - Classify raw wrapper input in an enum; Serde may use an enum-to-value TryFrom
    adapter to satisfy its required Result interface, never a raw-input validator.
  - Document unsupported contracts and evaluate established adapters before custom machinery.
  - Review manually and test wire values; standard Clippy does not enforce this rule.

- **[serialization_boundaries:typed_storage](practices/boundaries/serialization-boundaries.md#keep-encoding-out-of-application-state)**

  - Store and return typed records internally.
  - Keep raw JSON/YAML at I/O and encode only for an external consumer requiring it.

- **[serialization_boundaries:no_erased_values](practices/boundaries/serialization-boundaries.md#generate-typed-javascript-contracts)**

  - Prohibit authored JsValue/js_sys::Object fields, signatures, aliases, or stored
    state, including tests.
  - Wrappers, casts, and TS type hints cannot restore an erased contract.

- **[serialization_boundaries:typed_abi](practices/boundaries/serialization-boundaries.md#generate-typed-javascript-contracts)**

  - Generate structural ABI from canonical typed declarations with Tsify.
  - Use Ts<T> and fallible to_rust conversion rather than deprecated leaking ABI
    attributes.

- **[serialization_boundaries:tsify_support](practices/boundaries/serialization-boundaries.md#generate-typed-javascript-contracts)**

  - Use the js feature for the illustrated Tsify JavaScript binding.
  - Do not create a second domain copy just to derive ABI support.

- **[serialization_boundaries:no_absence_overrides](practices/boundaries/serialization-boundaries.md#generate-typed-javascript-contracts)**

  - Do not override fields with undefined/null/void unions.
  - Normal TypeScript void effect returns remain valid.

- **[serialization_boundaries:dependency_decoding](practices/boundaries/serialization-boundaries.md#convert-dependency-owned-values-immediately)**

  - Decode dependency-owned JS values immediately into the expected record and preserve
    typed conversion errors.
  - Do not forward erased values into application APIs.

- **[serialization_boundaries:typed_tests](practices/boundaries/serialization-boundaries.md#test-the-typed-contract)**

  - Test concrete typed round trips and invalid-input rejection.
  - Use raw JSON/YAML only for malformed/unknown input or exact property presence, never
    instead of a typed domain assertion.

- **[serialization_boundaries:validation](practices/boundaries/serialization-boundaries.md#validation)**

  - Review ABI overrides and conversion sites, run serialization tests, and
    regenerate/type-check changed bindings.


### Rust–TypeScript separation

- **File:** [Rust–TypeScript separation](practices/boundaries/rust-typescript-code-separation.md).
- **Owns:** Allocation of product policy, browser observation, presentation, and bridge responsibilities.
- **Does not own:** ABI representation belongs to WASM contracts; framework state handling belongs to WASM UI integration.
- **Related:** [WASM contracts](practices/boundaries/wasm-contracts.md), [WASM UI integration](practices/boundaries/wasm-ui-integration.md).

- **[code_separation:ownership](practices/boundaries/rust-typescript-code-separation.md#application-structure)**

  - In Rust/WASM projects, Rust owns portable product data/decisions.
  - This cross-language rule does not require Rust in TypeScript-only projects.
  - TypeScript owns presentation and browser lifecycle.
  - The bridge owns JS conversion and storage/provider adapters.

- **[code_separation:extensions](practices/boundaries/rust-typescript-code-separation.md#application-structure)**

  - Apply the same ownership split to extensions.
  - Illustrative package names do not impose repository names.

- **[code_separation:core_contracts](practices/boundaries/rust-typescript-code-separation.md#define-product-contracts-in-rust)**

  - Define workflow stages, commands, outcomes, persistence schemas, and validation in
    Rust.
  - Consumers construct/render generated types rather than redeclaring them.

- **[code_separation:abandoned_state](practices/boundaries/rust-typescript-code-separation.md#define-product-contracts-in-rust)**

  - Remove abandoned write-only/constant state rather than exporting it.

- **[code_separation:core_annotations](practices/boundaries/rust-typescript-code-separation.md#define-product-contracts-in-rust)**

  - Core types may carry serialization/binding annotations but not browser I/O, session
    state, or WASM-specific behavior.

- **[code_separation:observation_policy](practices/boundaries/rust-typescript-code-separation.md#separate-observation-from-policy)**

  - TypeScript gathers observations and executes browser actions.
  - Rust classifies portable decisions.
  - Move policy out of TS conditions/validators/searches, not merely into another TS
    file.

- **[code_separation:browser_adapters](practices/boundaries/rust-typescript-code-separation.md#separate-observation-from-policy)**

  - Keep durable I/O in bridge adapters where Rust has stable abstractions.
  - Use established browser crates and isolate unavoidable direct Web API calls.

- **[code_separation:visual_state](practices/boundaries/rust-typescript-code-separation.md#keep-visual-state-in-typescript)**

  - Keep visual panels/tabs/form drafts, labels, props, URL/viewport state, and DOM
    lifecycle in TypeScript.

- **[code_separation:validation](practices/boundaries/rust-typescript-code-separation.md#validation)**

  - Test portable decisions in Rust, generated transport at the bridge, and affected
    consumers together.
  - Browser E2E is not domain proof.


### WASM contracts

- **File:** [WASM contracts](practices/boundaries/wasm-contracts.md).
- **Owns:** Generated classes versus structural DTOs, canonical enum exports, nominal identifiers, and object lifetime.
- **Does not own:** Decoding failures belong to Serialization boundaries; reactive wrappers belong to WASM UI integration.
- **Related:** [Serialization boundaries](practices/boundaries/serialization-boundaries.md), [WASM UI integration](practices/boundaries/wasm-ui-integration.md), [Domain types](practices/modeling/domain-types.md).

- **[wasm_contracts:abi](practices/boundaries/wasm-contracts.md#construct-what-the-abi-declares)**

  - Follow the generated ABI: actual wasm-bindgen instances for class inputs and
    generated structural objects for Tsify Ts<T> inputs.
  - Assertions cannot create allocations.

- **[wasm_contracts:construction](practices/boundaries/wasm-contracts.md#construct-what-the-abi-declares)**

  - Obtain new class instances through generated construction APIs.
  - Do not wrap structural DTOs in unnecessary classes.

- **[wasm_contracts:canonical_enums](practices/boundaries/wasm-contracts.md#export-canonical-enums-without-mirrors)**

  - Export canonical supported fieldless enums directly.
  - Use typed structural ABI or thin required wrappers for payload enums without copying
    vocabulary or changing validation/payload shape.

- **[wasm_contracts:nominal_identifiers](practices/boundaries/wasm-contracts.md#verify-generated-identifier-types)**

  - Verify identifiers are actually nominal/opaque/class-backed.
  - String aliases do not prevent swaps.
  - Fix the binding representation rather than inventing local mirrors or cast brands.

- **[wasm_contracts:retained_values](practices/boundaries/wasm-contracts.md#give-retained-objects-one-owner)**

  - Retain generated objects in UI state/props instead of equivalent summaries made
    solely to free wrappers.
  - Separate view models require genuinely different UI concerns.

- **[wasm_contracts:ownership](practices/boundaries/wasm-contracts.md#give-retained-objects-one-owner)**

  - Give each allocation one owner.
  - Borrowed calls preserve ownership and consuming calls transfer it.
  - Never use or free a moved or borrowed object as its owner.

- **[wasm_contracts:replacement](practices/boundaries/wasm-contracts.md#give-retained-objects-one-owner)**

  - Release replaced/reset/teardown objects exactly once after final use.
  - Replacement examples require distinct instances and no remaining borrowers.

- **[wasm_contracts:validation](practices/boundaries/wasm-contracts.md#validation)**

  - Test actual generated shapes, nominal incompatibility, replacement/reset/transfer,
    leaks and double frees.
  - Build WASM and type-check consumers.


### WASM UI integration

- **File:** [WASM UI integration](practices/boundaries/wasm-ui-integration.md).
- **Owns:** Reactive DTOs, instance preservation, and Svelte/Vue/React integration at the UI caller.
- **Does not own:** Allocation ownership belongs to WASM contracts; portable policy placement belongs to Rust–TypeScript separation.
- **Related:** [WASM contracts](practices/boundaries/wasm-contracts.md), [Rust–TypeScript separation](practices/boundaries/rust-typescript-code-separation.md).

- **[wasm_ui_integration:typed_values](practices/boundaries/wasm-ui-integration.md#pass-the-declared-value-without-cloning-it)**

  - Pass plain structural DTOs directly and unwrap reactive DTOs only when required at
    the WASM boundary.
  - Preserve generated class identity.

- **[wasm_ui_integration:no_cloning](practices/boundaries/wasm-ui-integration.md#pass-the-declared-value-without-cloning-it)**

  - Do not JSON-round-trip, spread, deep-clone, or cast a generated object to remove
    reactivity.
  - JSON belongs only at real JSON edges.

- **[wasm_ui_integration:svelte_state](practices/boundaries/wasm-ui-integration.md#svelte)**

  - In Svelte, snapshot reactive DTOs at the rune-owning caller and bind them to
    explicitly typed locals before ordinary API calls. Use $state.raw for
    replace-only DTOs, and restrict .svelte.ts to modules owning runes.

- **[wasm_ui_integration:svelte_boundaries](practices/boundaries/wasm-ui-integration.md#svelte)**

  - Do not make domain/action modules depend on the Svelte compiler just to snapshot
    state.
  - Snapshots do not replace WASM instances.

- **[wasm_ui_integration:vue](practices/boundaries/wasm-ui-integration.md#vue)**

  - In Vue, retain WASM instances in shallowRef or markRaw inside reactive objects.
  - Pass the instance and treat toRaw as nonrecursive for nested proxies.

- **[wasm_ui_integration:react](practices/boundaries/wasm-ui-integration.md#react)**

  - In React, pass plain DTOs and original instances.
  - Use state for render-driving replacement and ref for non-render handles.
  - Acquire/release owned resources in lifecycle, not render.

- **[wasm_ui_integration:caller_adaptation](practices/boundaries/wasm-ui-integration.md#keep-ui-adaptation-at-the-caller)**

  - Do not add state/action forwarding wrappers with no responsibility.
  - Retain methods only for real validation, lifecycle, or conversion.
  - UI proxy removal belongs at the caller.

- **[wasm_ui_integration:validation](practices/boundaries/wasm-ui-integration.md#validation)**

  - Test reactive submission, instance identity, replacement/teardown, and framework
    type checks.
  - Borrowed samples do not grant cleanup ownership.


### WASM and command name coherence

- **File:** [WASM name coherence](practices/boundaries/rust-wasm-name-coherence.md).
- **Owns:** Cross-language symbol names, command identities, and fixed external wire-name exceptions.
- **Does not own:** Value representations belong to Domain types; decoding mechanics belong to Serialization boundaries.
- **Related:** [Domain types](practices/modeling/domain-types.md), [Serialization boundaries](practices/boundaries/serialization-boundaries.md).

- **[wasm_name_coherence:same_names](practices/boundaries/rust-wasm-name-coherence.md#preserve-imported-and-exported-names)**

  - For project-owned Rust/WASM/TS contracts preserve type, method, property, field, and
    variant names.
  - JavaScript casing is not grounds for renaming.

- **[wasm_name_coherence:no_aliases](practices/boundaries/rust-wasm-name-coherence.md#preserve-imported-and-exported-names)**

  - Prohibit generated import/re-export aliases and local type aliases that rename the
    contract.

- **[wasm_name_coherence:export_names](practices/boundaries/rust-wasm-name-coherence.md#preserve-method-and-property-names)**

  - Do not use js_name to rename Rust exports.
  - Getters and setters retain the canonical field name.

- **[wasm_name_coherence:serialization_names](practices/boundaries/rust-wasm-name-coherence.md#preserve-fields-and-enum-variants)**

  - Do not add serde rename/rename_all to project-owned schemas, rebuild case-renamed
    objects, or rename destructured fields.

- **[wasm_name_coherence:command_names](practices/boundaries/rust-wasm-name-coherence.md#preserve-command-identities)**

  - Use descriptive Rust variants directly as command identities in YAML/JSON,
    discovery, and consumers; no invented dotted aliases or casing transforms.
  - Load this rule for CLI/discovery work even without WASM or TypeScript.
  - Generate examples from the enum, update callers/docs together, and require a
    concrete external contract for any unavoidable adapter.

- **[wasm_name_coherence:command_groups](practices/boundaries/rust-wasm-name-coherence.md#group-operations-by-their-owning-domain)**

  - Aggregate related operations in domain-specific enums carried by enclosing
    group variants; do not flatten repeated prefixes/suffixes or allow arbitrary
    group/operation pairs.
  - Preserve groups through requests, schemas, discovery, and consumers; dispatch
    exhaustively through the owning enum and reject mismatched groups at decoding.

- **[wasm_name_coherence:external_names](practices/boundaries/rust-wasm-name-coherence.md#map-fixed-external-names-only-at-the-adapter)**

  - For a fixed external protocol, retain Rust naming and map its exact wire key only in
    the external adapter.
  - Do not suppress Rust naming lints or spread external names into domain APIs.

- **[wasm_name_coherence:migrations](practices/boundaries/rust-wasm-name-coherence.md#map-fixed-external-names-only-at-the-adapter)**

  - Preserve established persisted/published wire names until the owning migration
    authorizes change.
  - Keep compatibility mappings at that boundary.

- **[wasm_name_coherence:validation](practices/boundaries/rust-wasm-name-coherence.md#validation)**

  - Inventory aliases/js_name/serialization mappings, identify the external owner for
    every exception, regenerate names, and test consumers and migrations.



## Tooling

### Rust code checks

- **File:** [Rust code checks](practices/tooling/rust-code-checks.md).
- **Owns:** Mandatory formatting, compilation, Clippy, warning correction, and check evidence.
- **Does not own:** Behavioral tests and coverage belong to Rust testing; pipeline implementation belongs to the CI/CD owner.
- **Related:** [Rust testing](practices/tooling/rust-testing.md), [Paths and imports](practices/tooling/path-imports.md), [Error handling](practices/behavior/error-handling.md).

- **[code_checks:establish](practices/tooling/rust-code-checks.md#establish-repeatable-checks)**

  - Establish repeatable fmt, check, and Clippy gates in existing project tooling.
  - Cover workspace members, all applicable targets, and supported feature/target
    configurations; preserve build flags and deny compiler and Clippy warnings.
  - Coordinate pipeline changes with the CI/CD owner under the active mode.
  - Complete the mandatory domain-type review as well as mechanical gates.

- **[code_checks:lint_baseline](practices/tooling/rust-code-checks.md#enforce-the-lint-baseline)**

  - Deny targeted boolean, ignored-result/future, replacement-value, unit-error,
    wildcard-enum, argument-count, and nesting lints alongside existing checks.
  - Apply the prescribed thresholds; review authored Option usage separately.
  - Review semantic gaps; Clippy counts receivers and structural nesting.

- **[code_checks:fix_diagnostics](practices/tooling/rust-code-checks.md#fix-diagnostics-before-completion)**

  - Fix formatting and all encountered compilation/lint warnings, including
    pre-existing ones, then rerun checks after the final edit alongside required tests.
  - Do not suppress diagnostics or ignore failures to pass checks; repair dependency
    or generator causes through their owners and report out-of-scope repairs as blockers.
  - Inspect Cargo and build-script output even when compiler warnings are denied.

- **[code_checks:evidence](practices/tooling/rust-code-checks.md#report-verification-evidence)**

  - Report actual commands, roots, configurations, and results; all three checks
    must succeed without warnings before completion.
  - Missing tooling, unverified required configurations, and unresolved diagnostics
    block verification rather than count as success.
  - Report semantic domain-review scope and unresolved findings separately.

### Libraries

- **File:** [Libraries](practices/tooling/libraries.md).
- **Owns:** Required core crates and capability-specific library choices.
- **Does not own:** Dependency adoption thresholds belong to Dependency selection; library usage rules stay with their subjects.
- **Related:** [Dependency selection](practices/tooling/dependency-selection.md), [Error handling](practices/behavior/error-handling.md), [Serialization boundaries](practices/boundaries/serialization-boundaries.md).

- **[libraries:required_core](practices/tooling/libraries.md#required-core)**

  - Use serde, thiserror, derive_more, and tracing as required core libraries.
  - Enable used features and declare each dependency only in crates that use it.

- **[libraries:no_custom_commodity](practices/tooling/libraries.md#required-core)**

  - Do not handwrite commodity serialization/error/conversion machinery or log with
    println.
  - Ordinary CLI output may use println.

- **[libraries:concurrency](practices/tooling/libraries.md#concurrency)**

  - Use Tokio for native asynchronous execution and Flume for typed sync/async channels.
  - Avoid polling queues and blocking async workers on channel waits.

- **[libraries:networking](practices/tooling/libraries.md#web-and-networking)**

  - Use Reqwest for clients and Axum for native servers.
  - Browser WASM is a client, not an Axum server.

- **[libraries:wasm_contracts](practices/tooling/libraries.md#rustjavascript-contracts)**

  - Use wasm-bindgen and Tsify for generated contracts, serde-wasm-bindgen only for
    necessary external conversion, and wasm-bindgen-futures for the browser event loop.

- **[libraries:browser_storage](practices/tooling/libraries.md#browser-apis-and-storage)**

  - Use gloo-file with futures for async file work, gloo-storage for typed storage,
    gloo-utils for browser utilities, and Rexie for IndexedDB.

- **[libraries:direct_browser_bindings](practices/tooling/libraries.md#browser-apis-and-storage)**

  - Use web-sys/js-sys only where higher-level adapters do not cover the API.
  - Enable the version-appropriate browser getrandom backend for secure randomness.

- **[libraries:diagnostics](practices/tooling/libraries.md#diagnostics-and-tests)**

  - Use tracing-web with tracing-subscriber for browser diagnostics and
    wasm-bindgen-test as a dev dependency for WASM tests.

- **[libraries:typed_boundaries](practices/tooling/libraries.md#diagnostics-and-tests)**

  - Do not hand-mirror contracts, serialize through JSON just to cross WASM, or spread
    low-level browser binding calls through domain code.


### Module layout

- **File:** [Module layout](practices/tooling/module-layout.md).
- **Owns:** Module filenames, child-directory layout, and path updates during module moves.
- **Does not own:** Domain ownership belongs to Domain types; inline test placement belongs to Rust testing.
- **Related:** [Domain types](practices/modeling/domain-types.md), [Rust testing](practices/tooling/rust-testing.md), [Paths and imports](practices/tooling/path-imports.md).

- **[module_layout:named_files](practices/tooling/module-layout.md#use-named-module-files)**

  - Use `<module>.rs` with children under `<module>/`; prohibit authored `mod.rs`
    files, including declaration-only modules and test support.
  - Retain crate/test entry points, inline modules, and externally owned layouts.

- **[module_layout:preserve_resolution](practices/tooling/module-layout.md#preserve-resolution-when-moving-modules)**

  - Move owners without changing module identity, visibility, re-exports, or tests.
  - Update file-relative includes, explicit paths, and repository references;
    do not leave forwarding files or hide old layouts behind path attributes.

- **[module_layout:validation](practices/tooling/module-layout.md#validation)**

  - Inventory all authored module files and run compiler, Clippy, formatting,
    and affected tests to verify resolution, embedded assets, and public behavior.


### Paths and imports

- **File:** [Paths and imports](practices/tooling/path-imports.md).
- **Owns:** Use-site path qualification and import conventions.
- **Does not own:** Cross-language renaming belongs to WASM name coherence; domain module placement belongs to Domain types.
- **Related:** [WASM name coherence](practices/boundaries/rust-wasm-name-coherence.md), [Domain types](practices/modeling/domain-types.md).

- **[path_imports:two_segments](practices/tooling/path-imports.md#required-actions)**

  - Keep every non-use path to at most two segments.
  - Import the owner when needed and retain meaningful module/type qualification.

- **[path_imports:all_roots](practices/tooling/path-imports.md#prohibited-actions)**

  - Apply the limit to crate/self/super/std/core/alloc and relative paths too.
  - Do not import a required boundary free function bare.

- **[path_imports:qualified_functions](practices/tooling/path-imports.md#examples)**

  - For UTF-8 use imported std::str with str::from_utf8, not a three-segment path or
    unqualified function.

- **[path_imports:validation](practices/tooling/path-imports.md#validation)**

  - Deny clippy::absolute_paths with absolute-paths-max-segments = 2 at each applicable
    configuration boundary.
  - Review relative paths and semantic context separately.


### Typed SQL construction

- **File:** [Typed SQL construction](practices/boundaries/typed-sql.md).
- **Owns:** Typed schema/query construction, identifiers, binding, and driver boundaries.
- **Related:** [Dependency selection](practices/tooling/dependency-selection.md), [Domain types](practices/modeling/domain-types.md).

- **[typed_sql:construction](practices/boundaries/typed-sql.md)**

  - Use established builders/ORMs and identifier enums for schemas, migrations,
    queries, and fixtures; never assemble SQL as application text.
  - Bind runtime values, use driver transaction/settings APIs, and isolate only
    documented fixed dialect tokens unsupported by the builder.
  - Verify actual database constraints and transactions; builder types alone do
    not prove schema compatibility or application correctness.

### Dependency selection

- **File:** [Dependency selection](practices/tooling/dependency-selection.md).
- **Owns:** Rust ecosystem adoption thresholds and dependency verification.
- **Does not own:** The prescribed crate catalog belongs to Libraries.
- **Related:** [Libraries](practices/tooling/libraries.md).

- **[dependency_selection:thresholds](practices/tooling/dependency-selection.md#adoption-thresholds)**

  - Require at least 50,000 total and 1,000 recent crates.io downloads, plus 100 GitHub
    stars when a repository exists.

- **[dependency_selection:verification](practices/tooling/dependency-selection.md#adoption-thresholds)**

  - Inspect manifests and verify adoption counts when adding/reviewing dependencies.
  - Retain common exclusions for generated bindings and toolchain-pinned packages.


### Macro minimization

- **File:** [Macro minimization](practices/tooling/rust-macro-minimization.md).
- **Owns:** Authored macro restrictions and permitted ecosystem/compiler cases.
- **Does not own:** Crate choice belongs to Libraries; example semantics stay with the modeled subject.
- **Related:** [Libraries](practices/tooling/libraries.md), [Struct construction](practices/modeling/struct-construction.md).

- **[macro_minimization:no_local_macros](practices/tooling/rust-macro-minimization.md#keep-routine-code-explicit)**

  - Prohibit repository-defined declarative/exported/procedural macros for routine
    types, impls, errors, conversions, and control flow across
    product/tooling/test/build code.

- **[macro_minimization:explicit_mappings](practices/tooling/rust-macro-minimization.md#keep-domain-mappings-in-their-destination-impl)**

  - Prefer explicit Rust even with small repetition.
  - Inspect external macros when ordinary code would be clearer.

- **[macro_minimization:ecosystem_macros](practices/tooling/rust-macro-minimization.md#keep-approved-ecosystem-macros)**

  - Allow required compiler/ecosystem derives/attributes, derive_more::From, standard
    formatting/logging/assertion/collection macros, and genuine external code-generation
    products.
  - Generated/vendor source is excluded.

- **[macro_minimization:safe_replacement](practices/tooling/rust-macro-minimization.md#replace-a-macro-without-changing-its-contract)**

  - Inventory definitions and call sites, expand redundant macros, preserve
    wire/API/error behavior, and validate syntax/behavior.
  - Any remaining authored definition needs a documented architecture exception.


### Rust testing

- **File:** [Rust testing](practices/tooling/rust-testing.md).
- **Owns:** Rust test placement, boundary coverage, and coverage requirements.
- **Does not own:** Test error propagation belongs to Error handling; serialization assertions belong to Serialization boundaries.
- **Related:** [Error handling](practices/behavior/error-handling.md), [Serialization boundaries](practices/boundaries/serialization-boundaries.md).

- **[testing:domain_and_boundary](practices/tooling/rust-testing.md#domain-and-boundary-tests)**

  - Place the overwhelming majority of functional domain proof in portable Rust
    unit/property tests.
  - WASM tests cover typed browser boundaries without duplicating algorithms.

- **[testing:colocation](practices/tooling/rust-testing.md#test-placement)**

  - Keep unit tests inline in the focused implementation module.
  - Crate tests/ integration files exercise public boundaries, not relabeled unit tests.
  - Test-harness entrypoints may contain scenario steps and assertions; reusable
    test helpers remain on fixtures and never duplicate production algorithms.

- **[testing:no_size_evasion](practices/tooling/rust-testing.md#split-production-ownership-before-tests)**

  - Split production ownership before colocating tests.
  - Forbid external unit-test files and test extraction to evade the 1,000-line limit.

- **[testing:coverage](practices/tooling/rust-testing.md#90-rust-line-coverage-floor)**

  - Measure portable crates together against a committed 90% line-coverage floor.
  - Add tests in the same task below it and prioritize behavior rather than marginal
    coverage above it.

- **[testing:regression_first](practices/tooling/rust-testing.md#regression-tests-precede-the-fix)**

  - Write colocated domain regressions before fixes, test narrow WASM boundaries for
    bridge defects, and cover both contract and user flow for cross-layer defects.

- **[testing:evidence](practices/tooling/rust-testing.md#validation-evidence)**

  - Report Rust test results and combined portable coverage against the 90% floor.
  - Identify checks not run and do not infer coverage from passing tests.



## Cross-rule consistency checks

Use these checks when a change touches both subjects. They describe how the
linked rules apply together; the source practices remain authoritative.

### External inputs stop at the conversion boundary

Check the destination type and its stored fields after converting a dependency-owned
value.

- **Prohibited:** `From<bool>` produces an application struct that still stores the raw
  flag.
- **Preferred:** `From<bool>` produces a domain enum; converting an external record
  converts each field into its owned domain type.

**Compare:**

- [domain_types:external_conversions](practices/modeling/domain-types.md#external-raw-values)
- [domain_states:boolean_conversion](practices/modeling/domain-states.md#convert-external-records-into-owned-types)
- [domain_states:external_records](practices/modeling/domain-states.md#convert-external-records-into-owned-types)

### Construction preserves validation and dependency direction

Check whether construction is infallible, requires validation, or performs an operation.

- **Prohibited:** Derive `From` for a constrained value to avoid reporting validation
  errors, or put consuming-domain policy on the source type.
- **Preferred:** The destination owns `From` for infallible conversion/classification and `TryFrom`
  for genuine representation conversion. Constrained wrappers use explicit enums;
  context-dependent policy stays a named operation.

**Compare:**

- [domain_types:conversion_traits](practices/modeling/domain-types.md#standard-conversions)
- [domain_types:operation_boundaries](practices/modeling/domain-types.md#standard-conversions)
- [function_ownership:dependency_direction](practices/behavior/function-ownership.md#respect-domain-dependencies)
- [struct_construction:derive_from](practices/modeling/struct-construction.md#single-field-derive-from)

### Construction cannot skip workflow states

Check whether a literal or conversion can create an advanced state without its required
transition.

- **Prohibited:** A blanket `From<State>` implementation lets callers construct an
  approved publication directly.
- **Preferred:** Expose only the initial-state conversion; keep advanced capability
  construction private to legal transitions.

**Compare:**

- [struct_construction:initial_state](practices/modeling/struct-construction.md#single-field-derive-from)
- [struct_construction:struct_literals](practices/modeling/struct-construction.md#multiple-fields-use-a-struct-literal)
- [workflow_typestate:no_forged_capabilities](practices/behavior/workflow-typestate.md#capability-construction)

### Missing required input is a failure

Check whether absence is a legitimate domain state or invalid input to a required value.

- **Prohibited:** Replace a missing required identifier with a successful `Missing`
  variant merely to avoid `Option`.
- **Preferred:** Reject the missing identifier with a typed error. Use named states for
  legitimate alternatives, such as an unfinished draft.

**Compare:**

- [domain_states:required_values](practices/modeling/domain-states.md#require-values-that-cannot-be-absent)
- [domain_states:drafts](practices/modeling/domain-states.md#require-values-that-cannot-be-absent)
- [error_handling:required_input](practices/behavior/error-handling.md#required-actions)

### Typed transport must match the actual ABI

Compare the generated declaration with the value constructed and passed by the caller.

- **Prohibited:** Treat a structural transport record as a WASM class, or replace a
  generated typed contract with authored `JsValue`.
- **Preferred:** Pass the declared typed record for a structural ABI; use an actual
  exported instance when the API requires a class.

**Compare:**

- [serialization_boundaries:typed_abi](practices/boundaries/serialization-boundaries.md#generate-typed-javascript-contracts)
- [wasm_contracts:abi](practices/boundaries/wasm-contracts.md#construct-what-the-abi-declares)
- [wasm_contracts:construction](practices/boundaries/wasm-contracts.md#construct-what-the-abi-declares)

### External spelling does not rename application contracts

Check who controls the protocol before introducing a field rename or type alias.

- **Prohibited:** Rename project-owned `order_id` to `orderId` across WASM, or alias its
  domain identifier to a primitive.
- **Preferred:** Keep project-owned names and domain types intact. Map a fixed external
  `orderId` to Rust `order_id` only in its adapter.

**Compare:**

- [wasm_name_coherence:same_names](practices/boundaries/rust-wasm-name-coherence.md#preserve-imported-and-exported-names)
- [wasm_name_coherence:external_names](practices/boundaries/rust-wasm-name-coherence.md#map-fixed-external-names-only-at-the-adapter)
- [domain_types:wasm_values](practices/modeling/domain-types.md#wasm--js-boundary)

### UI state does not transfer WASM ownership

Check allocation ownership when a component retains, replaces, or releases a WASM value.

- **Prohibited:** Clone a WASM class through JSON for reactive state, or free an object
  merely because a borrowing component unmounted.
- **Preferred:** Retain the declared value and let its allocation owner perform
  replacement and cleanup; framework refs do not create ownership.

**Compare:**

- [wasm_contracts:ownership](practices/boundaries/wasm-contracts.md#give-retained-objects-one-owner)
- [wasm_contracts:replacement](practices/boundaries/wasm-contracts.md#give-retained-objects-one-owner)
- [wasm_ui_integration:no_cloning](practices/boundaries/wasm-ui-integration.md#pass-the-declared-value-without-cloning-it)

### Approved derives do not justify local macros

Check whether the macro is an approved ecosystem tool or an authored abstraction hiding
routine code.

- **Prohibited:** Use the required `derive_more` dependency as justification for a local
  domain-mapping macro.
- **Preferred:** Use approved derives for their supported jobs; write domain mappings
  explicitly in the destination implementation.

**Compare:**

- [libraries:required_core](practices/tooling/libraries.md#required-core)
- [macro_minimization:explicit_mappings](practices/tooling/rust-macro-minimization.md#keep-domain-mappings-in-their-destination-impl)
- [macro_minimization:ecosystem_macros](practices/tooling/rust-macro-minimization.md#keep-approved-ecosystem-macros)

### Coverage does not relax test code rules

Review fixture setup and test placement when adding tests to meet the coverage floor.

- **Prohibited:** Use `unwrap()` in fixture setup or extract inline tests solely to get
  their source file below the size limit.
- **Preferred:** Propagate setup errors from fallible tests. Split production ownership
  and colocate tests before measuring combined coverage.

**Compare:**

- [error_handling:no_panics](practices/behavior/error-handling.md#propagate-errors-instead-of-panicking)
- [testing:no_size_evasion](practices/tooling/rust-testing.md#split-production-ownership-before-tests)
- [testing:coverage](practices/tooling/rust-testing.md#90-rust-line-coverage-floor)
