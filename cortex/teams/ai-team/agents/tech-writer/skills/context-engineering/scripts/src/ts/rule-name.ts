// Rule identities grouped by namespace; serialized catalog IDs remain unchanged.

export enum TechWriterRule {
  Communication = "tech_writer:communication",
  ContextPrerequisite = "tech_writer:context_prerequisite",
  CodePrerequisite = "tech_writer:code_prerequisite",
  DeliveryPrerequisite = "tech_writer:delivery_prerequisite",
  ProgrammingPrerequisite = "tech_writer:programming_prerequisite",
  SecurityPrerequisite = "tech_writer:security_prerequisite",
  SubjectPolicy = "tech_writer:subject_policy",
  GraphSync = "tech_writer:graph_sync",
  ExamplesAndCallers = "tech_writer:examples_and_callers",
  Reporting = "tech_writer:reporting",
  AgentPlacement = "tech_writer:agent_placement",
  SkillPlacement = "tech_writer:skill_placement",
  PracticeOwnership = "tech_writer:practice_ownership",
  RoleSkillBoundary = "tech_writer:role_skill_boundary",
  SkillMoves = "tech_writer:skill_moves",
  SharedKnowledge = "tech_writer:shared_knowledge",
  TeamNavigation = "tech_writer:team_navigation",
  SkillCatalogs = "tech_writer:skill_catalogs",
  NoScaffolding = "tech_writer:no_scaffolding",
  LanguageIndependence = "tech_writer:language_independence",
  ContextFormats = "tech_writer:context_formats",
  ImplementationBoundary = "tech_writer:implementation_boundary",
}

export enum ContextEngineeringRule {
  AuthoringPractices = "context_engineering:authoring_practices",
  DefectSeverity = "context_engineering:defect_severity",
  PreservePolicy = "context_engineering:preserve_policy",
  BoundedScope = "context_engineering:bounded_scope",
  DomainExtensions = "context_engineering:domain_extensions",
  SelfApplication = "context_engineering:self_application",
  NoDuplication = "context_engineering:no_duplication",
  NoRoleInference = "context_engineering:no_role_inference",
  ProjectContext = "context_engineering:project_context",
  SemanticValidation = "context_engineering:semantic_validation",
  NavigationValidation = "context_engineering:navigation_validation",
  ValidationEvidence = "context_engineering:validation_evidence",
  YamlGuidance = "context_engineering:yaml_guidance",
  YamlOrder = "context_engineering:yaml_order",
  InertCommands = "context_engineering:inert_commands",
  ContextChecks = "context_engineering:context_checks",
  AuditInputs = "context_engineering:audit_inputs",
  ReuseTooling = "context_engineering:reuse_tooling",
  AuditFailures = "context_engineering:audit_failures",
  AuditLimits = "context_engineering:audit_limits",
  ComparisonScope = "context_engineering:comparison_scope",
  MaintainedChecks = "context_engineering:maintained_checks",
  CheckRegressions = "context_engineering:check_regressions",
  LicenseNotices = "context_engineering:license_notices",
}

export enum WritingClarityRule {
  AtomicContent = "writing_clarity:atomic_content",
  ConnectedReasoning = "writing_clarity:connected_reasoning",
  InstructionOrder = "writing_clarity:instruction_order",
  SemanticGroups = "writing_clarity:semantic_groups",
  OwnedSubsteps = "writing_clarity:owned_substeps",
  KeyedMappings = "writing_clarity:keyed_mappings",
  Diagrams = "writing_clarity:diagrams",
  RepositoryStructure = "writing_clarity:repository_structure",
  HostCapacity = "writing_clarity:host_capacity",
  ProhibitedStructure = "writing_clarity:prohibited_structure",
  BoundedEdits = "writing_clarity:bounded_edits",
  LiteralSyntax = "writing_clarity:literal_syntax",
  Validation = "writing_clarity:validation",
}

