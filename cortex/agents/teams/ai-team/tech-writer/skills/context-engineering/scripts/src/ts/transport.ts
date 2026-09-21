// YAML admission pattern adapted from Nook's executable-skill-host scripts.
import { Cause, Effect, Schema } from "effect";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  stringify,
  type ParsedNode,
  type ParseOptions,
  type DocumentOptions,
  type SchemaOptions,
  type ToJSOptions,
} from "yaml";
import { SkillRequestSchema, type SkillRequest } from "./request.ts";
import {
  FailureCode,
  SkillFailure,
  type HostFailureRequest,
} from "./failure.ts";

import type { ParseOptions as SchemaParseOptions } from "effect/SchemaAST";
import type { SkillResponse } from "./response.ts";
import { ProtocolText, type YamlText } from "./protocol-text.ts";
type YamlParseOptions = ParseOptions & DocumentOptions & SchemaOptions;

export type PendingYamlNode = {
  readonly node: ParsedNode;
  readonly depth: number;
};

export class YamlRequest {
  static readonly maximumBytes = 64 * 1024;
  private static readonly options: YamlParseOptions = {
    strict: true,
    uniqueKeys: true,
    version: "1.2",
    schema: "core",
  };
  private static readonly conversion: ToJSOptions = { maxAliasCount: 0 };
  private static readonly admission: SchemaParseOptions = {
    onExcessProperty: "error",
  };
  constructor(private readonly source: YamlText) {}

  decode(): Effect.Effect<SkillRequest, SkillFailure> {
    return Effect.gen(this, function* () {
      if (Buffer.byteLength(this.source, "utf8") > YamlRequest.maximumBytes) {
        return yield* Effect.fail(SkillFailure.from(FailureCode.Request));
      }
      const document = yield* Effect.try(() =>
        parseDocument(this.source, YamlRequest.options),
      ).pipe(Effect.mapError((error) => this.hostFailure(error)));
      if (document.errors.length > 0 || document.warnings.length > 0) {
        const diagnostics = [...document.errors, ...document.warnings];
        return yield* Effect.fail(SkillFailure.fromYaml(diagnostics));
      }
      if (
        document.directives.yaml.explicit ||
        Object.keys(document.directives.tags).some(
          (handle) => handle !== "!!",
        ) ||
        !document.contents
      ) {
        return yield* Effect.fail(SkillFailure.from(FailureCode.Yaml));
      }
      const root: PendingYamlNode = { node: document.contents, depth: 0 };
      if (!this.accepts(root))
        return yield* Effect.fail(SkillFailure.from(FailureCode.Yaml));
      // The parser's untyped output stays in this contiguous schema decoder.
      return yield* Effect.try((): unknown =>
        document.toJS(YamlRequest.conversion),
      ).pipe(
        Effect.mapError((error) => this.hostFailure(error)),
        Effect.flatMap((value) =>
          Schema.decodeUnknown(
            SkillRequestSchema.value,
            YamlRequest.admission,
          )(value).pipe(
            Effect.mapError((error) => SkillFailure.fromSchema(error)),
          ),
        ),
      );
    });
  }

  private hostFailure(error: Cause.UnknownException): SkillFailure {
    const request: HostFailureRequest = { code: FailureCode.Yaml, error };
    return SkillFailure.fromHost(request);
  }

  private accepts(root: PendingYamlNode): boolean {
    const pending: PendingYamlNode[] = [root];
    let count = 0;
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) return false;
      const { node, depth } = current;
      count += 1;
      if (
        depth > 24 ||
        count > 10000 ||
        isAlias(node) ||
        node.tag ||
        node.anchor
      )
        return false;
      if (isMap(node)) {
        for (const pair of node.items) {
          if (
            !isScalar(pair.key) ||
            typeof pair.key.value !== "string" ||
            pair.key.value === "<<" ||
            !pair.value
          )
            return false;
          const key: PendingYamlNode = { node: pair.key, depth: depth + 1 };
          const value: PendingYamlNode = { node: pair.value, depth: depth + 1 };
          pending.push(key, value);
        }
      } else if (isSeq(node)) {
        for (const item of node.items) {
          if (!item) return false;
          const child: PendingYamlNode = { node: item, depth: depth + 1 };
          pending.push(child);
        }
      } else if (!isScalar(node)) return false;
    }
    return true;
  }
}

export class YamlResponse {
  static readonly maximumBytes = 256 * 1024;
  constructor(private readonly response: SkillResponse) {}
  encode(): Effect.Effect<YamlText, SkillFailure> {
    return Effect.gen(this, function* () {
      const encoded = yield* Effect.try(() => stringify(this.response)).pipe(
        Effect.mapError((error) => {
          const request: HostFailureRequest = {
            code: FailureCode.Response,
            error,
          };
          return SkillFailure.fromHost(request);
        }),
      );
      if (Buffer.byteLength(encoded, "utf8") > YamlResponse.maximumBytes) {
        return yield* Effect.fail(SkillFailure.from(FailureCode.Response));
      }
      return ProtocolText.yaml(encoded);
    });
  }
}
