import { Cause, Data } from "effect";
import type { ParseError } from "effect/ParseResult";
import type { YAMLParseError, YAMLWarning } from "yaml";

export enum FailureCode {
  Usage = "usage",
  Yaml = "invalid-yaml",
  Request = "invalid-request",
  Response = "response-capacity",
}
export enum FailureSourceKind {
  Policy = "policy",
  Host = "host",
  Schema = "schema",
  Yaml = "yaml",
}
export type YamlDiagnostic = YAMLParseError | YAMLWarning;
export interface PolicyFailureSource {
  readonly kind: FailureSourceKind.Policy;
}
export interface HostFailureSource {
  readonly kind: FailureSourceKind.Host;
  readonly error: Cause.UnknownException;
}
export interface SchemaFailureSource {
  readonly kind: FailureSourceKind.Schema;
  readonly error: ParseError;
}
export type YamlDiagnostics = readonly YamlDiagnostic[];
export interface HostFailureRequest {
  readonly code: FailureCode;
  readonly error: Cause.UnknownException;
}
export interface YamlFailureSource {
  readonly kind: FailureSourceKind.Yaml;
  readonly diagnostics: readonly YamlDiagnostic[];
}
export type FailureSource =
  | PolicyFailureSource
  | HostFailureSource
  | SchemaFailureSource
  | YamlFailureSource;
export interface SkillFailureDetails {
  readonly code: FailureCode;
  readonly source: FailureSource;
}
export class SkillFailure extends Data.TaggedError(
  "SkillFailure",
)<SkillFailureDetails> {
  static fromHost(request: HostFailureRequest): SkillFailure {
    const source: HostFailureSource = {
      kind: FailureSourceKind.Host,
      error: request.error,
    };
    const details: SkillFailureDetails = { code: request.code, source };
    return new SkillFailure(details);
  }
  static fromSchema(error: ParseError): SkillFailure {
    const source: SchemaFailureSource = {
      kind: FailureSourceKind.Schema,
      error,
    };
    const details: SkillFailureDetails = { code: FailureCode.Request, source };
    return new SkillFailure(details);
  }
  static fromYaml(diagnostics: YamlDiagnostics): SkillFailure {
    const source: YamlFailureSource = {
      kind: FailureSourceKind.Yaml,
      diagnostics,
    };
    const details: SkillFailureDetails = { code: FailureCode.Yaml, source };
    return new SkillFailure(details);
  }
  static from(code: FailureCode): SkillFailure {
    const source: PolicyFailureSource = { kind: FailureSourceKind.Policy };
    const details: SkillFailureDetails = { code, source };
    return new SkillFailure(details);
  }
}