export enum FocusedExamplesRule {
  OneDecision = "focused_examples:one_decision",
  IndependentSections = "focused_examples:independent_sections",
  RequiredPair = "focused_examples:required_pair",
  SameSituation = "focused_examples:same_situation",
  ConcreteDifference = "focused_examples:concrete_difference",
  AdjacentExplanation = "focused_examples:adjacent_explanation",
  BoundedException = "focused_examples:bounded_exception",
  CanonicalExamples = "focused_examples:canonical_examples",
  CatalogCues = "focused_examples:catalog_cues",
  PreserveRequirements = "focused_examples:preserve_requirements",
  Validation = "focused_examples:validation",
}

export enum ArticleStructureRule {
  ExplanationOpening = "article_structure:explanation_opening",
  ExplanationBody = "article_structure:explanation_body",
  NavigableSubtopics = "article_structure:navigable_subtopics",
  ActionImplications = "article_structure:action_implications",
  RulesBody = "article_structure:rules_body",
  OwnedDetails = "article_structure:owned_details",
  ProcedureOrder = "article_structure:procedure_order",
  ProcedureOutcome = "article_structure:procedure_outcome",
  ReferenceBody = "article_structure:reference_body",
  ReferenceAuthority = "article_structure:reference_authority",
  HeadingOwnership = "article_structure:heading_ownership",
  VisibleTransitions = "article_structure:visible_transitions",
  NavigationUpdates = "article_structure:navigation_updates",
  ActionInputs = "article_structure:action_inputs",
  NoHtmlTables = "article_structure:no_html_tables",
  NoEmptyStructure = "article_structure:no_empty_structure",
  PreservePolicy = "article_structure:preserve_policy",
  ManagedMarkers = "article_structure:managed_markers",
  Validation = "article_structure:validation",
}

export enum ConsistencyRule {
  CanonicalAuthority = "consistency:canonical_authority",
  ImplementationEvidence = "consistency:implementation_evidence",
  HistoricalLabels = "consistency:historical_labels",
  PreserveRequirements = "consistency:preserve_requirements",
  DirectDependencies = "consistency:direct_dependencies",
  ReusePrerequisites = "consistency:reuse_prerequisites",
  AcyclicLoading = "consistency:acyclic_loading",
  SharedIndependence = "consistency:shared_independence",
  DependencyMoves = "consistency:dependency_moves",
  BoundedDiscovery = "consistency:bounded_discovery",
  BoundedCorrections = "consistency:bounded_corrections",
  BoundedNavigation = "consistency:bounded_navigation",
  FullReviewScope = "consistency:full_review_scope",
  ReviewCoordination = "consistency:review_coordination",
  RuntimeContracts = "consistency:runtime_contracts",
  IntentAndBehavior = "consistency:intent_and_behavior",
  InertExamples = "consistency:inert_examples",
  DurableContent = "consistency:durable_content",
  SecretPlaceholders = "consistency:secret_placeholders",
  Discoverability = "consistency:discoverability",
  NoAssumedTooling = "consistency:no_assumed_tooling",
  Validation = "consistency:validation",
}

