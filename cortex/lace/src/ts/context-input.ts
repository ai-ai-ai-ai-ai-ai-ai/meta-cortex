import { Effect, Schema } from "effect";
import type { ParseOptions } from "effect/SchemaAST";
import {
  parseDocument,
  visit,
  isScalar,
  type ParseOptions as YamlOptions,
  type visitor,
} from "yaml";
import { ContextSchema } from "./context-schema.ts";

class ContextFailureFields {
  static readonly value = {
    message: Schema.String,
    cause: Schema.Defect(),
  } satisfies Schema.Struct.Fields;
}

export class ContextFailure extends Schema.TaggedError<ContextFailure>()(
  "ContextFailure",
  ContextFailureFields.value,
) {}
/** Decode literal YAML syntax before admitting the concrete context contract. */
export class ContextInput {
  static readonly options: YamlOptions = { uniqueKeys: true, strict: true };
  static readonly admission: ParseOptions = { onExcessProperty: "error" };
  constructor(private readonly source: string) {}
  readonly decode = Effect.fnUntraced(function* (this: ContextInput) {
    const document = parseDocument(this.source, ContextInput.options);
    const issues: string[] = document.errors.map((error) => error.message);
    issues.push(...document.warnings.map((warning) => warning.message));
    const callbacks: visitor = {
      Alias: () => {
        issues.push(
          "Aliases are not literal context; use explicit $ref composition.",
        );
      },
      // yaml owns this fixed positional callback contract.
      Node: (...request) => {
        switch (request[1].tag) {
          case undefined:
            break;
          default:
            issues.push("Explicit YAML tags are not context vocabulary.");
        }
      },
      Pair: (...request) => {
        switch (true) {
          case isScalar(request[1].key):
            switch (typeof request[1].key.value) {
              case "string":
                break;
              case "number":
              case "bigint":
              case "boolean":
              case "symbol":
              case "undefined":
              case "object":
              case "function":
                issues.push("Context map keys must be explicit strings.");
            }
            break;
          case true:
            issues.push("Context map keys must be explicit strings.");
        }
      },
    };
    visit(document, callbacks);
    switch (issues.length) {
      case 0:
        break;
      default: {
        const failure: ConstructorParameters<typeof ContextFailure>[0] = {
          message: issues.join("\n"),
          cause: document.errors,
        };
        return yield* Effect.fail(new ContextFailure(failure));
      }
    }
    // The untyped YAML value exists only at its schema decoding boundary.
    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    const value: unknown = document.toJS();
    return yield* Schema.decodeUnknownEffect(
      ContextSchema.document,
      ContextInput.admission,
    )(value).pipe(
      Effect.mapError((cause) => {
        const failure: ConstructorParameters<typeof ContextFailure>[0] = {
          message: cause.message,
          cause,
        };
        return new ContextFailure(failure);
      }),
    );
  });
}
