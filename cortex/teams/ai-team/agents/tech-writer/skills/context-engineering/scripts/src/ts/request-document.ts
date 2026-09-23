import { stringify } from "yaml";
import type { SkillRequestSchema } from "./request.ts";
import { ProtocolText, type YamlText } from "./protocol-text.ts";

export type SkillRequestWire = typeof SkillRequestSchema.value.Encoded;

/** Construct the known wire record before serializing it at the YAML edge. */
export class SkillRequestDocument {
  constructor(private readonly request: SkillRequestWire) {}

  encode(): YamlText {
    return ProtocolText.yaml(stringify(this.request));
  }
}