export enum KnowledgeGraphsRule {
  VerifierBoundary = "knowledge_graphs:verifier_boundary",
  DecisionInventory = "knowledge_graphs:decision_inventory",
  ReadableIds = "knowledge_graphs:readable_ids",
  SourceAnchors = "knowledge_graphs:source_anchors",
  BriefCues = "knowledge_graphs:brief_cues",
  PracticeMetadata = "knowledge_graphs:practice_metadata",
  SourceAuthority = "knowledge_graphs:source_authority",
  OwnerInspection = "knowledge_graphs:owner_inspection",
  ExistingOwner = "knowledge_graphs:existing_owner",
  SourceSync = "knowledge_graphs:source_sync",
  StableNames = "knowledge_graphs:stable_names",
  UniqueOwnership = "knowledge_graphs:unique_ownership",
  EntrypointLoading = "knowledge_graphs:entrypoint_loading",
  AcyclicPrerequisites = "knowledge_graphs:acyclic_prerequisites",
  Relationships = "knowledge_graphs:relationships",
  ConflictResolution = "knowledge_graphs:conflict_resolution",
  SemanticCoverage = "knowledge_graphs:semantic_coverage",
  GraphIntegrity = "knowledge_graphs:graph_integrity",
  MeaningEvidence = "knowledge_graphs:meaning_evidence",
  NavigableHeadings = "knowledge_graphs:navigable_headings",
  CatalogHierarchy = "knowledge_graphs:catalog_hierarchy",
  NavigationShape = "knowledge_graphs:navigation_shape",
  PracticeShape = "knowledge_graphs:practice_shape",
  RegisteredVocabulary = "knowledge_graphs:registered_vocabulary",
  CheckLeaves = "knowledge_graphs:check_leaves",
  RelativePaths = "knowledge_graphs:relative_paths",
  TeamNavigation = "knowledge_graphs:team_navigation",
  MandatoryPrerequisites = "knowledge_graphs:mandatory_prerequisites",
  SelectedBranches = "knowledge_graphs:selected_branches",
  OrderedSourceReview = "knowledge_graphs:ordered_source_review",
  BoundaryPrerequisites = "knowledge_graphs:boundary_prerequisites",
  FocusedAssignments = "knowledge_graphs:focused_assignments",
  ContextFormatBoundary = "knowledge_graphs:context_format_boundary",
}

export enum CodePracticeWritingRule {
  CodePairs = "code_practice_writing:code_pairs",
  EssentialCode = "code_practice_writing:essential_code",
  DecisiveContext = "code_practice_writing:decisive_context",
  FragmentDependencies = "code_practice_writing:fragment_dependencies",
  ExternalException = "code_practice_writing:external_exception",
  HypotheticalContracts = "code_practice_writing:hypothetical_contracts",
  DesignAndCompilation = "code_practice_writing:design_and_compilation",
  ExecuteExamples = "code_practice_writing:execute_examples",
  TemporaryScaffolding = "code_practice_writing:temporary_scaffolding",
  FailureCause = "code_practice_writing:failure_cause",
}

export enum DeliveryWritingRule {
  Responsibilities = "delivery_writing:responsibilities",
  OrdinaryProgress = "delivery_writing:ordinary_progress",
  ReportContent = "delivery_writing:report_content",
  RoleSkillBoundary = "delivery_writing:role_skill_boundary",
  CommandWorkspace = "delivery_writing:command_workspace",
  CommandInputs = "delivery_writing:command_inputs",
  ExecutableActions = "delivery_writing:executable_actions",
  ObservableResults = "delivery_writing:observable_results",
  ConditionalSteps = "delivery_writing:conditional_steps",
  NoExtraCoordination = "delivery_writing:no_extra_coordination",
  DisposableValidation = "delivery_writing:disposable_validation",
  FailureValidation = "delivery_writing:failure_validation",
  EvidenceScope = "delivery_writing:evidence_scope",
}

export enum ApiInputsRule {
  CommandDecoding = "api_inputs:command_decoding",
  ExternalSignatures = "api_inputs:external_signatures",
  NoPositionalBags = "api_inputs:no_positional_bags",
  OneInput = "api_inputs:one_input",
  SemanticRequests = "api_inputs:semantic_requests",
  Validation = "api_inputs:validation",
}

export enum BranchingRule {
  ClosedMatches = "branching:closed_matches",
  NoBooleanIf = "branching:no_boolean_if",
  NoTernary = "branching:no_ternary",
  RustMatch = "branching:rust_match",
  RustPatterns = "branching:rust_patterns",
  TypescriptExhaustiveness = "branching:typescript_exhaustiveness",
  TypescriptSwitch = "branching:typescript_switch",
  Validation = "branching:validation",
}

