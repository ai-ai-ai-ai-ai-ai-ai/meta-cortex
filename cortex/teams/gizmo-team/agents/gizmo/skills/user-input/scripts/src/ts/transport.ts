import { Cause, Effect, Schema } from "effect";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type ParsedNode,
  type ParseOptions,
  type DocumentOptions,
  type SchemaOptions,
  type ToJSOptions,
} from "yaml";
import type { ParseOptions as SchemaParseOptions } from "effect/SchemaAST";
import {
  FailureCode,
  InputFailure,
  SourceKind,
  type FailureDetail,
  type FailureContext,
} from "./failure.ts";
type YamlParseOptions = ParseOptions & DocumentOptions & SchemaOptions;

export type PendingYamlNode = {
  readonly node: ParsedNode;
  readonly depth: number;
};

export interface YamlDecodeRequest<A, I> {
  readonly source: string;
  readonly schema: Schema.Schema<A, I>;
}

export class YamlInput<A, I> {
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
  constructor(private readonly request: YamlDecodeRequest<A, I>) {}

  decode(): Effect.Effect<A, InputFailure> {
    return Effect.gen(this, function* () {
      if (
        Buffer.byteLength(this.request.source, "utf8") > YamlInput.maximumBytes
      ) {
        return yield* Effect.fail(this.failure(FailureCode.Yaml));
      }
      const document = yield* Effect.try(() =>
        parseDocument(this.request.source, YamlInput.options),
      ).pipe(Effect.mapError((error) => this.hostFailure(error)));
      if (document.errors.length > 0 || document.warnings.length > 0) {
        const context: FailureContext = {
          code: FailureCode.Yaml,
          message: "Malformed YAML or unsupported YAML syntax.",
          source: {
            kind: SourceKind.Yaml,
            errors: [...document.errors, ...document.warnings],
          },
        };
        return yield* Effect.fail(new InputFailure(context));
      }
      if (
        document.directives.yaml.explicit ||
        Object.keys(document.directives.tags).some(
          (handle) => handle !== "!!",
        ) ||
        !document.contents
      ) {
        return yield* Effect.fail(this.failure(FailureCode.Yaml));
      }
      const root: PendingYamlNode = { node: document.contents, depth: 0 };
      if (!this.accepts(root))
        return yield* Effect.fail(this.failure(FailureCode.Yaml));
      // The parser's untyped output stays in this contiguous schema decoder.
      return yield* Effect.try((): unknown =>
        document.toJS(YamlInput.conversion),
      ).pipe(
        Effect.mapError((error) => this.hostFailure(error)),
        Effect.flatMap((value) =>
          Schema.decodeUnknown(
            this.request.schema,
            YamlInput.admission,
          )(value).pipe(
            Effect.mapError((error) => {
              const context: FailureContext = {
                code: FailureCode.Schema,
                message: "Input does not match the documented schema.",
                source: { kind: SourceKind.Schema, error },
              };
              return new InputFailure(context);
            }),
          ),
        ),
      );
    });
  }

  private hostFailure(error: Cause.UnknownException): InputFailure {
    const context: FailureContext = {
      code: FailureCode.Yaml,
      message: "YAML parsing failed.",
      source: { kind: SourceKind.Host, error },
    };
    return new InputFailure(context);
  }

  private failure(code: FailureCode): InputFailure {
    const detail: FailureDetail = {
      code,
      message:
        "Input must match the documented YAML schema; aliases, tags, directives and duplicate keys are unsupported.",
    };
    return InputFailure.from(detail);
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
