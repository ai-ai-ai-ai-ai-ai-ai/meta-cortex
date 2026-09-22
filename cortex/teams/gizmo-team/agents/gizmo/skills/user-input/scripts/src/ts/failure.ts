import { Cause, Data } from "effect";
import type { ParseError } from "effect/ParseResult";
import type { YAMLError, YAMLWarning } from "yaml";

export enum FailureCode {
  Yaml = "invalid_yaml",
  Schema = "invalid_schema",
  State = "invalid_state",
  Io = "io",
  Usage = "usage",
}
export interface FailureDetail {
  readonly code: FailureCode;
  readonly message: string;
}
export enum SourceKind {
  Policy = "policy",
  Host = "host",
  Schema = "schema",
  Yaml = "yaml",
}
export type FailureSource =
  | { readonly kind: SourceKind.Policy }
  | { readonly kind: SourceKind.Host; readonly error: Cause.UnknownException }
  | { readonly kind: SourceKind.Schema; readonly error: ParseError }
  | {
      readonly kind: SourceKind.Yaml;
      readonly errors: readonly (YAMLError | YAMLWarning)[];
    };
export interface FailureContext extends FailureDetail {
  readonly source: FailureSource;
}
export class InputFailure extends Data.TaggedError(
  "InputFailure",
)<FailureContext> {
  static from(detail: FailureDetail): InputFailure {
    const context: FailureContext = {
      ...detail,
      source: { kind: SourceKind.Policy },
    };
    return new InputFailure(context);
  }
}