export enum BrowserImplementationRule {
  Capabilities = "browser_implementation:capabilities",
  Cleanup = "browser_implementation:cleanup",
  ComponentContracts = "browser_implementation:component_contracts",
  Controllers = "browser_implementation:controllers",
  DisclosureAndPasskeys = "browser_implementation:disclosure_and_passkeys",
  ExplicitState = "browser_implementation:explicit_state",
  Impeccable = "browser_implementation:impeccable",
  NoParallelStack = "browser_implementation:no_parallel_stack",
  RustOwnership = "browser_implementation:rust_ownership",
  SecretSurfaces = "browser_implementation:secret_surfaces",
  Stack = "browser_implementation:stack",
  Translations = "browser_implementation:translations",
  UiLibraries = "browser_implementation:ui_libraries",
  Validation = "browser_implementation:validation",
}

export enum BrowserTestingRule {
  BrowserBoundary = "browser_testing:browser_boundary",
  DiagnoseFirst = "browser_testing:diagnose_first",
  Evidence = "browser_testing:evidence",
  NoWeakenedTests = "browser_testing:no_weakened_tests",
  RegressionFirst = "browser_testing:regression_first",
  RetainAcceptance = "browser_testing:retain_acceptance",
  SuiteGates = "browser_testing:suite_gates",
}

export enum CloudNativeRule {
  CurrentState = "cloud_native:current_state",
  LiveVerification = "cloud_native:live_verification",
  Recovery = "cloud_native:recovery",
  Scope = "cloud_native:scope",
  SecretLifecycle = "cloud_native:secret_lifecycle",
}

export enum CodeChecksRule {
  Branching = "code_checks:branching",
  Establish = "code_checks:establish",
  Evidence = "code_checks:evidence",
  FixDiagnostics = "code_checks:fix_diagnostics",
  LintBaseline = "code_checks:lint_baseline",
}

export enum CodeSeparationRule {
  AbandonedState = "code_separation:abandoned_state",
  BrowserAdapters = "code_separation:browser_adapters",
  CoreAnnotations = "code_separation:core_annotations",
  CoreContracts = "code_separation:core_contracts",
  Extensions = "code_separation:extensions",
  ObservationPolicy = "code_separation:observation_policy",
  Ownership = "code_separation:ownership",
  Validation = "code_separation:validation",
  VisualState = "code_separation:visual_state",
}

export enum DefaultValuesRule {
  EnumDefaults = "default_values:enum_defaults",
  StructDefaults = "default_values:struct_defaults",
  ValidDefaults = "default_values:valid_defaults",
}

export enum DependencySelectionRule {
  Thresholds = "dependency_selection:thresholds",
  Verification = "dependency_selection:verification",
}

export enum DockerRule {
  BuildkitAuthority = "docker:buildkit_authority",
  InputIsolation = "docker:input_isolation",
  LateRevisionIdentity = "docker:late_revision_identity",
  RealCacheEvidence = "docker:real_cache_evidence",
  SecretBoundary = "docker:secret_boundary",
  Validation = "docker:validation",
}

export enum DomainStatesRule {
  BooleanConversion = "domain_states:boolean_conversion",
  Capabilities = "domain_states:capabilities",
  DecisionLocality = "domain_states:decision_locality",
  DependencyOptions = "domain_states:dependency_options",
  Drafts = "domain_states:drafts",
  EmptyText = "domain_states:empty_text",
  ExhaustiveMatching = "domain_states:exhaustive_matching",
  ExternalRecords = "domain_states:external_records",
  IndependentDimensions = "domain_states:independent_dimensions",
  MechanicalPredicates = "domain_states:mechanical_predicates",
  Membership = "domain_states:membership",
  NamedAbsence = "domain_states:named_absence",
  NoBooleans = "domain_states:no_booleans",
  NoDerivedFlags = "domain_states:no_derived_flags",
  NoOption = "domain_states:no_option",
  OptionReview = "domain_states:option_review",
  RawRecords = "domain_states:raw_records",
  RequiredValues = "domain_states:required_values",
  Validation = "domain_states:validation",
  VariantPayloads = "domain_states:variant_payloads",
}

