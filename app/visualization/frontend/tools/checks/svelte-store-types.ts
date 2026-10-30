import { Effect } from "effect";
import {
  SignatureKind,
  type Signature,
  type Symbol,
  type Type,
} from "typescript/unstable/async";
import type { AuthoredSvelteDiagnostic } from "./authored-svelte";
import {
  SvelteTypeSource,
  SvelteTypeCheckFailure,
  SvelteSyntax,
  type SvelteNode,
  type TypedSvelteComponent,
} from "./svelte-type-source";

enum StoreUse {
  Any = "any",
  Consistent = "consistent",
}
enum StoreTargetKind {
  Expression = "expression",
  DirectiveName = "directiveName",
}
type StoreTarget =
  | {
      readonly kind: StoreTargetKind.Expression;
      readonly node: SvelteNode;
      readonly use: StoreUse;
    }
  | {
      readonly kind: StoreTargetKind.DirectiveName;
      readonly node: SvelteNode;
      readonly use: StoreUse;
      readonly scope: SvelteNode;
      readonly name: string;
    };
export class SvelteStoreTypes {
  constructor(private readonly types: SvelteTypeSource) {}
  check(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return Effect.try({
      try: () => this.storeTargets(component, syntax),
      catch: (cause) => new SvelteTypeCheckFailure({ cause }),
    }).pipe(
      Effect.flatMap((targets) =>
        Effect.forEach(targets, (target) =>
          this.store(component, syntax, target),
        ),
      ),
      Effect.map((findings) => findings.flat()),
    );
  }
  private storeTargets(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
  ): readonly StoreTarget[] {
    return syntax.nodes.flatMap((node) =>
      this.targets(component, syntax, node),
    );
  }

