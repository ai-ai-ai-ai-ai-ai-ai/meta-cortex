import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Effect, Schema, Match } from "effect";
import { ContextInput, ContextFailure } from "./context-input.ts";
import {
  ContextSchema,
  type ContextReference,
  type StageUse,
  type StatementUse,
} from "./context-schema.ts";
import type { Job, Stage, Statement } from "./lace.ts";

export interface ContextLoadRequest {
  readonly path: string;
  readonly ancestry: readonly string[];
}
interface ReferenceRequest {
  readonly reference: ContextReference;
  readonly kind: ReferenceKind;
}
enum ReferenceKind {
  Stage = "stages",
  Statement = "statements",
}

/** Resolve declarative context only. ShellCommand payloads never become processes. */
export class ContextLoader {
  constructor(private readonly request: ContextLoadRequest) {}
  readonly document = Effect.fnUntraced(function* (this: ContextLoader) {
    const readRequest = {
      try: () => readFileSync(this.request.path, "utf8"),
      // Foreign filesystem failure is translated at this read boundary.
      // eslint-disable-next-line @typescript-eslint/no-restricted-types
      catch: (cause: unknown) => {
        const failure: ConstructorParameters<typeof ContextFailure>[0] = {
          message: `Cannot read context ${this.request.path}`,
          cause,
        };
        return new ContextFailure(failure);
      },
    };
    const source = yield* Effect.try(readRequest);
    return yield* new ContextInput(source).decode();
  });
  private static rejection(message: string): ContextFailure {
    const request: ConstructorParameters<typeof ContextFailure>[0] = {
      message,
      cause: message,
    };
    return new ContextFailure(request);
  }
  readonly load = Effect.fnUntraced(function* (
    this: ContextLoader,
  ): Effect.fn.Return<Job, ContextFailure> {
    const document = yield* this.document();
    const stages: Record<string, Stage> = {};
    for (const [name, value] of Object.entries(document.stages)) {
      const descriptor: PropertyDescriptor = {
        value: yield* this.stage(value),
        enumerable: true,
        writable: true,
        configurable: true,
      };
      Object.defineProperty(stages, name, descriptor);
    }
    switch (document.exports) {
      case undefined:
        break;
      default:
        yield* Effect.forEach(
          Object.values(document.exports.stages),
          this.stage.bind(this),
        );
        yield* Effect.forEach(
          Object.values(document.exports.statements),
          this.statement.bind(this),
        );
    }
    return { stages };
  });
  private target(request: ReferenceRequest) {
    const owner = this;
    return Effect.gen(function* () {
      const pointer = yield* Schema.decodeUnknownEffect(ContextSchema.pointer)(
        request.reference.$ref,
      ).pipe(
        Effect.mapError((cause) => {
          const failure: ConstructorParameters<typeof ContextFailure>[0] = {
            message: `Malformed relative context reference: ${request.reference.$ref}`,
            cause,
          };
          return new ContextFailure(failure);
        }),
      );
      const [file = "", fragment = ""] = pointer.split("#");
      const [, , kind = "", escaped = ""] = fragment.split("/");
      switch (kind) {
        case request.kind:
          break;
        default:
          return yield* Effect.fail(
            ContextLoader.rejection(
              `Wrong-kind reference: expected ${request.kind}: ${pointer}`,
            ),
          );
      }
      const targetPath = resolve(dirname(owner.request.path), file);
      const identity = `${targetPath}#${fragment}`;
      switch (owner.request.ancestry.includes(identity)) {
        case true:
          return yield* Effect.fail(
            ContextLoader.rejection(`Cyclic context reference: ${identity}`),
          );
        case false:
          break;
      }
      const loadRequest: ContextLoadRequest = {
        path: targetPath,
        ancestry: [...owner.request.ancestry, identity],
      };
      const loader = new ContextLoader(loadRequest);
      const document = yield* loader.document();
      const name = escaped.replaceAll("~1", "/").replaceAll("~0", "~");
      switch (document.exports) {
        case undefined:
          return yield* Effect.fail(
            ContextLoader.rejection(`Unresolved context export: ${pointer}`),
          );
        default:
          return { loader, exports: document.exports, name };
      }
    });
  }
  stage(value: StageUse): Effect.Effect<Stage, ContextFailure> {
    const pattern = { $ref: Match.string };
    return Match.value(value).pipe(
      Match.when(pattern, (reference) => this.referencedStage(reference)),
      Match.orElse((stage) => this.inlineStage(stage)),
    );
  }
  private referencedStage(reference: ContextReference) {
    const owner = this;
    return Effect.gen(function* (): Effect.fn.Return<Stage, ContextFailure> {
      const request: ReferenceRequest = {
        reference,
        kind: ReferenceKind.Stage,
      };
      const target = yield* owner.target(request);
      switch (Object.hasOwn(target.exports.stages, target.name)) {
        case false:
          return yield* Effect.fail(
            ContextLoader.rejection(
              `Unresolved context export: ${reference.$ref}`,
            ),
          );
        case true:
          break;
      }
      const stage = target.exports.stages[target.name];
      switch (stage) {
        case undefined:
          return yield* Effect.fail(
            ContextLoader.rejection(`Unresolved Stage: ${reference.$ref}`),
          );
        default:
          return yield* target.loader.stage(stage);
      }
    });
  }
  private inlineStage(value: typeof ContextSchema.stage.Type) {
    const owner = this;
    return Effect.gen(function* (): Effect.fn.Return<Stage, ContextFailure> {
      return {
        spec: yield* owner.statements(value.spec),
        Required: {
          statements: yield* owner.statements(value.Required.statements),
        },
        Prohibited: {
          statements: yield* owner.statements(value.Prohibited.statements),
        },
      };
    });
  }
  statement(value: StatementUse): Effect.Effect<Statement, ContextFailure> {
    const pattern = { $ref: Match.string };
    return Match.value(value).pipe(
      Match.when(pattern, (reference) => this.referencedStatement(reference)),
      Match.orElse((statement) => Effect.succeed(statement)),
    );
  }
  private referencedStatement(reference: ContextReference) {
    const owner = this;
    return Effect.gen(function* (): Effect.fn.Return<
      Statement,
      ContextFailure
    > {
      const request: ReferenceRequest = {
        reference,
        kind: ReferenceKind.Statement,
      };
      const target = yield* owner.target(request);
      switch (Object.hasOwn(target.exports.statements, target.name)) {
        case false:
          return yield* Effect.fail(
            ContextLoader.rejection(
              `Unresolved context export: ${reference.$ref}`,
            ),
          );
        case true:
          break;
      }
      const statement = target.exports.statements[target.name];
      switch (statement) {
        case undefined:
          return yield* Effect.fail(
            ContextLoader.rejection(`Unresolved Statement: ${reference.$ref}`),
          );
        default:
          return yield* target.loader.statement(statement);
      }
    });
  }
  private statements(values: typeof ContextSchema.statements.Type) {
    const owner = this;
    return Effect.gen(function* () {
      const statements: Record<string, Statement> = {};
      for (const [name, value] of Object.entries(values)) {
        const descriptor: PropertyDescriptor = {
          value: yield* owner.statement(value),
          enumerable: true,
          writable: true,
          configurable: true,
        };
        Object.defineProperty(statements, name, descriptor);
      }
      return statements;
    });
  }
}