export enum DomainStructureRule {
  BehaviorOwnership = "domain_structure:behavior_ownership",
  CodecOutcomes = "domain_structure:codec_outcomes",
  ExternalConversion = "domain_structure:external_conversion",
  FailureCodes = "domain_structure:failure_codes",
  FieldVocabulary = "domain_structure:field_vocabulary",
  LegalTransitions = "domain_structure:legal_transitions",
  NamedValues = "domain_structure:named_values",
  NestedVocabulary = "domain_structure:nested_vocabulary",
  NoResultUtilities = "domain_structure:no_result_utilities",
  NominalIdentity = "domain_structure:nominal_identity",
  PreserveTypes = "domain_structure:preserve_types",
  Secrets = "domain_structure:secrets",
  TrustedConstruction = "domain_structure:trusted_construction",
  TypeAliases = "domain_structure:type_aliases",
  TypedFailures = "domain_structure:typed_failures",
  TypedYaml = "domain_structure:typed_yaml",
  Validation = "domain_structure:validation",
  VersionedSchemas = "domain_structure:versioned_schemas",
  VocabularyOwnership = "domain_structure:vocabulary_ownership",
}

export enum DomainTypesRule {
  Aggregates = "domain_types:aggregates",
  ApiInventory = "domain_types:api_inventory",
  ClosedVocabulary = "domain_types:closed_vocabulary",
  ConcreteModules = "domain_types:concrete_modules",
  Constants = "domain_types:constants",
  ConversionTraits = "domain_types:conversion_traits",
  ExternalConversions = "domain_types:external_conversions",
  ExternalRecords = "domain_types:external_records",
  LintExceptions = "domain_types:lint_exceptions",
  MetadataMeaning = "domain_types:metadata_meaning",
  NamedRecords = "domain_types:named_records",
  NominalValues = "domain_types:nominal_values",
  OperationBoundaries = "domain_types:operation_boundaries",
  OwnershipHierarchy = "domain_types:ownership_hierarchy",
  Parsing = "domain_types:parsing",
  PrimitiveStorage = "domain_types:primitive_storage",
  PrivateConstruction = "domain_types:private_construction",
  ReleaseVersions = "domain_types:release_versions",
  Reuse = "domain_types:reuse",
  SemanticReview = "domain_types:semantic_review",
  StructuredStrings = "domain_types:structured_strings",
  UpdateRevisions = "domain_types:update_revisions",
  ValidatedRecords = "domain_types:validated_records",
  Versions = "domain_types:versions",
  WasmValues = "domain_types:wasm_values",
  WireShape = "domain_types:wire_shape",
  WrapperAccess = "domain_types:wrapper_access",
}

export enum EffectRule {
  EffectfulWork = "effect:effectful_work",
  Upstream = "effect:upstream",
  Version = "effect:version",
}

export enum EnumsOverBooleansRule {
  BoundaryExceptions = "enums_over_booleans:boundary_exceptions",
  DistinctDecisions = "enums_over_booleans:distinct_decisions",
  ExceptionEvidence = "enums_over_booleans:exception_evidence",
  NoDecorativeEnums = "enums_over_booleans:no_decorative_enums",
  Observations = "enums_over_booleans:observations",
  Payloads = "enums_over_booleans:payloads",
  PredicateOutcomes = "enums_over_booleans:predicate_outcomes",
  PreserveMembers = "enums_over_booleans:preserve_members",
  SemanticEnums = "enums_over_booleans:semantic_enums",
  Validation = "enums_over_booleans:validation",
}

export enum ErrorHandlingRule {
  CodecErrors = "error_handling:codec_errors",
  Enforcement = "error_handling:enforcement",
  ErrorTests = "error_handling:error_tests",
  NoPanics = "error_handling:no_panics",
  RequiredInput = "error_handling:required_input",
  SourceConversion = "error_handling:source_conversion",
  TestErrors = "error_handling:test_errors",
  TypedFailures = "error_handling:typed_failures",
}