  private targets(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly StoreTarget[] {
    switch (entry.node.type) {
      case "UseDirective":
      case "TransitionDirective":
      case "AnimateDirective":
        return this.directiveTargets(component, syntax, entry);
      case "StyleDirective":
        return this.styleTargets(component, syntax, entry);
      case "ExpressionTag":
        return this.mustacheTargets(syntax, entry);
      case "SpreadAttribute":
      case "EachBlock":
      case "OnDirective":
        return this.targetField(syntax, entry, "expression", StoreUse.Any);
      case "BindDirective":
        return this.bindingTargets(syntax, entry);
      case "SvelteComponent":
      case "SvelteElement":
        return this.targetField(syntax, entry, "expression", StoreUse.Any);
      case "ClassDirective":
      case "AwaitBlock":
        return this.targetField(
          syntax,
          entry,
          "expression",
          StoreUse.Consistent,
        );
      case "IfBlock":
        return this.targetField(syntax, entry, "test", StoreUse.Consistent);
      case "IfStatement":
      case "WhileStatement":
      case "DoWhileStatement":
      case "ConditionalExpression":
      case "ForStatement":
        return this.targetField(syntax, entry, "test", StoreUse.Consistent);
      case "ForInStatement":
      case "ForOfStatement":
        return this.targetField(syntax, entry, "right", StoreUse.Any);
      case "SwitchStatement":
        return this.targetField(syntax, entry, "discriminant", StoreUse.Any);
      case "CallExpression":
      case "NewExpression":
        return this.targetField(syntax, entry, "callee", StoreUse.Any);
      case "UpdateExpression":
      case "SpreadElement":
        return this.targetField(syntax, entry, "argument", StoreUse.Any);
      case "AwaitExpression":
        return this.targetField(syntax, entry, "argument", StoreUse.Consistent);
      case "UnaryExpression":
        return this.targetField(
          syntax,
          entry,
          "argument",
          this.unaryUse(entry),
        );
      case "BinaryExpression":
        return [
          ...this.targetField(syntax, entry, "left", this.binaryUse(entry)),
          ...this.targetField(syntax, entry, "right", this.binaryUse(entry)),
        ];
      case "LogicalExpression":
        return this.targetField(syntax, entry, "left", StoreUse.Consistent);
      case "TemplateLiteral":
        return syntax
          .children(entry)
          .filter((child) => child.node.type !== "TemplateElement")
          .map((node) => ({
            kind: StoreTargetKind.Expression,
            node,
            use: StoreUse.Any,
          }));
      case "TaggedTemplateExpression":
        return this.targetField(syntax, entry, "tag", StoreUse.Any);
      case "ImportExpression":
        return this.targetField(syntax, entry, "source", StoreUse.Any);
      case "AssignmentExpression":
        return this.assignmentTargets(syntax, entry);
      case "Property":
      case "PropertyDefinition":
      case "MethodDefinition":
        return this.computedTargets(syntax, entry);
      default:
        return [];
    }
  }

  private directiveTargets(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly StoreTarget[] {
    switch (typeof entry.node.name) {
      case "string":
        return this.namedDirective(component, syntax, entry, entry.node.name);
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

  private namedDirective(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    entry: SvelteNode,
    name: string,
  ): readonly StoreTarget[] {
    switch (name.includes(".")) {
      case true:
        return [];
      case false:
        break;
    }
    const start = component.source.indexOf(":", syntax.range(entry).start) + 1;
    return [
      {
        kind: StoreTargetKind.DirectiveName,
        scope: this.directiveScope(entry),
        name,
        node: {
          ...entry,
          node: { type: "Identifier", name, start, end: start + name.length },
        },
        use: StoreUse.Any,
      },
    ];
  }

  private directiveScope(entry: SvelteNode): SvelteNode {
    const scope = entry.ancestors.at(-1);
    switch (scope?.node.type) {
      case "RegularElement":
      case "Component":
      case "SvelteComponent":
      case "SvelteElement":
      case "SvelteSelf":
        return scope;
      default:
        throw new Error(
          "Named Svelte directive has no unambiguous element scope",
        );
    }
  }

  private styleTargets(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly StoreTarget[] {
    switch (entry.node.value) {
      case true:
        return this.directiveTargets(component, syntax, entry);
      default:
        return [];
    }
  }

  private bindingTargets(
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly StoreTarget[] {
    switch (entry.node.name) {
      case "this":
        break;
      default:
        switch (entry.ancestors.at(-1)?.node.type) {
          case "Component":
          case "SvelteComponent":
          case "SvelteSelf":
            return [];
        }
    }
    return syntax
      .field(entry, "expression")
      .flatMap((node) => this.bindingExpression(syntax, node));
  }

  private bindingExpression(
    syntax: SvelteSyntax,
    node: SvelteNode,
  ): readonly StoreTarget[] {
    switch (node.node.type) {
      case "SequenceExpression":
        return syntax.children(node).map((node) => ({
          kind: StoreTargetKind.Expression,
          node,
          use: StoreUse.Any,
        }));
      default:
        return [{ kind: StoreTargetKind.Expression, node, use: StoreUse.Any }];
    }
  }

  private targetField(
    syntax: SvelteSyntax,
    entry: SvelteNode,
    key: string,
    use: StoreUse,
  ): readonly StoreTarget[] {
    return syntax
      .field(entry, key)
      .map((node) => ({ kind: StoreTargetKind.Expression, node, use }));
  }

  private mustacheTargets(
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly StoreTarget[] {
    const attribute = entry.ancestors.at(-1);
    switch (attribute?.node.type) {
      case "Attribute":
        switch (this.acceptsStoreAttribute(attribute)) {
          case true:
            return [];
          case false:
            break;
        }
    }
    return this.targetField(syntax, entry, "expression", StoreUse.Any);
  }

  private acceptsStoreAttribute(attribute: SvelteNode): boolean {
    const parent = attribute.ancestors.at(-1);
    return (
      (parent?.node.type === "Component" ||
        parent?.node.type === "SvelteComponent" ||
        parent?.node.type === "SvelteSelf") &&
      typeof attribute.node.name === "string" &&
      !attribute.node.name.startsWith("--") &&
      (!Array.isArray(attribute.node.value) ||
        attribute.node.value.length === 1)
    );
  }

  private unaryUse(entry: SvelteNode): StoreUse {
    switch (entry.node.operator) {
      case "!":
      case "typeof":
        return StoreUse.Consistent;
      default:
        return StoreUse.Any;
    }
  }

  private binaryUse(entry: SvelteNode): StoreUse {
    switch (entry.node.operator) {
      case "==":
      case "!=":
      case "===":
      case "!==":
        return StoreUse.Consistent;
      default:
        return StoreUse.Any;
    }
  }

  private assignmentTargets(
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly StoreTarget[] {
    switch (entry.node.operator) {
      case "=":
        return [];
      default:
        return [
          ...this.targetField(syntax, entry, "left", StoreUse.Any),
          ...this.targetField(syntax, entry, "right", StoreUse.Any),
        ];
    }
  }

  private computedTargets(
    syntax: SvelteSyntax,
    entry: SvelteNode,
  ): readonly StoreTarget[] {
    switch (entry.node.computed) {
      case true:
        return this.targetField(syntax, entry, "key", StoreUse.Any);
      default:
        return [];
    }
  }

  private store(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    target: StoreTarget,
  ): Effect.Effect<
    readonly AuthoredSvelteDiagnostic[],
    SvelteTypeCheckFailure
  > {
    return Effect.gen({ self: this }, function* () {
      const type = yield* this.targetType(component, syntax, target);
      const apparent = yield* this.types.apparentType(type);
      const store = yield* this.isStore(apparent, target.use);
      switch (store) {
        case true:
          return [
            this.types.finding(
              syntax,
              target.node,
              "svelte/require-store-reactive-access",
              "Use the $ prefix or the get function to access reactive values instead of accessing the raw store.",
            ),
          ];
        case false:
          return [];
      }
    });
  }

  private targetType(
    component: TypedSvelteComponent,
    syntax: SvelteSyntax,
    target: StoreTarget,
  ): Effect.Effect<Type, SvelteTypeCheckFailure> {
    switch (target.kind) {
      case StoreTargetKind.Expression:
        return this.types.typeAt(component, syntax.range(target.node).start);
      case StoreTargetKind.DirectiveName:
        return this.types.namedTypeAt(
          component,
          target.name,
          syntax.range(target.scope).start,
        );
    }
  }

  private isStore(
    type: Type,
    use: StoreUse,
  ): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    switch (type.isUnionType()) {
      case true:
        return this.unionParts(type).pipe(
          Effect.flatMap((parts) =>
            Effect.forEach(parts, (part) => this.isStore(part, use)),
          ),
          Effect.map((matches) => this.unionMatches(matches, use)),
        );
      case false:
        return Effect.gen({ self: this }, function* () {
          const subscribe = yield* this.types.native(() =>
            this.types.project.checker.getPropertyOfType(type, "subscribe"),
          );
          switch (subscribe) {
            case undefined:
              return false;
            default:
              return yield* this.subscribe(subscribe, use);
          }
        });
    }
  }

  private subscribe(
    symbol: Symbol,
    use: StoreUse,
  ): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const type = yield* this.types.symbolType(symbol);
      switch (type.isUnionType()) {
        case true: {
          const parts = yield* this.unionParts(type);
          const matches = yield* Effect.forEach(parts, (part) =>
            this.subscribeSignatures(part),
          );
          return this.unionMatches(matches, use);
        }
        case false:
          return yield* this.subscribeSignatures(type);
      }
    });
  }

  private subscribeSignatures(
    type: Type,
  ): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const signatures = yield* this.types.native(() =>
        this.types.project.checker.getSignaturesOfType(
          type,
          SignatureKind.Call,
        ),
      );
      const matches = yield* Effect.forEach(signatures, (signature) =>
        this.subscribeSignature(signature),
      );
      return matches.includes(true);
    });
  }

  private subscribeSignature(
    signature: Signature,
  ): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const parameters = yield* this.types.native(() =>
        signature.getParameters(),
      );
      switch (parameters.length) {
        case 0:
        case 1:
          return false;
        default: {
          const callable = yield* Effect.forEach(
            parameters.slice(0, 2),
            (parameter) => this.parameterCallable(parameter),
          );
          return callable.every(Boolean);
        }
      }
    });
  }

  private parameterCallable(
    symbol: Symbol,
  ): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    return Effect.gen({ self: this }, function* () {
      const type = yield* this.types.symbolType(symbol);
      const parts = yield* this.unionParts(type);
      const matches = yield* Effect.forEach(parts, (part) =>
        this.callable(part),
      );
      return matches.includes(true);
    });
  }

  private callable(type: Type): Effect.Effect<boolean, SvelteTypeCheckFailure> {
    return this.types
      .native(() =>
        this.types.project.checker.getSignaturesOfType(
          type,
          SignatureKind.Call,
        ),
      )
      .pipe(Effect.map((signatures) => signatures.length > 0));
  }

  private unionParts(
    type: Type,
  ): Effect.Effect<readonly Type[], SvelteTypeCheckFailure> {
    switch (true) {
      case type.isUnionType():
        return this.types.native(() => type.getTypes());
      case true:
        break;
    }
    return Effect.succeed([type]);
  }

  private unionMatches(matches: readonly boolean[], use: StoreUse): boolean {
    switch (use) {
      case StoreUse.Any:
        return matches.includes(true);
      case StoreUse.Consistent:
        return matches.every(Boolean);
    }
  }
}
