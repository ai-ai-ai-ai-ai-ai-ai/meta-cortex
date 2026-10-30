import { Match, Predicate } from "effect";
import { parse } from "svelte/compiler";

interface GeneratedRegion {
  readonly start: number;
  readonly end: number;
  readonly exact: boolean;
  readonly rule:
    | "require-await"
    | "no-unused-expressions"
    | "no-unsafe-assignment"
    | "no-unsafe-return"
    | "no-empty"
    | "no-explicit-any";
}

/** Structural ownership of helper nodes emitted by the native Svelte transform. */
export class GeneratedSyntax {
  private readonly regions: GeneratedRegion[] = [];
  private readonly eachLoops: Readonly<Record<string, unknown>>[] = [];
  private readonly code: string;
  private readonly expressions: Readonly<Record<string, unknown>>[] = [];
  private readonly prefix = '<script context="module" lang="ts">';

  constructor(code: string) {
    this.code = code;
    const ast = parse(`${this.prefix}${code}</script>`, { modern: true });
    this.visit(ast, false);
  }

  private node(value: unknown): Readonly<Record<string, unknown>> {
    return Match.value(value).pipe(
      Match.when(Predicate.isObject, (record) => record),
      Match.orElse((): Readonly<Record<string, unknown>> => ({})),
    );
  }

  private position(value: unknown): number {
    return Match.value(value).pipe(
      Match.when(
        Predicate.isNumber,
        (position) => position - this.prefix.length,
      ),
      Match.orElse(() => -1),
    );
  }

  private add(
    node: Readonly<Record<string, unknown>>,
    rule: GeneratedRegion["rule"],
  ): void {
    this.regions.push({
      start: this.position(node.start),
      end: this.position(node.end),
      rule,
      exact: true,
    });
  }

  private visit(value: unknown, renderBody: boolean): void {
    Match.value(value).pipe(
      Match.when(Array.isArray, (children: readonly unknown[]) => {
        for (const [index, child] of children.entries()) {
          this.componentReference(children.slice(0, index), child);
          this.visit(child, renderBody);
        }
      }),
      Match.orElse((child) => this.visitNode(child, renderBody)),
    );
  }

  private visitNode(value: unknown, renderBody: boolean): void {
    const node = this.node(value);
    const id = this.node(node.id);
    switch (node.type === "FunctionDeclaration" && id.name === "$$render") {
      case true: {
        const body = this.node(node.body);
        this.visit(body.body, true);
        return;
      }
      case false:
        break;
    }
    switch (renderBody) {
      case true:
        this.renderStatement(node);
        break;
      case false:
        break;
    }
    this.helperNode(node);
    for (const [key, child] of Object.entries(node)) {
      switch (key) {
        case "loc":
          break;
        default:
          this.visit(child, false);
      }
    }
  }

  private componentReference(
    previous: readonly unknown[],
    current: unknown,
  ): void {
    const statement = this.node(current);
    const expression = this.node(statement.expression);
    const bindings = previous.flatMap((value) => {
      const declarations = this.node(value).declarations;
      return Match.value(declarations).pipe(
        Match.when(Array.isArray, (nodes: readonly unknown[]) => nodes),
        Match.orElse(() => []),
      );
    });
    const binding = bindings
      .map((value) => this.node(value))
      .find((node) => this.componentBinding(node, expression.name));
    const bindingName = this.node(binding?.id).name;
    const constructed = previous.some(
      (value) =>
        this.node(this.node(this.node(value).expression).callee).name ===
          bindingName &&
        this.node(this.node(value).expression).type === "NewExpression",
    );
    switch (
      statement.type === "ExpressionStatement" &&
      expression.type === "Identifier" &&
      binding !== undefined &&
      constructed
    ) {
      case true:
        this.add(statement, "no-unused-expressions");
        break;
      case false:
        break;
    }
  }