export enum ExplicitStateRule {
  CoherentVocabulary = "explicit_state:coherent_vocabulary",
  ComponentEnums = "explicit_state:component_enums",
  Defaults = "explicit_state:defaults",
  EffectErrors = "explicit_state:effect_errors",
  EnumMembers = "explicit_state:enum_members",
  ExhaustiveTransitions = "explicit_state:exhaustive_transitions",
  ExternalAbsence = "explicit_state:external_absence",
  GeneratedExclusions = "explicit_state:generated_exclusions",
  NamedUnions = "explicit_state:named_unions",
  NoImplicitAbsence = "explicit_state:no_implicit_absence",
  NoNullish = "explicit_state:no_nullish",
  NoSentinelWrappers = "explicit_state:no_sentinel_wrappers",
  SemanticAssertions = "explicit_state:semantic_assertions",
  StatePayloads = "explicit_state:state_payloads",
  TypedFailures = "explicit_state:typed_failures",
  UnitVoid = "explicit_state:unit_void",
  Validation = "explicit_state:validation",
  VocabularyOwnership = "explicit_state:vocabulary_ownership",
}

export enum FunctionOwnershipRule {
  BoundaryFunctions = "function_ownership:boundary_functions",
  ComponentScope = "function_ownership:component_scope",
  Constants = "function_ownership:constants",
  ConstantsAndState = "function_ownership:constants_and_state",
  DependencyDirection = "function_ownership:dependency_direction",
  ExternalRequirements = "function_ownership:external_requirements",
  Instances = "function_ownership:instances",
  LintEvidence = "function_ownership:lint_evidence",
  LintExceptions = "function_ownership:lint_exceptions",
  MeaningfulOwners = "function_ownership:meaningful_owners",
  MeaningfulState = "function_ownership:meaningful_state",
  MethodKinds = "function_ownership:method_kinds",
  Migration = "function_ownership:migration",
  Nesting = "function_ownership:nesting",
  NoUtilityContainers = "function_ownership:no_utility_containers",
  Operations = "function_ownership:operations",
  SharedBehavior = "function_ownership:shared_behavior",
}

export enum KubernetesRule {
  BuildExecutionSeparation = "kubernetes:build_execution_separation",
  DirectExecution = "kubernetes:direct_execution",
  NoNestedRuntime = "kubernetes:no_nested_runtime",
  NoRuntimeSocket = "kubernetes:no_runtime_socket",
  Validation = "kubernetes:validation",
}

export enum LibrariesRule {
  BrowserStorage = "libraries:browser_storage",
  Concurrency = "libraries:concurrency",
  Diagnostics = "libraries:diagnostics",
  DirectBrowserBindings = "libraries:direct_browser_bindings",
  Networking = "libraries:networking",
  NoCustomCommodity = "libraries:no_custom_commodity",
  RequiredCore = "libraries:required_core",
  TypedBoundaries = "libraries:typed_boundaries",
  WasmContracts = "libraries:wasm_contracts",
}

export enum LocalFeatureRule {
  Cleanup = "local_feature:cleanup",
  Completion = "local_feature:completion",
  Integration = "local_feature:integration",
  Repair = "local_feature:repair",
  Workspace = "local_feature:workspace",
}

export enum MacroMinimizationRule {
  EcosystemMacros = "macro_minimization:ecosystem_macros",
  ExplicitMappings = "macro_minimization:explicit_mappings",
  NoLocalMacros = "macro_minimization:no_local_macros",
  SafeReplacement = "macro_minimization:safe_replacement",
}

export enum ModuleLayoutRule {
  NamedFiles = "module_layout:named_files",
  PreserveResolution = "module_layout:preserve_resolution",
  Validation = "module_layout:validation",
}

export enum NamedArgsRule {
  LiteralLocations = "named_args:literal_locations",
  NamedContracts = "named_args:named_contracts",
  NoBypasses = "named_args:no_bypasses",
  NoObjectDefaults = "named_args:no_object_defaults",
  RuneExceptions = "named_args:rune_exceptions",
  TypedBindings = "named_args:typed_bindings",
  Validation = "named_args:validation",
}

