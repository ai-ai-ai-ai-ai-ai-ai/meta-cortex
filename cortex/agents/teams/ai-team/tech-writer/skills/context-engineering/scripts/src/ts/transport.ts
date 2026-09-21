// YAML admission pattern adapted from Nook's executable-skill-host scripts.
import { Effect, Schema } from "effect";
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
import { SkillRequestSchema, type SkillRequest } from "./catalog.ts";
import { FailureCode, SkillFailure } from "./failure.ts";

export type PendingYamlNode = {
  readonly node: ParsedNode;
  readonly depth: number;
};

export class YamlRequest {
  static readonly maximumBytes = 64 * 1024;
  private static readonly options: ParseOptions &
    DocumentOptions &
    SchemaOptions = {
    strict: true,
    uniqueKeys: true,
    version: "1.2",
    schema: "core",
  };
  private static readonly conversion: ToJSOptions = { maxAliasCount: 0 };
  constructor(private readonly source: string) {}

  decode(): Effect.Effect<SkillRequest, SkillFailure> {
    return Effect.gen(this, function* () {
      if (Buffer.byteLength(this.source, "utf8") > YamlRequest.maximumBytes) {
        return yield* Effect.fail(SkillFailure.from(FailureCode.Request));
      }
      const document = yield* Effect.try({
        try: () => parseDocument(this.source, YamlRequest.options),
        catch: () => SkillFailure.from(FailureCode.Yaml),
      });
      if (
        document.errors.length > 0 ||
        document.warnings.length > 0 ||
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
      return yield* Effect.try({
        try: (): unknown => document.toJS(YamlRequest.conversion),
        catch: () => SkillFailure.from(FailureCode.Yaml),
      }).pipe(
        Effect.flatMap(
          Schema.decodeUnknown(SkillRequestSchema.value, {
            onExcessProperty: "error",
          }),
        ),
        Effect.mapError(() => SkillFailure.from(FailureCode.Request)),
      );
    });
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
          pending.push({ node: pair.key, depth: depth + 1 });
          pending.push({ node: pair.value, depth: depth + 1 });
        }
      } else if (isSeq(node)) {
        for (const item of node.items) {
          if (!item) return false;
          pending.push({ node: item, depth: depth + 1 });
        }
      } else if (!isScalar(node)) return false;
    }
    return true;
  }
}

export class YamlResponse {
  static readonly maximumBytes = 256 * 1024;
  constructor(private readonly response: SkillResponse) {}
  encode(): Effect.Effect<string, SkillFailure> {
    return Effect.gen(this, function* () {
      const encoded = yield* Effect.try({
        try: () => stringify(this.response),
        catch: () => SkillFailure.from(FailureCode.Response),
      });
      if (Buffer.byteLength(encoded, "utf8") > YamlResponse.maximumBytes) {
        return yield* Effect.fail(SkillFailure.from(FailureCode.Response));
      }
      return encoded;
    });
  }
}

import type { ArticleFindings } from "./article.ts";
import type { NavigationFindings } from "./navigation.ts";
import type { SkillCatalog, Command } from "./catalog.ts";
export enum ResponseKind {
  Catalog = "catalog",
  Findings = "findings",
  Failure = "failure",
}
export type SkillResponse =
  | {
      readonly kind: ResponseKind.Catalog;
      readonly catalog: ReturnType<SkillCatalog["describe"]>;
    }
  | {
      readonly kind: ResponseKind.Findings;
      readonly command: Command;
      readonly findings: ArticleFindings | NavigationFindings;
    }
  | {
      readonly kind: ResponseKind.Failure;
      readonly code: FailureCode;
      readonly recovery: string;
    };