  private componentBinding(
    declarator: Readonly<Record<string, unknown>>,
    name: unknown,
  ): boolean {
    const init = this.node(declarator.init);
    const args = Match.value(init.arguments).pipe(
      Match.when(Array.isArray, (nodes: readonly unknown[]) => nodes),
      Match.orElse(() => []),
    );
    return (
      this.node(init.callee).name === "__sveltets_2_ensureComponent" &&
      this.node(args[0]).name === name
    );
  }

  private helperNode(node: Readonly<Record<string, unknown>>): void {
    const id = this.node(node.id);
    const argument = this.node(node.argument);
    const callee = this.node(argument.callee);
    switch (node.type) {
      case "ExpressionStatement":
        this.expressions.push(this.node(node.expression));
        break;
      case "ForOfStatement":
        switch (this.node(this.node(node.right).callee).name) {
          case "__sveltets_2_ensureArray":
            this.eachLoops.push(node);
            break;
        }
        break;
      case "VariableDeclarator":
        switch (
          typeof id.name === "string" &&
          id.name.startsWith("$$_") &&
          this.node(this.node(node.init).callee).name ===
            "__sveltets_2_ensureComponent"
        ) {
          case true:
            this.add(node, "no-unsafe-assignment");
            break;
          case false:
            break;
        }
        break;
      case "ReturnStatement":
        switch (
          typeof callee.name === "string" &&
          callee.name.startsWith("__sveltets_")
        ) {
          case true:
            this.add(node, "no-unsafe-return");
            break;
          case false:
            break;
        }
        break;
      case "Property": {
        const value = this.node(node.value);
        const helper = this.node(value.callee);
        switch (
          value.type === "CallExpression" &&
          typeof helper.name === "string" &&
          helper.name.startsWith("__sveltets_")
        ) {
          case true:
            this.add(node, "no-unsafe-assignment");
            break;
          case false:
            break;
        }
        break;
      }
      case "BlockStatement":
        switch (Array.isArray(node.body) && node.body.length === 0) {
          case true:
            this.add(node, "no-empty");
            break;
          case false:
            break;
        }
        break;
    }
  }

  private renderStatement(node: Readonly<Record<string, unknown>>): void {
    switch (node.type) {
      case "ExpressionStatement": {
        const expression = this.node(node.expression);
        const body = this.node(expression.body);
        switch (
          expression.type === "ArrowFunctionExpression" &&
          expression.async === true
        ) {
          case true:
            this.add(node, "no-unused-expressions");
            this.regions.push({
              start: this.position(expression.start),
              end: this.position(body.start),
              rule: "require-await",
              exact: false,
            });
            break;
          case false:
            break;
        }
        break;
      }
      case "ReturnStatement":
        this.generatedReturn(node.argument);
        break;
    }
  }

  private generatedReturn(value: unknown): void {
    const node = this.node(value);
    switch (node.type) {
      case "TSAnyKeyword":
        this.add(node, "no-explicit-any");
        break;
    }
    Match.value(value).pipe(
      Match.when(Array.isArray, (children: readonly unknown[]) => {
        for (const child of children) this.generatedReturn(child);
      }),
      Match.orElse(() => {
        for (const child of Object.values(node)) this.generatedReturn(child);
      }),
    );
  }

  private findNodes(
    value: unknown,
    type: string,
  ): Readonly<Record<string, unknown>>[] {
    return Match.value(value).pipe(
      Match.when(Array.isArray, (children: readonly unknown[]) =>
        children.flatMap((child) => this.findNodes(child, type)),
      ),
      Match.orElse(() => {
        const node = this.node(value);
        const descendants = Object.values(node).flatMap((child) =>
          this.findNodes(child, type),
        );
        switch (node.type === type) {
          case true:
            return [node, ...descendants];
          case false:
            return descendants;
        }
      }),
    );
  }

  templateKeys(
    source: string,
  ): readonly { original: number; generated: number; length: number }[] {
    const original = this.findNodes(
      parse(source, { modern: true }),
      "EachBlock",
    ).sort((a, b) => this.position(a.start) - this.position(b.start));
    const generated = [...this.eachLoops].sort(
      (a, b) => this.position(a.start) - this.position(b.start),
    );
    return original.flatMap((each, index) =>
      this.templateKey(source, each, generated[index]),
    );
  }