export enum NoUnknownRule {
  CatchBindings = "no_unknown:catch_bindings",
  ConcreteInputs = "no_unknown:concrete_inputs",
  DecoderScope = "no_unknown:decoder_scope",
  Enforcement = "no_unknown:enforcement",
  NoErasedSubstitutes = "no_unknown:no_erased_substitutes",
  NoObject = "no_unknown:no_object",
  TypedErrors = "no_unknown:typed_errors",
  UnknownBoundary = "no_unknown:unknown_boundary",
}

export enum OwnedUpdatesRule {
  ConsumeReplacement = "owned_updates:consume_replacement",
  ExternalMutation = "owned_updates:external_mutation",
  NoFakeActors = "owned_updates:no_fake_actors",
  Validation = "owned_updates:validation",
}

export enum PathImportsRule {
  AllRoots = "path_imports:all_roots",
  QualifiedFunctions = "path_imports:qualified_functions",
  TwoSegments = "path_imports:two_segments",
  Validation = "path_imports:validation",
}

export enum SerialOperationQueuesRule {
  AdmissionAndShutdown = "serial_operation_queues:admission_and_shutdown",
  EffectQueue = "serial_operation_queues:effect_queue",
  IdleAndRecovery = "serial_operation_queues:idle_and_recovery",
  Scheduling = "serial_operation_queues:scheduling",
  TypedCompletion = "serial_operation_queues:typed_completion",
  Validation = "serial_operation_queues:validation",
}

export enum SerializationBoundariesRule {
  DependencyDecoding = "serialization_boundaries:dependency_decoding",
  DeriveFirst = "serialization_boundaries:derive_first",
  NoAbsenceOverrides = "serialization_boundaries:no_absence_overrides",
  NoErasedValues = "serialization_boundaries:no_erased_values",
  TsifySupport = "serialization_boundaries:tsify_support",
  TypedAbi = "serialization_boundaries:typed_abi",
  TypedConstruction = "serialization_boundaries:typed_construction",
  TypedDecoding = "serialization_boundaries:typed_decoding",
  TypedStorage = "serialization_boundaries:typed_storage",
  TypedTests = "serialization_boundaries:typed_tests",
  ValidatedDeserialization = "serialization_boundaries:validated_deserialization",
  Validation = "serialization_boundaries:validation",
}

export enum SingleParameterRule {
  CallbackReturns = "single_parameter:callback_returns",
  ExplicitOmission = "single_parameter:explicit_omission",
  HostSignatures = "single_parameter:host_signatures",
  NamedShapes = "single_parameter:named_shapes",
  OneParameter = "single_parameter:one_parameter",
  SemanticRequest = "single_parameter:semantic_request",
  Validation = "single_parameter:validation",
}

export enum StructConstructionRule {
  DeriveFrom = "struct_construction:derive_from",
  InitialState = "struct_construction:initial_state",
  NoNew = "struct_construction:no_new",
  StructLiterals = "struct_construction:struct_literals",
}

export enum SvelteStateModelingRule {
  ExternalAbsence = "svelte_state_modeling:external_absence",
  GeneratedTypes = "svelte_state_modeling:generated_types",
  Initialization = "svelte_state_modeling:initialization",
  StatePayloads = "svelte_state_modeling:state_payloads",
  Validation = "svelte_state_modeling:validation",
}

export enum TestingRule {
  Colocation = "testing:colocation",
  Coverage = "testing:coverage",
  DomainAndBoundary = "testing:domain_and_boundary",
  Evidence = "testing:evidence",
  NoSizeEvasion = "testing:no_size_evasion",
  RegressionFirst = "testing:regression_first",
}

export enum TypedSqlRule {
  Construction = "typed_sql:construction",
}

