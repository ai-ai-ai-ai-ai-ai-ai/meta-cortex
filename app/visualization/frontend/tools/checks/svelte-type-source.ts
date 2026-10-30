import { Effect, Schema } from "effect";
import { parse } from "svelte/compiler";
import {
  SymbolFlags,
  type Project,
  type Symbol,
  type Type,
} from "typescript/unstable/async";
import { isTypeNode, type Node, type TypeNode } from "typescript/unstable/ast";
import type { AuthoredSvelteDiagnostic } from "./authored-svelte";

export interface TypedSvelteComponent {
  readonly source: string;
  readonly filepath: string;
  readonly projectedPath: string;
  generatedPosition(originalUtf16Offset: number): number | undefined;
}

export class SvelteTypeCheckFailure extends Schema.TaggedError<SvelteTypeCheckFailure>()(
  "SvelteTypeCheckFailure",
  {
    cause: Schema.Defect(),
  },
) {}

export interface SvelteNode {
  readonly original: object;
  readonly node: Readonly<Record<string, unknown>>;
  readonly ancestors: readonly SvelteNode[];
  readonly field: string;
}

export interface PropertyUse {
  readonly path: readonly string[];
  readonly spread: boolean;
}
export class SvelteSyntax {
  readonly nodes: SvelteNode[] = [];
  constructor(component: TypedSvelteComponent) {
    this.visit(
      parse(component.source, { modern: true, filename: component.filepath }),
      [],
      "",
    );
  }

  private visit(
    value: unknown,
    ancestors: readonly SvelteNode[],
    field: string,
  ): void {
    switch (typeof value) {
      case "object":
        this.object(value, ancestors, field);
        return;
      case "bigint":
      case "boolean":
      case "function":
      case "number":
      case "string":
      case "symbol":
      case "undefined":
        return;
    }
  }

  private object(
    value: object | null,
    ancestors: readonly SvelteNode[],
    field: string,
  ): void {
    switch (value) {
      case null:
        return;
      default:
        this.entries(value, ancestors, field);
    }
  }

  private entries(
    original: object,
    ancestors: readonly SvelteNode[],
    field: string,
  ): void {
    const node: Record<string, unknown> = Object.fromEntries(
      Object.entries(original),
    );
    const next = this.index({ original, node, ancestors, field });
    for (const [key, child] of Object.entries(node)) {
      switch (key) {
        case "loc":
        case "metadata":
        case "comments":
        case "leadingComments":
        case "trailingComments":
          break;
        default:
          this.visit(child, next, key);
      }
    }
  }

  private index(entry: SvelteNode): readonly SvelteNode[] {
    switch (typeof entry.node.type) {
      case "string":
        this.nodes.push(entry);
        return [...entry.ancestors, entry];
      case "bigint":
      case "boolean":
      case "function":
      case "number":
      case "object":
      case "symbol":
      case "undefined":
        return entry.ancestors;
    }
  }

  children(entry: SvelteNode): readonly SvelteNode[] {
    return this.nodes.filter((child) => child.ancestors.at(-1) === entry);
  }

  field(entry: SvelteNode, key: string): readonly SvelteNode[] {
    return this.children(entry).filter(
      (child) => child.original === entry.node[key],
    );
  }

  names(entry: SvelteNode): readonly string[] {
    switch (entry.node.type) {
      case "Identifier":
        return this.string(entry.node.name);
      case "Literal":
        return this.string(entry.node.value);
      default:
        return [];
    }
  }

  private string(value: unknown): readonly string[] {
    switch (typeof value) {
      case "string":
        return [value];
      case "bigint":
      case "boolean":
      case "function":
      case "number":
      case "object":
      case "symbol":
      case "undefined":
        return [];
    }
  }

  range(entry: SvelteNode): { readonly start: number; readonly end: number } {
    return {
      start: this.offset(entry.node.start),
      end: this.offset(entry.node.end),
    };
  }

  private offset(value: unknown): number {
    switch (typeof value) {
      case "number":
        return value;
      case "bigint":
      case "boolean":
      case "function":
      case "object":
      case "string":
      case "symbol":
      case "undefined":
        throw new Error("Svelte compiler node has no original source range");
    }
  }

  propertyUse(reference: SvelteNode): PropertyUse {
    return this.followPath(
      reference.original,
      reference.ancestors.slice().reverse(),
      [],
    );
  }

  private followPath(
    current: object,
    parents: readonly SvelteNode[],
    path: readonly string[],
  ): PropertyUse {
    const parent = parents.at(0);
    switch (parent) {
      case undefined:
        return { path, spread: false };
      default:
        return this.parentUse(current, parent, parents.slice(1), path);
    }
  }

  private parentUse(
    current: object,
    parent: SvelteNode,
    parents: readonly SvelteNode[],
    path: readonly string[],
  ): PropertyUse {
    switch (parent.node.type) {
      case "MemberExpression":
        return this.memberUse(current, parent, parents, path);
      case "SpreadElement":
      case "SpreadAttribute":
        return { path, spread: true };
      default:
        return { path, spread: false };
    }
  }

  private memberUse(
    current: object,
    parent: SvelteNode,
    parents: readonly SvelteNode[],
    path: readonly string[],
  ): PropertyUse {
    switch (parent.node.object) {
      case current:
        return this.followPath(parent.original, parents, [
          ...path,
          ...this.field(parent, "property").flatMap((property) =>
            this.names(property),
          ),
        ]);
      default:
        return { path, spread: false };
    }
  }
}

