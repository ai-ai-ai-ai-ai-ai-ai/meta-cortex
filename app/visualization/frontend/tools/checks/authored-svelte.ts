import { parse } from "svelte/compiler";

export interface AuthoredSvelteRequest {
  readonly source: string;
  readonly filepath: string;
  readonly allowConditionals: boolean;
}

export interface AuthoredSvelteDiagnostic {
  readonly rule: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly start: number;
  readonly end: number;
}

interface WalkContext {
  readonly parent: Readonly<Record<string, unknown>>;
  readonly field: string;
  readonly blocks: number;
  readonly callbacks: number;
}

/** Checks authored nodes, never the helper scopes in a generated TSX projection. */
class AuthoredSvelteCheck {
  private readonly diagnostics: AuthoredSvelteDiagnostic[] = [];

  constructor(private readonly request: AuthoredSvelteRequest) {}

  run(): readonly AuthoredSvelteDiagnostic[] {
    // The compiler owns parsing and its failures propagate to the caller.
    const root = parse(this.request.source, {
      modern: true,
      filename: this.request.filepath,
    });
    this.visit(root, { parent: {}, field: "", blocks: 0, callbacks: 0 });
    return this.diagnostics.sort(
      (left, right) =>
        left.start - right.start || left.rule.localeCompare(right.rule),
    );
  }

  private visit(value: unknown, context: WalkContext): void {
    switch (typeof value) {
      case "object":
        this.visitObject(value, context);
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

  private visitObject(value: object | null, context: WalkContext): void {
    switch (value) {
      case null:
        return;
      default:
        this.visitNode(value, context);
    }
  }

  private visitNode(value: object, context: WalkContext): void {
    const fields: Record<string, unknown> = Object.fromEntries(
      Object.entries(value),
    );
    const next = this.context(fields, context);
    for (const [key, child] of Object.entries(fields)) {
      switch (key) {
        case "loc":
        case "metadata":
        case "comments":
        case "leadingComments":
        case "trailingComments":
          break;
        default:
          this.visit(child, { ...next, field: key });
      }
    }
  }

  private context(
    node: Readonly<Record<string, unknown>>,
    context: WalkContext,
  ): WalkContext {
    switch (typeof node.type) {
      case "string":
        return this.syntaxContext(node, node.type, context);
      case "bigint":
      case "boolean":
      case "function":
      case "number":
      case "object":
      case "symbol":
      case "undefined":
        return context;
    }
  }

  private syntaxContext(
    node: Readonly<Record<string, unknown>>,
    type: string,
    context: WalkContext,
  ): WalkContext {
    this.restricted(node, type);
    switch (type) {
      case "Program":
      case "StaticBlock":
      case "FunctionDeclaration":
        return { ...context, parent: node, blocks: 0 };
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        return this.functionContext(node, context);
      case "IfStatement":
        return this.ifContext(node, context);
      case "SwitchStatement":
      case "TryStatement":
      case "DoWhileStatement":
      case "WhileStatement":
      case "WithStatement":
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
        return this.blockContext(node, context);
      default:
        return { ...context, parent: node };
    }
  }

  private restricted(
    node: Readonly<Record<string, unknown>>,
    type: string,
  ): void {
    switch (this.request.allowConditionals) {
      case true:
        return;
      case false:
        this.restrictedType(node, type);
    }
  }

  private restrictedType(
    node: Readonly<Record<string, unknown>>,
    type: string,
  ): void {
    switch (type) {
      case "IfStatement":
      case "ConditionalExpression":
        this.report(
          node,
          "no-restricted-syntax",
          `Using '${type}' is not allowed.`,
        );
    }
  }

  private ifContext(
    node: Readonly<Record<string, unknown>>,
    context: WalkContext,
  ): WalkContext {
    switch (context.parent.type) {
      case "IfStatement":
        switch (context.field) {
          case "alternate":
            return { ...context, parent: node };
        }
    }
    return this.blockContext(node, context);
  }

  private blockContext(
    node: Readonly<Record<string, unknown>>,
    context: WalkContext,
  ): WalkContext {
    const blocks = context.blocks + 1;
    switch (blocks) {
      case 1:
      case 2:
        break;
      default:
        this.report(
          node,
          "max-depth",
          `Blocks are nested too deeply (${blocks}). Maximum allowed is 2.`,
        );
    }
    return { ...context, parent: node, blocks };
  }

  private functionContext(
    node: Readonly<Record<string, unknown>>,
    context: WalkContext,
  ): WalkContext {
    switch (context.parent.type) {
      case "CallExpression":
      case "NewExpression":
        return this.callArgumentContext(node, context);
      default:
        return { ...context, parent: node, blocks: 0 };
    }
  }

  private callArgumentContext(
    node: Readonly<Record<string, unknown>>,
    context: WalkContext,
  ): WalkContext {
    switch (context.field) {
      case "callee":
        return { ...context, parent: node, blocks: 0 };
      default: {
        const callbacks = context.callbacks + 1;
        this.callbackDepth(node, callbacks);
        return { ...context, parent: node, blocks: 0, callbacks };
      }
    }
  }

  private callbackDepth(
    node: Readonly<Record<string, unknown>>,
    callbacks: number,
  ): void {
    switch (callbacks) {
      case 1:
      case 2:
        return;
      default:
        this.report(
          node,
          "max-nested-callbacks",
          `Too many nested callbacks (${callbacks}). Maximum allowed is 2.`,
        );
    }
  }

  private report(
    node: Readonly<Record<string, unknown>>,
    rule: string,
    message: string,
  ): void {
    switch (typeof node.start) {
      case "number":
        this.reportEnd(node, {
          rule,
          message,
          severity: "error",
          start: node.start,
        });
        return;
      case "bigint":
      case "boolean":
      case "function":
      case "object":
      case "string":
      case "symbol":
      case "undefined":
        return;
    }
  }

  private reportEnd(
    node: Readonly<Record<string, unknown>>,
    diagnostic: Omit<AuthoredSvelteDiagnostic, "end">,
  ): void {
    switch (typeof node.end) {
      case "number":
        this.diagnostics.push({ ...diagnostic, end: node.end });
        return;
      case "bigint":
      case "boolean":
      case "function":
      case "object":
      case "string":
      case "symbol":
      case "undefined":
        return;
    }
  }
}

export function checkAuthoredSvelte(
  request: AuthoredSvelteRequest,
): readonly AuthoredSvelteDiagnostic[] {
  return new AuthoredSvelteCheck(request).run();
}