export enum WasmContractsRule {
  Abi = "wasm_contracts:abi",
  CanonicalEnums = "wasm_contracts:canonical_enums",
  Construction = "wasm_contracts:construction",
  NominalIdentifiers = "wasm_contracts:nominal_identifiers",
  Ownership = "wasm_contracts:ownership",
  Replacement = "wasm_contracts:replacement",
  RetainedValues = "wasm_contracts:retained_values",
  Validation = "wasm_contracts:validation",
}

export enum WasmNameCoherenceRule {
  CommandGroups = "wasm_name_coherence:command_groups",
  CommandNames = "wasm_name_coherence:command_names",
  ExportNames = "wasm_name_coherence:export_names",
  ExternalNames = "wasm_name_coherence:external_names",
  Migrations = "wasm_name_coherence:migrations",
  NoAliases = "wasm_name_coherence:no_aliases",
  SameNames = "wasm_name_coherence:same_names",
  SerializationNames = "wasm_name_coherence:serialization_names",
  Validation = "wasm_name_coherence:validation",
}

export enum WasmUiIntegrationRule {
  CallerAdaptation = "wasm_ui_integration:caller_adaptation",
  NoCloning = "wasm_ui_integration:no_cloning",
  React = "wasm_ui_integration:react",
  SvelteBoundaries = "wasm_ui_integration:svelte_boundaries",
  SvelteState = "wasm_ui_integration:svelte_state",
  TypedValues = "wasm_ui_integration:typed_values",
  Validation = "wasm_ui_integration:validation",
  Vue = "wasm_ui_integration:vue",
}

export enum WebUnusedCodeRule {
  AuditScope = "web_unused_code:audit_scope",
  FixFindings = "web_unused_code:fix_findings",
  LiveMarkup = "web_unused_code:live_markup",
  NoJsonRoundtrip = "web_unused_code:no_json_roundtrip",
  ToolBlindSpots = "web_unused_code:tool_blind_spots",
  Validation = "web_unused_code:validation",
}

export enum WorkflowTypestateRule {
  ConsumingTransitions = "workflow_typestate:consuming_transitions",
  IndependentStates = "workflow_typestate:independent_states",
  InitialConversion = "workflow_typestate:initial_conversion",
  NoArtificialPhases = "workflow_typestate:no_artificial_phases",
  NoForgedCapabilities = "workflow_typestate:no_forged_capabilities",
  PrivateCapabilities = "workflow_typestate:private_capabilities",
  RuntimeAuthorization = "workflow_typestate:runtime_authorization",
  TypedOwner = "workflow_typestate:typed_owner",
  Validation = "workflow_typestate:validation",
}

export type RuleName =
  | TechWriterRule
  | ContextEngineeringRule
  | WritingClarityRule
  | FocusedExamplesRule
  | ArticleStructureRule
  | ConsistencyRule
  | KnowledgeGraphsRule
  | CodePracticeWritingRule
  | DeliveryWritingRule
  | ApiInputsRule
  | BranchingRule
  | BrowserImplementationRule
  | BrowserTestingRule
  | CloudNativeRule
  | CodeChecksRule
  | CodeSeparationRule
  | DefaultValuesRule
  | DependencySelectionRule
  | DockerRule
  | DomainStatesRule
  | DomainStructureRule
  | DomainTypesRule
  | EffectRule
  | EnumsOverBooleansRule
  | ErrorHandlingRule
  | ExplicitStateRule
  | FunctionOwnershipRule
  | KubernetesRule
  | LibrariesRule
  | LocalFeatureRule
  | MacroMinimizationRule
  | ModuleLayoutRule
  | NamedArgsRule
  | NoUnknownRule
  | OwnedUpdatesRule
  | PathImportsRule
  | SerialOperationQueuesRule
  | SerializationBoundariesRule
  | SingleParameterRule
  | StructConstructionRule
  | SvelteStateModelingRule
  | TestingRule
  | TypedSqlRule
  | WasmContractsRule
  | WasmNameCoherenceRule
  | WasmUiIntegrationRule
  | WebUnusedCodeRule
  | WorkflowTypestateRule;
