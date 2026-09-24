import { Schema } from "effect";
import { ArticleSchema } from "./article.ts";
import { NavigationSchema } from "./navigation.ts";

export enum ProtocolVersion {
  V1 = 1,
}

export enum Command {
  List = "tools.list",
  Articles = "articles.audit",
  Navigation = "navigation.audit",
}

export class SkillRequestSchema {
  // Struct({}) accepts any object, including arrays and extra properties.
  // Discovery takes a mapping with no permitted keys or values.
  private static readonly toolsFields = {
    list: Schema.Record(Schema.String, Schema.Never),
  } satisfies Schema.Struct.Fields;
  private static readonly articleFields = {
    audit: ArticleSchema.value,
  } satisfies Schema.Struct.Fields;
  private static readonly navigationFields = {
    audit: NavigationSchema.value,
  } satisfies Schema.Struct.Fields;
  private static readonly listFields = {
    version: Schema.Literal(ProtocolVersion.V1),
    tools: Schema.Struct(SkillRequestSchema.toolsFields),
  } satisfies Schema.Struct.Fields;
  private static readonly articleRequestFields = {
    version: Schema.Literal(ProtocolVersion.V1),
    articles: Schema.Struct(SkillRequestSchema.articleFields),
  } satisfies Schema.Struct.Fields;
  private static readonly navigationRequestFields = {
    version: Schema.Literal(ProtocolVersion.V1),
    navigation: Schema.Struct(SkillRequestSchema.navigationFields),
  } satisfies Schema.Struct.Fields;
  static readonly list = Schema.Struct(SkillRequestSchema.listFields);
  static readonly articles = Schema.Struct(
    SkillRequestSchema.articleRequestFields,
  );
  static readonly navigation = Schema.Struct(
    SkillRequestSchema.navigationRequestFields,
  );
  static readonly value = Schema.Union([
    SkillRequestSchema.list,
    SkillRequestSchema.articles,
    SkillRequestSchema.navigation,
  ]);
}
export type SkillRequest = typeof SkillRequestSchema.value.Type;
