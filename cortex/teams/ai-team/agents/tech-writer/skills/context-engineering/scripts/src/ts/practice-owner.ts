// Canonical practice identities; source paths remain separate catalog metadata.
export enum DeliveryPracticeOwner {
  LocalFeature = "delivery:local_feature",
}

export enum ProgrammingPracticeOwner {
  Branching = "programming:branching",
}

export enum RustPracticeOwner {
  ApiInputs = "rust:api_inputs",
  CodeChecks = "rust:code_checks",
  CodeSeparation = "rust:code_separation",
  DefaultValues = "rust:default_values",
  DependencySelection = "rust:dependency_selection",
  DomainStates = "rust:domain_states",
  DomainTypes = "rust:domain_types",
  ErrorHandling = "rust:error_handling",
  FunctionOwnership = "rust:function_ownership",
  Libraries = "rust:libraries",
  MacroMinimization = "rust:macro_minimization",
  ModuleLayout = "rust:module_layout",
  OwnedUpdates = "rust:owned_updates",
  PathImports = "rust:path_imports",
  SerializationBoundaries = "rust:serialization_boundaries",
  StructConstruction = "rust:struct_construction",
  Testing = "rust:testing",
  TypedSql = "rust:typed_sql",
  WasmContracts = "rust:wasm_contracts",
  WasmNameCoherence = "rust:wasm_name_coherence",
  WasmUiIntegration = "rust:wasm_ui_integration",
  WorkflowTypestate = "rust:workflow_typestate",
}

export enum SrePracticeOwner {
  CloudNative = "sre:cloud_native",
  Docker = "sre:docker",
  Kubernetes = "sre:kubernetes",
}

export enum TypescriptPracticeOwner {
  BrowserImplementation = "typescript:browser_implementation",
  BrowserTesting = "typescript:browser_testing",
  CodeChecks = "typescript:code_checks",
  DependencySelection = "typescript:dependency_selection",
  DomainStructure = "typescript:domain_structure",
  Effect = "typescript:effect",
  EnumsOverBooleans = "typescript:enums_over_booleans",
  ExplicitState = "typescript:explicit_state",
  FunctionOwnership = "typescript:function_ownership",
  NamedArgs = "typescript:named_args",
  NoUnknown = "typescript:no_unknown",
  SerialOperationQueues = "typescript:serial_operation_queues",
  SingleParameter = "typescript:single_parameter",
  SvelteStateModeling = "typescript:svelte_state_modeling",
  WebUnusedCode = "typescript:web_unused_code",
}

export type PracticeOwner =
  | DeliveryPracticeOwner
  | ProgrammingPracticeOwner
  | RustPracticeOwner
  | SrePracticeOwner
  | TypescriptPracticeOwner;
