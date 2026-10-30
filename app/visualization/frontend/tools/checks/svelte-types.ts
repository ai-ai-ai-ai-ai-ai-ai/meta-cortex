import { Effect } from "effect";
import {
  SymbolFlags,
  SignatureKind,
  TypeFlags,
  type Project,
  type Symbol,
  type Type,
} from "typescript/unstable/async";
import type { AuthoredSvelteDiagnostic } from "./authored-svelte";
import {
  SvelteTypeSource,
  SvelteTypeCheckFailure,
  SvelteSyntax,
  type SvelteNode,
  type PropertyUse,
  type TypedSvelteComponent,
} from "./svelte-type-source";
import { SvelteStoreTypes } from "./svelte-store-types";
export type { TypedSvelteComponent } from "./svelte-type-source";
export { SvelteTypeCheckFailure } from "./svelte-type-source";

interface PropsUsage {
  readonly paths: readonly string[];
  readonly spreads: readonly string[];
  readonly declared: readonly string[];
}

interface PropsCheckRequest {
  readonly component: TypedSvelteComponent;
  readonly syntax: SvelteSyntax;
  readonly report: SvelteNode;
  readonly usage: PropsUsage;
  readonly type: Type;
  readonly path: readonly string[];
  readonly checked: Set<number>;
}

export class SvelteTypeChecks {
  private readonly types: SvelteTypeSource;
  constructor(project: Project) {
    this.types = new SvelteTypeSource(project);
  }
  check(
    component: TypedSvelteComponent,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return Effect.gen({ self: this }, function* () {
      const syntax = yield* Effect.try({
        try: () => new SvelteSyntax(component),
        catch: (cause) => new SvelteTypeCheckFailure({ cause }),
      });
      const props = yield* this.props(component, syntax);
      const stores = yield* new SvelteStoreTypes(this.types).check(
        component,
        syntax,
      );
      return [...props, ...stores.flat()].sort(
        (left, right) => left.start - right.start,
      );
    });
  }

  private props(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return Effect.forEach(
      syntax.nodes.filter((entry) => this.propsDeclaration(syntax, entry)),
      (entry) => this.unusedProps(component, syntax, entry),
    ).pipe(Effect.map((findings) => findings.flat()));
  }

  private propsDeclaration(syntax: SvelteSyntax, entry: SvelteNode): boolean {
    return (
      entry.node.type === "VariableDeclarator" &&
      syntax
        .field(entry, "init")
        .some(
          (init) =>
            init.node.type === "CallExpression" &&
            syntax
              .field(init, "callee")
              .some(
                (callee) =>
                  callee.node.type === "Identifier" &&
                  callee.node.name === "$props",
              ),
        )
    );
  }

  private unusedProps(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    declaration: SvelteNode,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return Effect.forEach(syntax.field(declaration, "id"), (pattern) =>
      this.unusedPattern(component, syntax, pattern),
    ).pipe(Effect.map((findings) => findings.flat()));
  }

  private unusedPattern(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    pattern: SvelteNode,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return Effect.gen({ self: this }, function* () {
      const annotations = syntax
        .field(pattern, "typeAnnotation")
        .flatMap((annotation) => syntax.field(annotation, "typeAnnotation"));
      switch (annotations.length) {
        case 0:
          return [];
      }
      switch (
        syntax
          .children(pattern)
          .some((child) => child.node.type === "RestElement")
      ) {
        case true:
          return [];
        case false:
          break;
      }
      const usage = yield* this.propsUsage(component, syntax, pattern);
      const findings = yield* Effect.forEach(annotations, (annotation) =>
        this.checkPropsType(component, syntax, pattern, annotation, usage),
      );
      return findings.flat();
    });
  }

