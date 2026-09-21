import { JSONSchema, Schema } from "effect";
import { ArticleSchema } from "./article.ts";
import { NavigationSchema } from "./navigation.ts";

export enum Command {
  List = "tools.list",
  Articles = "articles.audit",
  Navigation = "navigation.audit",
}

export class SkillRequestSchema {
  private static readonly emptyFields = {} satisfies Schema.Struct.Fields;
  private static readonly toolsFields = {
    list: Schema.Struct(SkillRequestSchema.emptyFields),
  } satisfies Schema.Struct.Fields;
  private static readonly articleFields = {
    audit: ArticleSchema.value,
  } satisfies Schema.Struct.Fields;
  private static readonly navigationFields = {
    audit: NavigationSchema.value,
  } satisfies Schema.Struct.Fields;
  private static readonly listFields = {
    version: Schema.Literal(1),
    tools: Schema.Struct(SkillRequestSchema.toolsFields),
  } satisfies Schema.Struct.Fields;
  private static readonly articleRequestFields = {
    version: Schema.Literal(1),
    articles: Schema.Struct(SkillRequestSchema.articleFields),
  } satisfies Schema.Struct.Fields;
  private static readonly navigationRequestFields = {
    version: Schema.Literal(1),
    navigation: Schema.Struct(SkillRequestSchema.navigationFields),
  } satisfies Schema.Struct.Fields;
  static readonly list = Schema.Struct(SkillRequestSchema.listFields);
  static readonly articles = Schema.Struct(
    SkillRequestSchema.articleRequestFields,
  );
  static readonly navigation = Schema.Struct(
    SkillRequestSchema.navigationRequestFields,
  );
  static readonly value = Schema.Union(
    SkillRequestSchema.list,
    SkillRequestSchema.articles,
    SkillRequestSchema.navigation,
  );
}
export type SkillRequest = typeof SkillRequestSchema.value.Type;

/** Catalog belongs to this closed skill, not a global provider registry. */
export class SkillCatalog {
  constructor(private readonly invocation: string) {}
  describe() {
    return {
      version: 1,
      invocation: this.invocation,
      commands: [
        {
          name: Command.List,
          description:
            "List commands, request schemas, and runnable YAML examples.",
          inputSchema: JSONSchema.make(SkillRequestSchema.list),
          exampleYaml: "version: 1\ntools:\n  list: {}\n",
        },
        {
          name: Command.Articles,
          description:
            "Audit caller-supplied semantic blocks; does not parse Markdown or read files.",
          inputSchema: JSONSchema.make(SkillRequestSchema.articles),
          exampleYaml:
            "version: 1\narticles:\n  audit:\n    documents:\n      - path: docs/example.md\n        blocks:\n          - kind: heading\n            depth: 2\n            line: 1\n            text: Overview\n          - kind: paragraph\n            line: 3\n",
        },
        {
          name: Command.Navigation,
          description:
            "Audit owning graph entries against supplied documents and exact heading anchors. Supply the complete inventory for this scope.",
          inputSchema: JSONSchema.make(SkillRequestSchema.navigation),
          exampleYaml:
            "version: 1\nnavigation:\n  audit:\n    documents:\n      - path: docs/practice.md\n        owner: docs/knowledge-graph.md\n        anchors: [validation]\n    graphs:\n      - path: docs/knowledge-graph.md\n        entries:\n          - target: docs/practice.md\n            anchor: validation\n            line: 3\n",
        },
      ],
    };
  }
}
