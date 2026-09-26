import { Effect, Schema } from "effect";
import type { ParseOptions } from "effect/SchemaAST";
import { parse, type ParseOptions as YamlParseOptions } from "yaml";

import {
  ApiInputsRule,
  BranchingRule,
  BrowserImplementationRule,
  BrowserTestingRule,
  CloudNativeRule,
  CodeChecksRule,
  CodeSeparationRule,
  DefaultValuesRule,
  DependencySelectionRule,
  DockerRule,
  DomainStatesRule,
  DomainStructureRule,
  DomainTypesRule,
  EffectRule,
  EnumsOverBooleansRule,
  ErrorHandlingRule,
  ExplicitStateRule,
  FunctionOwnershipRule,
  KubernetesRule,
  LibrariesRule,
  LocalFeatureRule,
  MacroMinimizationRule,
  ModuleLayoutRule,
  NamedArgsRule,
  NoUnknownRule,
  OwnedUpdatesRule,
  PathImportsRule,
  SerialOperationQueuesRule,
  SerializationBoundariesRule,
  SingleParameterRule,
  StructConstructionRule,
  SvelteStateModelingRule,
  TestingRule,
  TypedSqlRule,
  WasmContractsRule,
  WasmNameCoherenceRule,
  WasmUiIntegrationRule,
  WebUnusedCodeRule,
  WorkflowTypestateRule,
  type RuleName,
} from "./rule-name.ts";
import {
  DeliveryPracticeOwner,
  ProgrammingPracticeOwner,
  RustPracticeOwner,
  SrePracticeOwner,
  TypescriptPracticeOwner,
  type PracticeOwner,
} from "./practice-owner.ts";

export enum CatalogKind {
  Navigation = "navigation",
  Practice = "practice",
  Check = "check",
}

