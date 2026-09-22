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
          exampleYaml: ProtocolText.yaml("version: 1\ntools:\n  list: {}\n"),
        },
        {
          name: Command.Articles,
          description: ProtocolText.description(
            "Audit caller-supplied semantic blocks; does not parse Markdown or read files. Example paths are synthetic.",
          ),
          inputSchema: JSONSchema.make(SkillRequestSchema.articles),
          exampleYaml: ProtocolText.yaml(
            "version: 1\narticles:\n  audit:\n    documents:\n      - path: examples/article.md\n        blocks:\n          - kind: heading\n            depth: 2\n            line: 1\n            text: Overview\n          - kind: paragraph\n            line: 3\n",
          ),
        },
        {
          name: Command.Navigation,
          description: ProtocolText.description(
            "Audit owning graph entries against supplied documents and exact heading anchors. Supply the complete inventory for this scope. Rule names identify entries; distinct rules may share a section. Example paths are synthetic.",
          ),
          inputSchema: JSONSchema.make(SkillRequestSchema.navigation),
          exampleYaml: ProtocolText.yaml(
            "version: 1\nnavigation:\n  audit:\n    documents:\n      - path: examples/practice.md\n        owner: examples/index.md\n        anchors: [validation]\n    graphs:\n      - path: examples/index.md\n        entries:\n          - rule: practice:validation\n            target: examples/practice.md\n            anchor: validation\n            line: 3\n",
          ),
        },
      ],
    };
  }
}
