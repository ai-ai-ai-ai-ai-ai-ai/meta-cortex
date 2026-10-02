import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Cause, Effect, Schema } from "effect";
import type { ParseOptions } from "effect/SchemaAST";
import {
  parseDocument,
  visit,
  isScalar,
  type visitor,
  type Scalar,
} from "yaml";
import { ContextSchema } from "./context-schema.ts";

enum ExportKind {
  Stage = "stages",
  Statement = "statements",
}
type ContextValue =
  typeof ContextSchema.stage.Type | typeof ContextSchema.statement.Type;
interface ContextReference {
  readonly kind: ExportKind;
  readonly $ref: string;
}
interface ReferenceCheck {
  readonly reference: ContextReference;
  readonly ancestors: readonly string[];
}
interface ContextUse {
  readonly kind: ExportKind;
  readonly value: ContextValue;
}
type CheckFailure =
  Cause.UnknownError | Schema.SchemaError | ContextValidationError;
interface SyntaxIssues {
  readonly messages: readonly string[];
  readonly keys: readonly Scalar[];
}

/** Validate schema data and the named export graph; commands stay literal data. */
export class ContextCheck {
  private static readonly admission: ParseOptions = {
    onExcessProperty: "error",
  };
  constructor(private readonly path: string) {}

  static readonly failureFields = {
    message: Schema.String,
  } satisfies Schema.Struct.Fields;
  private syntax(document: ReturnType<typeof parseDocument>): SyntaxIssues {
    const messages = [...document.errors, ...document.warnings].map(
      (error) => error.message,
    );
    const keys: Scalar[] = [];
    const callbacks: visitor = {
      Alias: () => {
        messages.push(
          "Use explicit $ref declarations instead of YAML aliases.",
        );
      },
      Node: (...request) => {
        switch (request[1].tag) {
          case undefined:
            break;
          default:
            messages.push("Explicit YAML tags are not context vocabulary.");
        }
      },
      Pair: (...request) => {
        switch (true) {
          case isScalar(request[1].key):
            keys.push(request[1].key);
            break;
          case true:
            messages.push("Context map keys must be literal strings.");
        }
      },
    };
    visit(document, callbacks);
    return { messages, keys };
  }
  readonly read = Effect.fnUntraced(function* (this: ContextCheck) {
    const document = yield* Effect.try(() =>
      parseDocument(readFileSync(this.path, "utf8")),
    );
    const issues = this.syntax(document);
    for (const message of issues.messages) {
      return yield* ContextCheck.reject(message);
    }
    for (const key of issues.keys) {
      yield* Schema.decodeUnknownEffect(ContextSchema.text)(key.value);
    }
    return yield* Schema.decodeUnknownEffect(
      ContextSchema.document,
      ContextCheck.admission,
    )(document.toJS());
  });

  static readonly command = Effect.fnUntraced(function* (
    paths: readonly string[],
  ) {
    const selected = [...paths];
    switch (selected.length) {
      case 0: {
        const options: Parameters<Glob["scanSync"]>[0] = {
          cwd: process.cwd(),
          absolute: true,
          onlyFiles: true,
        };
        selected.push(
          ...new Glob("**/{AGENTS,*.context}.yaml").scanSync(options),
        );
        break;
      }
      default:
        break;
    }
    switch (selected.length) {
      case 0: {
        const message = "No YAML context declarations found.";
        return yield* ContextCheck.reject(message);
      }
      default:
        break;
    }
    for (const path of selected) {
      yield* new ContextCheck(resolve(path)).run();
    }
    console.log(`Validated ${selected.length} YAML context declarations.`);
  });

  readonly run = Effect.fnUntraced(function* (this: ContextCheck) {
    const document = yield* this.read();
    const uses: ContextUse[] = Object.values(document.stages).map((value) => ({
      kind: ExportKind.Stage,
      value,
    }));
    switch (document.exports) {
      case undefined:
        break;
      default:
        uses.push(
          ...Object.values(document.exports.stages).map((value) => ({
            kind: ExportKind.Stage,
            value,
          })),
        );
        uses.push(
          ...Object.values(document.exports.statements).map((value) => ({
            kind: ExportKind.Statement,
            value,
          })),
        );
    }
    for (const reference of uses.flatMap((use) => this.references(use))) {
      const request: ReferenceCheck = { reference, ancestors: [] };
      yield* this.checkReference(request);
    }
  });

  private references(use: ContextUse): ContextReference[] {
    const value = use.value;
    switch (typeof value) {
      case "object":
        break;
      case "string":
      case "number":
      case "bigint":
      case "boolean":
      case "symbol":
      case "undefined":
      case "function":
        return [];
    }
    switch (true) {
      case "$ref" in value:
        return [{ kind: use.kind, $ref: value.$ref }];
      case "spec" in value:
        return Object.values(value.spec)
          .concat(
            Object.values(value.Required.statements),
            Object.values(value.Prohibited.statements),
          )
          .flatMap((value) => {
            const statement: ContextUse = { kind: ExportKind.Statement, value };
            return this.references(statement);
          });
      case true:
        return [];
    }
    return [];
  }

  private readonly checkReference = this.referenceChecker();
  private referenceChecker() {
    const owner = this;
    return Effect.fnUntraced(function* (
      request: ReferenceCheck,
    ): Effect.fn.Return<void, CheckFailure> {
      const [file = "", ...fragments] = request.reference.$ref.split("#");
      const pointer = fragments.join("#");
      const [, , kind = "", escaped = ""] = pointer.split("/");
      switch (kind) {
        case request.reference.kind:
          break;
        default:
          return yield* ContextCheck.reject(
            `Wrong-kind context reference: ${request.reference.$ref}`,
          );
      }
      const path = resolve(dirname(owner.path), file);
      const identity = `${path}#${pointer}`;
      switch (request.ancestors.includes(identity)) {
        case true:
          return yield* ContextCheck.reject(
            `Cyclic context reference: ${identity}`,
          );
        case false:
          break;
      }
      const target = new ContextCheck(path);
      const document = yield* target.read();
      const name = escaped.replaceAll("~1", "/").replaceAll("~0", "~");
      const exports = document.exports;
      switch (exports) {
        case undefined:
          return yield* ContextCheck.reject(
            `Unresolved context export: ${identity}`,
          );
        default:
          break;
      }
      const values = exports[request.reference.kind];
      switch (Object.hasOwn(values, name)) {
        case false:
          return yield* ContextCheck.reject(
            `Unresolved context export: ${identity}`,
          );
        case true:
          break;
      }
      const value = values[name];
      switch (value) {
        case undefined:
          return yield* ContextCheck.reject(
            `Unresolved context export: ${identity}`,
          );
        default:
          break;
      }
      const use: ContextUse = { kind: request.reference.kind, value };
      for (const reference of target.references(use)) {
        const next: ReferenceCheck = {
          reference,
          ancestors: [...request.ancestors, identity],
        };
        yield* target.checkReference(next);
      }
    });
  }
  private static reject(message: string) {
    const payload: ConstructorParameters<typeof ContextValidationError>[0] = {
      message,
    };
    return Effect.fail(new ContextValidationError(payload));
  }
}

export class ContextValidationError extends Schema.TaggedError<ContextValidationError>()(
  "ContextValidationError",
  ContextCheck.failureFields,
) {}