export class CatalogSchema {
  private static readonly ruleAnnotations = {
    identifier: "registered RuleName",
  } satisfies Schema.Annotations.Bottom<RuleName, readonly []>;
  private static readonly ownerAnnotations = {
    identifier: "registered PracticeOwner",
  } satisfies Schema.Annotations.Bottom<PracticeOwner, readonly []>;
  static readonly ruleName = Schema.Literals([
    ...Object.values(ApiInputsRule),
    ...Object.values(BranchingRule),
    ...Object.values(BrowserImplementationRule),
    ...Object.values(BrowserTestingRule),
    ...Object.values(CloudNativeRule),
    ...Object.values(CodeChecksRule),
    ...Object.values(CodeSeparationRule),
    ...Object.values(DefaultValuesRule),
    ...Object.values(DependencySelectionRule),
    ...Object.values(DockerRule),
    ...Object.values(DomainStatesRule),
    ...Object.values(DomainStructureRule),
    ...Object.values(DomainTypesRule),
    ...Object.values(EffectRule),
    ...Object.values(EnumsOverBooleansRule),
    ...Object.values(ErrorHandlingRule),
    ...Object.values(ExplicitStateRule),
    ...Object.values(FunctionOwnershipRule),
    ...Object.values(KubernetesRule),
    ...Object.values(LibrariesRule),
    ...Object.values(LocalFeatureRule),
    ...Object.values(MacroMinimizationRule),
    ...Object.values(ModuleLayoutRule),
    ...Object.values(NamedArgsRule),
    ...Object.values(NoUnknownRule),
    ...Object.values(OwnedUpdatesRule),
    ...Object.values(PathImportsRule),
    ...Object.values(SerialOperationQueuesRule),
    ...Object.values(SerializationBoundariesRule),
    ...Object.values(SingleParameterRule),
    ...Object.values(StructConstructionRule),
    ...Object.values(SvelteStateModelingRule),
    ...Object.values(TestingRule),
    ...Object.values(TypedSqlRule),
    ...Object.values(WasmContractsRule),
    ...Object.values(WasmNameCoherenceRule),
    ...Object.values(WasmUiIntegrationRule),
    ...Object.values(WebUnusedCodeRule),
    ...Object.values(WorkflowTypestateRule),
  ]).annotate(CatalogSchema.ruleAnnotations);
  static readonly practiceOwner = Schema.Literals([
    ...Object.values(DeliveryPracticeOwner),
    ...Object.values(ProgrammingPracticeOwner),
    ...Object.values(RustPracticeOwner),
    ...Object.values(SrePracticeOwner),
    ...Object.values(TypescriptPracticeOwner),
  ]).annotate(CatalogSchema.ownerAnnotations);
  static readonly referenceFields = {
    title: Schema.NonEmptyString,
    path: Schema.NonEmptyString,
  } satisfies Schema.Struct.Fields;
  static readonly reference = Schema.Struct(CatalogSchema.referenceFields);
  static readonly entryFields = {
    title: Schema.NonEmptyString,
    path: Schema.NonEmptyString,
    summary: Schema.NonEmptyString,
  } satisfies Schema.Struct.Fields;
  static readonly entry = Schema.Struct(CatalogSchema.entryFields);
  static readonly ruleFields = {
    id: CatalogSchema.ruleName,
    source: Schema.NonEmptyString,
    summary: Schema.NonEmptyString,
  } satisfies Schema.Struct.Fields;
  static readonly rule = Schema.Struct(CatalogSchema.ruleFields);
  static readonly comparisonFields = {
    id: CatalogSchema.ruleName,
    source: Schema.NonEmptyString,
  } satisfies Schema.Struct.Fields;
  static readonly comparison = Schema.Struct(CatalogSchema.comparisonFields);
  static readonly navigationFields = {
    kind: Schema.Literal(CatalogKind.Navigation),
    title: Schema.NonEmptyString,
    entries: Schema.NonEmptyArray(CatalogSchema.entry),
  } satisfies Schema.Struct.Fields;
  static readonly navigation = Schema.Struct(CatalogSchema.navigationFields);
  static readonly practiceFields = {
    kind: Schema.Literal(CatalogKind.Practice),
    owner: CatalogSchema.practiceOwner,
    title: Schema.NonEmptyString,
    source_title: Schema.NonEmptyString,
    source: Schema.NonEmptyString,
    owns: Schema.NonEmptyArray(Schema.NonEmptyString),
    excludes: Schema.Array(Schema.NonEmptyString),
    relationships: Schema.Array(Schema.NonEmptyString),
    related: Schema.Array(CatalogSchema.reference),
    rules: Schema.NonEmptyArray(CatalogSchema.rule),
  } satisfies Schema.Struct.Fields;
  static readonly practice = Schema.Struct(CatalogSchema.practiceFields);
  static readonly checkFields = {
    kind: Schema.Literal(CatalogKind.Check),
    title: Schema.NonEmptyString,
    overview: Schema.NonEmptyArray(Schema.NonEmptyString),
    prohibited: Schema.NonEmptyArray(Schema.NonEmptyString),
    preferred: Schema.NonEmptyArray(Schema.NonEmptyString),
    compare: Schema.NonEmptyArray(CatalogSchema.comparison),
  } satisfies Schema.Struct.Fields;
  static readonly check = Schema.Struct(CatalogSchema.checkFields);
  static readonly value = Schema.Union([
    CatalogSchema.navigation,
    CatalogSchema.practice,
    CatalogSchema.check,
  ]);
}

export type Catalog = typeof CatalogSchema.value.Type;
export type CatalogEntry = typeof CatalogSchema.entry.Type;
export type CatalogRule = typeof CatalogSchema.rule.Type;
export type CatalogReference = typeof CatalogSchema.reference.Type;
export type CatalogComparison = typeof CatalogSchema.comparison.Type;

export class CatalogInput {
  private static readonly admission: ParseOptions = {
    onExcessProperty: "error",
  };
  private static readonly yaml: YamlParseOptions = {
    uniqueKeys: true,
    strict: true,
  };
  constructor(private readonly source: string) {}

  readonly decode = Effect.fnUntraced(function* (this: CatalogInput) {
    // YAML exposes an untyped parser result only inside this schema decoder.
    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    const value = yield* Effect.try((): unknown =>
      parse(this.source, CatalogInput.yaml),
    );
    return yield* Schema.decodeUnknownEffect(
      CatalogSchema.value,
      CatalogInput.admission,
    )(value);
  });
}
