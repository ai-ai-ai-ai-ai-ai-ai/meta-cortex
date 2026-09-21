import { Brand } from "effect";

// These transport strings have no content constraints; request schemas validate their contents.
export type YamlText = string & Brand.Brand<"YamlText">;
export type InvocationText = string & Brand.Brand<"InvocationText">;
export type CommandDescription = string & Brand.Brand<"CommandDescription">;

export class ProtocolText {
  private static readonly yamlBrand = Brand.nominal<YamlText>();
  private static readonly invocationBrand = Brand.nominal<InvocationText>();
  private static readonly descriptionBrand =
    Brand.nominal<CommandDescription>();
  static yaml(value: string): YamlText {
    return ProtocolText.yamlBrand(value);
  }
  static invocation(value: string): InvocationText {
    return ProtocolText.invocationBrand(value);
  }
  static description(value: string): CommandDescription {
    return ProtocolText.descriptionBrand(value);
  }
}
