import { BlockKind } from "./article.ts";
import {
  SkillRequestDocument,
  type SkillRequestWire,
} from "./request-document.ts";
import { JSONSchema } from "effect";
import { Command, ProtocolVersion, SkillRequestSchema } from "./request.ts";
import {
  ProtocolText,
  type YamlText,
  type InvocationText,
  type CommandDescription,
} from "./protocol-text.ts";

export interface CatalogCommand {
  readonly name: Command;
  readonly description: CommandDescription;
  readonly inputSchema: JSONSchema.JsonSchema7Root;
  readonly exampleYaml: YamlText;
}
export interface CommandCatalog {
  readonly version: ProtocolVersion;
  readonly invocation: InvocationText;
  readonly commands: readonly CatalogCommand[];
}

/** Catalog belongs to this closed skill, not a global provider registry. */
export class SkillCatalog {
  constructor(private readonly invocation: InvocationText) {}
  describe(): CommandCatalog {
    const list: SkillRequestWire = {
      version: ProtocolVersion.V1,
      tools: { list: {} },
    };
    const articles: SkillRequestWire = {
      version: ProtocolVersion.V1,
      articles: {
        audit: {
          documents: [
            {
              path: "examples/article.md",
              blocks: [
                {
                  kind: BlockKind.Heading,
                  depth: 2,
                  line: 1,
                  text: "Overview",
                },
                { kind: BlockKind.Paragraph, line: 3 },
              ],
            },
          ],
        },
      },
    };
    const navigation: SkillRequestWire = {
      version: ProtocolVersion.V1,
      navigation: {
        audit: {
          documents: [
            {
              path: "examples/practice.md",
              owner: "examples/index.md",
              anchors: ["validation"],
            },
          ],
          graphs: [
            {
              path: "examples/index.md",
              entries: [
                {
                  rule: "practice:validation",
                  target: "examples/practice.md",
                  anchor: "validation",
                  line: 3,
                },
              ],
            },
          ],
        },
      },
    };
    return {
      version: ProtocolVersion.V1,
      invocation: this.invocation,
      commands: [
        {
          name: Command.List,
          description: ProtocolText.description(
            "List commands, request schemas, and runnable YAML examples.",
          ),
          inputSchema: JSONSchema.make(SkillRequestSchema.list),
          exampleYaml: new SkillRequestDocument(list).encode(),
        },
        {
          name: Command.Articles,
          description: ProtocolText.description(
            "Audit caller-supplied semantic blocks; does not parse Markdown or read files. Example paths are synthetic.",
          ),
          inputSchema: JSONSchema.make(SkillRequestSchema.articles),
          exampleYaml: new SkillRequestDocument(articles).encode(),
        },
        {
          name: Command.Navigation,
          description: ProtocolText.description(
            "Audit owning graph entries against supplied documents and exact heading anchors. Supply the complete inventory for this scope. Rule names identify entries; distinct rules may share a section. Example paths are synthetic.",
          ),
          inputSchema: JSONSchema.make(SkillRequestSchema.navigation),
          exampleYaml: new SkillRequestDocument(navigation).encode(),
        },
      ],
    };
  }
}
