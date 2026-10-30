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
  readonly ancestors: readonly Readonly<Record<string, unknown>>[];
}

interface IndexedNode {
  readonly node: Readonly<Record<string, unknown>>;
  readonly parent: Readonly<Record<string, unknown>>;
  readonly field: string;
  readonly ancestors: readonly Readonly<Record<string, unknown>>[];
}

/** Checks authored nodes, never the helper scopes in a generated TSX projection. */
export class AuthoredSvelteCheck {
  private readonly diagnostics: AuthoredSvelteDiagnostic[] = [];
  private readonly nodes: IndexedNode[] = [];

  constructor(private readonly request: AuthoredSvelteRequest) {}

  run(): readonly AuthoredSvelteDiagnostic[] {
    this.diagnostics.length = 0;
    this.nodes.length = 0;
    // The compiler owns parsing and its failures propagate to the caller.
    const root = parse(this.request.source, {
      modern: true,
      filename: this.request.filepath,
    });
    this.visit(root, {
      parent: {},
      field: "",
      blocks: 0,
      callbacks: 0,
      ancestors: [],
    });
    return this.diagnostics.sort(
      (left, right) =>
        left.start - right.start || left.rule.localeCompare(right.rule),
    );
  }

  ownsExpressionStatement(start: number, end: number): boolean {
    this.run();
    return this.nodes.some(
      (entry) =>
        entry.node.type === "ExpressionStatement" &&
        this.contains(entry.node, start, end),
    );
  }

  isIntrinsicPropsAssignment(start: number, end: number): boolean {
    this.run();
    return this.nodes.some((entry) =>
      this.intrinsicPropsDeclarator(entry, start, end),
    );
  }

  private contains(
    node: Readonly<Record<string, unknown>>,
    start: number,
    end: number,
  ): boolean {
    return (
      typeof node.start === "number" &&
      typeof node.end === "number" &&
      start >= node.start &&
      end <= node.end &&
      start < end
    );
  }

  private intrinsicPropsDeclarator(
    entry: IndexedNode,
    start: number,
    end: number,
  ): boolean {
    return (
      entry.node.type === "VariableDeclarator" &&
      entry.node.start === start &&
      entry.node.end === end &&
      this.instanceRoot(entry) &&
      this.propsPattern(entry) &&
      this.propsInitializer(entry) &&
      !this.nodes.some((binding) => this.shadowsProps(binding))
    );
  }

  private instanceRoot(entry: IndexedNode): boolean {
    return (
      entry.ancestors.some(
        (node) => node.type === "Script" && node.context === "default",
      ) && !entry.ancestors.some((node) => this.scopeBoundary(node))
    );
  }

  private scopeBoundary(node: Readonly<Record<string, unknown>>): boolean {
    switch (node.type) {
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
      case "ClassDeclaration":
      case "ClassExpression":
      case "StaticBlock":
      case "BlockStatement":
      case "SwitchStatement":
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
        return true;
      default:
        return false;
    }
  }

  private propsPattern(entry: IndexedNode): boolean {
    return this.nodes.some(
      (pattern) =>
        pattern.parent === entry.node &&
        pattern.field === "id" &&
        this.propsBinding(pattern),
    );
  }

  private propsBinding(pattern: IndexedNode): boolean {
    switch (pattern.node.type) {
      case "Identifier":
      case "ObjectPattern":
      case "ArrayPattern":
        return true;
      default:
        return false;
    }
  }

  private propsInitializer(entry: IndexedNode): boolean {
    return this.nodes.some(
      (call) =>
        call.parent === entry.node &&
        call.field === "init" &&
        this.intrinsicPropsCall(call),
    );
  }

  private intrinsicPropsCall(call: IndexedNode): boolean {
    return (
      call.node.type === "CallExpression" &&
      call.node.optional !== true &&
      Array.isArray(call.node.arguments) &&
      call.node.arguments.length === 0 &&
      this.nodes.some(
        (callee) =>
          callee.parent === call.node &&
          callee.field === "callee" &&
          callee.node.type === "Identifier" &&
          callee.node.name === "$props",
      )
    );
  }

  private shadowsProps(entry: IndexedNode): boolean {
    switch (entry.node.type) {
      case "VariableDeclarator":
        return (
          this.rootBinding(entry) &&
          this.nodes.some(
            (pattern) =>
              pattern.parent === entry.node &&
              pattern.field === "id" &&
              this.patternBindsProps(pattern),
          )
        );
      case "FunctionDeclaration":
      case "ClassDeclaration":
      case "TSModuleDeclaration":
      case "TSEnumDeclaration":
      case "TSDeclareFunction":
      case "TSImportEqualsDeclaration":
        return (
          this.rootBinding(entry) &&
          this.nodes.some(
            (name) =>
              name.parent === entry.node &&
              name.field === "id" &&
              name.node.name === "$props",
          )
        );
      case "ImportSpecifier":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
        return this.nodes.some(
          (local) =>
            local.parent === entry.node &&
            local.field === "local" &&
            local.node.name === "$props",
        );
      default:
        return false;
    }
  }

  private rootBinding(entry: IndexedNode): boolean {
    switch (entry.parent.kind) {
      case "var":
        return !entry.ancestors.some((node) => this.functionBoundary(node));
      default:
        return !entry.ancestors.some((node) => this.scopeBoundary(node));
    }
  }

  private functionBoundary(node: Readonly<Record<string, unknown>>): boolean {
    switch (node.type) {
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
      case "ClassDeclaration":
      case "ClassExpression":
      case "StaticBlock":
        return true;
      default:
        return false;
    }
  }

  private patternBindsProps(entry: IndexedNode): boolean {
    switch (entry.node.type) {
      case "Identifier":
        return entry.node.name === "$props";
      case "ObjectPattern":
      case "ArrayPattern":
        return this.nodes.some(
          (child) =>
            child.parent === entry.node &&
            child.field !== "typeAnnotation" &&
            this.patternBindsProps(child),
        );
      case "Property":
        return this.nodes.some(
          (value) =>
            value.parent === entry.node &&
            value.field === "value" &&
            this.patternBindsProps(value),
        );
      case "AssignmentPattern":
        return this.nodes.some(
          (left) =>
            left.parent === entry.node &&
            left.field === "left" &&
            this.patternBindsProps(left),
        );
      case "RestElement":
        return this.nodes.some(
          (argument) =>
            argument.parent === entry.node &&
            argument.field === "argument" &&
            this.patternBindsProps(argument),
        );
      default:
        return false;
    }
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
          this.visit(child, {
            ...next,
            field: key,
            ancestors: [...context.ancestors, fields],
          });
      }
    }
  }

  private context(
    node: Readonly<Record<string, unknown>>,
    context: WalkContext,
  ): WalkContext {
    this.nodes.push({
      node,
      parent: context.parent,
      field: context.field,
      ancestors: context.ancestors,
    });
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
