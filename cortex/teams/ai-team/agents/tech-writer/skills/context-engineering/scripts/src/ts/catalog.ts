import { Effect, Schema } from "effect";
import type { ParseOptions } from "effect/SchemaAST";
import { parse, type ParseOptions as YamlParseOptions } from "yaml";

import { RuleVocabulary, type RuleName } from "./rule-name.ts";
import {
  PracticeOwnerVocabulary,
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
  static readonly ruleName = Schema.Literals(RuleVocabulary.values).annotate(
    CatalogSchema.ruleAnnotations,
  );
  static readonly practiceOwner = Schema.Literals(
    PracticeOwnerVocabulary.values,
  ).annotate(CatalogSchema.ownerAnnotations);
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
    required: Schema.NonEmptyArray(Schema.NonEmptyString),
    compare: Schema.NonEmptyArray(CatalogSchema.comparison),
  } satisfies Schema.Struct.Fields;
  static readonly check = Schema.Struct(CatalogSchema.checkFields);
  static readonly value = Schema.Union([
    CatalogSchema.navigation,
    CatalogSchema.practice,
    CatalogSchema.check,
  ]);
  // Catalog declarations own the vocabulary; normal audits still use closed enums.
  static readonly declarationId = Schema.String.check(
    Schema.isPattern(
      /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*:[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/,
    ),
  );
  private static readonly declaredRuleFields = {
    ...CatalogSchema.ruleFields,
    id: CatalogSchema.declarationId,
  } satisfies Schema.Struct.Fields;
  private static readonly declaredPracticeFields = {
    ...CatalogSchema.practiceFields,
    owner: CatalogSchema.declarationId,
    rules: Schema.NonEmptyArray(
      Schema.Struct(CatalogSchema.declaredRuleFields),
    ),
  } satisfies Schema.Struct.Fields;
  private static readonly declaredComparisonFields = {
    ...CatalogSchema.comparisonFields,
    id: CatalogSchema.declarationId,
  } satisfies Schema.Struct.Fields;
  private static readonly declaredCheckFields = {
    ...CatalogSchema.checkFields,
    compare: Schema.NonEmptyArray(
      Schema.Struct(CatalogSchema.declaredComparisonFields),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly declaration = Schema.Union([
    CatalogSchema.navigation,
    Schema.Struct(CatalogSchema.declaredPracticeFields),
    Schema.Struct(CatalogSchema.declaredCheckFields),
  ]);
}

export type CatalogDeclaration = typeof CatalogSchema.declaration.Type;
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

  private readonly parse = Effect.fnUntraced(function* (this: CatalogInput) {
    // YAML exposes an untyped parser result only inside this schema decoder.
    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    const value = yield* Effect.try((): unknown =>
      parse(this.source, CatalogInput.yaml),
    );
    return value;
  });

  readonly decode = Effect.fnUntraced(function* (this: CatalogInput) {
    const value = yield* this.parse();
    return yield* Schema.decodeUnknownEffect(
      CatalogSchema.value,
      CatalogInput.admission,
    )(value);
  });
  readonly declarations = Effect.fnUntraced(function* (this: CatalogInput) {
    const value = yield* this.parse();
    return yield* Schema.decodeUnknownEffect(
      CatalogSchema.declaration,
      CatalogInput.admission,
    )(value);
  });
}