  private propsUsage(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    pattern: SvelteNode,
  ): Effect.Effect<PropsUsage, SvelteTypeCheckFailure> {
    switch (pattern.node.type) {
      case "Identifier":
        return this.bindingUses(component, syntax, pattern).pipe(
          Effect.map((uses) => this.usage(uses, [])),
        );
      case "ObjectPattern":
        return Effect.gen({ self: this }, function* () {
          const properties = syntax
            .children(pattern)
            .filter((child) => child.node.type === "Property");
          const names = properties.flatMap((property) =>
            this.propertyNames(syntax, property),
          );
          const uses = yield* Effect.forEach(properties, (property) =>
            this.destructuredUses(component, syntax, property),
          );
          return this.usage(uses.flat(), names);
        });
      default:
        return Effect.succeed({ paths: [], spreads: [], declared: [] });
    }
  }

  private usage(
    uses: readonly PropertyUse[],
    declared: readonly string[],
  ): PropsUsage {
    return {
      paths: uses.filter((use) => !use.spread).map((use) => use.path.join(".")),
      spreads: uses
        .filter((use) => use.spread)
        .map((use) => use.path.join(".")),
      declared,
    };
  }

  private destructuredUses(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    property: SvelteNode,
  ): Effect.Effect<readonly PropertyUse[], SvelteTypeCheckFailure> {
    const bindings = syntax
      .field(property, "value")
      .flatMap((value) => this.bindingIdentifiers(syntax, value));
    return Effect.forEach(bindings, (binding) =>
      this.bindingUses(component, syntax, binding).pipe(
        Effect.map((uses) => this.prefixedUses(syntax, binding, uses)),
      ),
    ).pipe(Effect.map((uses) => uses.flat()));
  }

  private propertyNames(
    syntax: SvelteSyntax,
    property: SvelteNode,
  ): readonly string[] {
    return syntax.field(property, "key").flatMap((key) => syntax.names(key));
  }

  private prefixedUses(
    syntax: SvelteSyntax,
    binding: SvelteNode,
    uses: readonly PropertyUse[],
  ): readonly PropertyUse[] {
    return uses.map((use) => ({
      ...use,
      path: [...syntax.names(binding), ...use.path],
    }));
  }