  private templateKey(
    source: string,
    each: Readonly<Record<string, unknown>>,
    generated: Readonly<Record<string, unknown>> | undefined,
  ): readonly { original: number; generated: number; length: number }[] {
    const key = this.node(each.key);
    switch (typeof key.start) {
      case "number":
        break;
      case "bigint":
      case "boolean":
      case "function":
      case "object":
      case "string":
      case "symbol":
      case "undefined":
        return [];
    }
    const start = this.position(key.start) + this.prefix.length;
    const end = this.position(key.end) + this.prefix.length;
    const body = this.node(generated?.body).body;
    const statement = Match.value(body).pipe(
      Match.when(Array.isArray, (children: readonly unknown[]) =>
        this.node(
          children.find(
            (child) => this.node(child).type === "ExpressionStatement",
          ),
        ),
      ),
      Match.orElse((): Readonly<Record<string, unknown>> => ({})),
    );
    const expression = this.node(statement.expression);
    const generatedStart = this.position(expression.start);
    const generatedEnd = this.position(expression.end);
    switch (
      source.slice(start, end) === this.code.slice(generatedStart, generatedEnd)
    ) {
      case true:
        return [
          { original: start, generated: generatedStart, length: end - start },
        ];
      case false:
        throw new Error(
          "Native each-key projection does not match the authored AST; refusing an ambiguous source mapping.",
        );
    }
  }

  templateClasses(
    source: string,
    hasOriginal: (position: number) => boolean,
    hasGenerated: (start: number, end: number) => boolean,
  ): readonly { original: number; generated: number; length: number }[] {
    const directives = this.findNodes(
      parse(source, { modern: true }),
      "ClassDirective",
    ).map((directive) => this.node(directive.expression));
    const originals = directives.filter(
      (expression) =>
        !hasOriginal(this.position(expression.start) + this.prefix.length),
    );
    const generated = this.expressions.filter(
      (expression) =>
        !hasGenerated(
          this.position(expression.start),
          this.position(expression.end),
        ),
    );
    return originals.map((expression) =>
      this.classExpression(source, expression, originals, generated),
    );
  }

  private classExpression(
    source: string,
    expression: Readonly<Record<string, unknown>>,
    originals: readonly Readonly<Record<string, unknown>>[],
    generated: readonly Readonly<Record<string, unknown>>[],
  ): { original: number; generated: number; length: number } {
    const start = this.position(expression.start) + this.prefix.length;
    const end = this.position(expression.end) + this.prefix.length;
    const text = source.slice(start, end);
    const matchingOriginals = originals
      .filter(
        (node) =>
          source.slice(
            this.position(node.start) + this.prefix.length,
            this.position(node.end) + this.prefix.length,
          ) === text,
      )
      .sort((a, b) => this.position(a.start) - this.position(b.start));
    const matchingGenerated = generated
      .filter(
        (node) =>
          this.code.slice(
            this.position(node.start),
            this.position(node.end),
          ) === text,
      )
      .sort((a, b) => this.position(a.start) - this.position(b.start));
    const candidate = matchingGenerated[matchingOriginals.indexOf(expression)];
    switch (
      matchingOriginals.length === matchingGenerated.length &&
      candidate !== undefined
    ) {
      case true:
        return {
          original: start,
          generated: this.position(candidate?.start),
          length: end - start,
        };
      case false:
        throw new Error(
          "Native class-directive projections are not uniquely paired with the authored AST.",
        );
    }
  }

  owns(start: number, end: number, rule: string): boolean {
    return this.regions.some(
      (region) =>
        region.start <= start &&
        region.end >= end &&
        (!region.exact || (region.start === start && region.end - end <= 1)) &&
        rule.endsWith(`(${region.rule})`),
    );
  }
}