export class SvelteTypeSource {
  constructor(readonly project: Project) {}
  native<Value>(
    operation: () => Promise<Value>,
  ): Effect.Effect<Value, SvelteTypeCheckFailure> {
    return Effect.tryPromise({
      try: operation,
      catch: (cause) => new SvelteTypeCheckFailure({ cause }),
    });
  }

  position(
    component: TypedSvelteComponent,
    original: number,
  ): Effect.Effect<number, SvelteTypeCheckFailure> {
    return Effect.try({
      try: () => {
        const generated = component.generatedPosition(original);
        switch (generated) {
          case undefined:
            throw new Error(
              `Missing native type mapping for ${component.filepath}:${original}`,
            );
          default:
            return generated;
        }
      },
      catch: (cause) => new SvelteTypeCheckFailure({ cause }),
    });
  }

  typeAt(
    component: TypedSvelteComponent,
    offset: number,
  ): Effect.Effect<Type, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const position = yield* this.position(component, offset);
      const type = yield* this.native(() =>
        this.project.checker.getTypeAtPosition(
          component.projectedPath,
          position,
        ),
      );
      switch (type) {
        case undefined:
          return yield* Effect.fail(
            new SvelteTypeCheckFailure({
              cause: new Error(
                `Native TS7 returned no type at ${component.filepath}:${offset}`,
              ),
            }),
          );
        default:
          return type;
      }
    });
  }

  annotationType(
    component: TypedSvelteComponent,
    offset: number,
  ): Effect.Effect<Type, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const position = yield* this.position(component, offset);
      const source = yield* this.native(() =>
        this.project.program.getSourceFile(component.projectedPath),
      );
      switch (source) {
        case undefined:
          return yield* Effect.fail(
            new SvelteTypeCheckFailure({
              cause: new Error(
                `Native TS7 source unavailable: ${component.projectedPath}`,
              ),
            }),
          );
        default: {
          const candidates = this.typeNodes(source, position);
          const annotation = candidates.at(0);
          switch (annotation) {
            case undefined:
              return yield* Effect.fail(
                new SvelteTypeCheckFailure({
                  cause: new Error(
                    `Native TS7 annotation unavailable at ${component.filepath}:${offset}`,
                  ),
                }),
              );
            default:
              return yield* this.requiredAnnotationType(annotation);
          }
        }
      }
    });
  }

  private typeNodes(node: Node, position: number): readonly TypeNode[] {
    const candidates: TypeNode[] = [];
    switch (true) {
      case isTypeNode(node):
        switch (position >= node.pos && position < node.end) {
          case true:
            candidates.push(node);
            break;
          case false:
            break;
        }
        break;
      case true:
        break;
    }
    node.forEachChild((child) => {
      candidates.push(...this.typeNodes(child, position));
    });
    return candidates;
  }

  private requiredAnnotationType(
    annotation: TypeNode,
  ): Effect.Effect<Type, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const type = yield* this.native(() =>
        this.project.checker.getTypeFromTypeNode(annotation),
      );
      switch (type) {
        case undefined:
          return yield* Effect.fail(
            new SvelteTypeCheckFailure({
              cause: new Error("Native TS7 annotation type unavailable"),
            }),
          );
        default:
          return type;
      }
    });
  }

  symbolAt(
    component: TypedSvelteComponent,
    offset: number,
  ): Effect.Effect<Symbol, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const position = yield* this.position(component, offset);
      const symbol = yield* this.native(() =>
        this.project.checker.getSymbolAtPosition(
          component.projectedPath,
          position,
        ),
      );
      switch (symbol) {
        case undefined:
          return yield* Effect.fail(
            new SvelteTypeCheckFailure({
              cause: new Error(
                `Native TS7 returned no symbol at ${component.filepath}:${offset}`,
              ),
            }),
          );
        default:
          return symbol;
      }
    });
  }

  namedTypeAt(
    component: TypedSvelteComponent,
    name: string,
    scopeOffset: number,
  ): Effect.Effect<Type, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const position = yield* this.position(component, scopeOffset);
      const symbol = yield* this.native(() =>
        this.project.checker.resolveName(name, SymbolFlags.Value, {
          document: component.projectedPath,
          position,
        }),
      );
      switch (symbol) {
        case undefined:
          return yield* Effect.fail(
            new SvelteTypeCheckFailure({
              cause: new Error(
                `Native TS7 directive binding unavailable: ${name}`,
              ),
            }),
          );
        default:
          return yield* this.symbolType(symbol);
      }
    });
  }

  apparentType(type: Type): Effect.Effect<Type, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const apparent = yield* this.native(() =>
        this.project.checker.getApparentType(type),
      );
      switch (apparent) {
        case undefined:
          return yield* Effect.fail(
            new SvelteTypeCheckFailure({
              cause: new Error("Native TS7 apparent type unavailable"),
            }),
          );
        default:
          return apparent;
      }
    });
  }

  finding(
    syntax: SvelteSyntax,
    entry: SvelteNode,
    rule: string,
    message: string,
  ): AuthoredSvelteDiagnostic {
    return { ...syntax.range(entry), severity: "error", rule, message };
  }

  symbolType(symbol: Symbol): Effect.Effect<Type, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const type = yield* this.native(() =>
        this.project.checker.getTypeOfSymbol(symbol),
      );
      switch (type) {
        case undefined:
          return yield* Effect.fail(
            new SvelteTypeCheckFailure({
              cause: new Error(
                `Native TS7 returned no type for ${symbol.name}`,
              ),
            }),
          );
        default:
          return type;
      }
    });
  }
}