  private bindingIdentifiers(
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly SvelteNode[] {
    switch (entry.node.type) {
      case "Identifier":
        return [entry];
      case "AssignmentPattern":
        return syntax
          .field(entry, "left")
          .filter((child) => child.node.type === "Identifier");
      default:
        return [];
    }
  }

  private bindingUses(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    binding: SvelteNode,
  ): Effect.Effect<readonly PropertyUse[], SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const symbol = yield* this.types.symbolAt(
        component,
        syntax.range(binding).start,
      );
      const references = syntax.nodes.filter(
        (reference) =>
          reference.node.type === "Identifier" &&
          reference.node.name === binding.node.name &&
          syntax.range(reference).start !== syntax.range(binding).start,
      );
      const uses = yield* Effect.forEach(references, (reference) =>
        this.referenceUse(component, syntax, reference, symbol),
      );
      return uses.flat();
    });
  }

  private referenceUse(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    reference: SvelteNode,
    symbol: Symbol,
  ): Effect.Effect<readonly PropertyUse[], SvelteTypeCheckFailure> {
    return this.types.symbolAt(component, syntax.range(reference).start).pipe(
      Effect.map((resolved) => {
        switch (resolved.id) {
          case symbol.id:
            return [syntax.propertyUse(reference)];
          default:
            return [];
        }
      }),
    );
  }

  private checkPropsType(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    report: SvelteNode,
    annotation: SvelteNode,
    usage: PropsUsage,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return this.types
      .annotationType(component, syntax.range(annotation).start)
      .pipe(
        Effect.flatMap((type) =>
          this.unusedProperties({
            component,
            syntax,
            report,
            usage,
            type,
            path: [],
            checked: new Set<number>(),
          }),
        ),
      );
  }

  private unusedProperties(
    request: PropsCheckRequest,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return Effect.gen({ self: this }, function* () {
      switch (
        request.checked.has(request.type.id) ||
        (yield* this.classType(request.type))
      ) {
        case true:
          return [];
        case false:
          break;
      }
      request.checked.add(request.type.id);
      const properties = yield* this.types.native(() =>
        this.types.project.checker.getPropertiesOfType(request.type),
      );
      const findings = yield* Effect.forEach(properties, (property) =>
        this.unusedProperty(request, property),
      );
      const indexFindings = yield* this.unusedIndex(request);
      return [...findings.flat(), ...indexFindings];
    });
  }

  private unusedIndex(
    request: PropsCheckRequest,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    switch (request.path.length === 0 && request.usage.declared.length > 0) {
      case false:
        return Effect.succeed([]);
      case true:
        break;
    }
    return this.types
      .native(() =>
        this.types.project.checker.getIndexInfosOfType(request.type),
      )
      .pipe(
        Effect.map((indices) => {
          switch (
            indices.some(
              (index) =>
                (index.keyType.flags &
                  (TypeFlags.String | TypeFlags.Number)) !==
                  0 && (index.valueType.flags & TypeFlags.Any) === 0,
            )
          ) {
            case true:
              return [
                this.types.finding(
                  request.syntax,
                  request.report,
                  "svelte/no-unused-props",
                  "Index signature is unused. Consider using rest operator (...) to capture remaining properties.",
                ),
              ];
            case false:
              return [];
          }
        }),
      );
  }

  private classType(
    type: Type,
  ): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const constructors = yield* this.types.native(() =>
        this.types.project.checker.getSignaturesOfType(
          type,
          SignatureKind.Construct,
        ),
      );
      switch (constructors.length) {
        case 0:
          break;
        default:
          return true;
      }
      const symbol = yield* this.types.native(() => type.getSymbol());
      switch (symbol) {
        case undefined:
          return false;
        default:
          return (symbol.flags & SymbolFlags.Class) !== 0;
      }
    });
  }

  private unusedProperty(
    request: PropsCheckRequest,
    property: Symbol,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return this.internalProperty(request.component, property).pipe(
      Effect.flatMap((internal) => {
        switch (internal) {
          case false:
            return Effect.succeed([]);
          case true:
            return this.usedProperty(request, property);
        }
      }),
    );
  }

  private internalProperty(
    component: TypedSvelteComponent,
    property: Symbol,
  ): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const source = yield* this.types.native(() =>
        this.types.project.program.getSourceFile(component.projectedPath),
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
        default:
          return (
            property.declarations.length > 0 &&
            property.declarations.every(
              (declaration) => declaration.path === source.path,
            )
          );
      }
    });
  }

  private usedProperty(
    request: PropsCheckRequest,
    property: Symbol,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    const path = [...request.path, property.name];
    const joined = path.join(".");
    const used =
      request.usage.paths.includes(joined) ||
      request.usage.spreads.some(
        (spread) =>
          spread === "" || spread === joined || spread.startsWith(`${joined}.`),
      );
    const nested = request.usage.paths.some((usedPath) =>
      usedPath.startsWith(`${joined}.`),
    );
    switch (used && !nested) {
      case true:
        return Effect.succeed([]);
      case false:
        break;
    }
    switch (nested || request.usage.declared.includes(property.name)) {
      case false:
        return Effect.succeed([
          this.types.finding(
            request.syntax,
            request.report,
            "svelte/no-unused-props",
            this.unusedMessage(property.name, request.path),
          ),
        ]);
      case true:
        return this.types
          .symbolType(property)
          .pipe(
            Effect.flatMap((type) =>
              this.unusedProperties({ ...request, type, path }),
            ),
          );
    }
  }

  private unusedMessage(name: string, parent: readonly string[]): string {
    switch (parent.length) {
      case 0:
        return `'${name}' is an unused Props property.`;
      default:
        return `'${name}' in '${parent.join(".")}' is an unused property.`;
    }
  }
}
