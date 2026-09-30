/** @typedef {import("eslint").Scope.Reference["identifier"]} ReceiptReference */

/** Receipt expressions may reference only bindings supplied by their imports. */
export class ReceiptBindings {
  /** @type {Set<string>} */
  names = new Set();

  /** @param {import("eslint").Rule.RuleContext} context */
  constructor(context) {
    this.context = context;
  }

  /** @returns {import("eslint").Rule.RuleModule} */
  static rule() {
    return {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          unimported: "Receipt values must come from literals or Lace imports.",
        },
      },
      create: (context) => new ReceiptBindings(context).listeners(),
    };
  }

  /** @returns {import("eslint").Rule.RuleListener} */
  listeners() {
    return {
      ImportDeclaration: (node) => this.record(node),
      Identifier: (node) => this.inspect(node),
    };
  }

  /** @param {import("estree").ImportDeclaration} node */
  record(node) {
    for (const binding of node.specifiers) this.names.add(binding.local.name);
  }

  /** @param {import("estree").Identifier} node */
  inspect(node) {
    switch (node.name) {
      // The parser records 'as const' as a type reference, not a value import.
      case "const":
        return;
      default: {
        const references = this.context.sourceCode
          .getScope(node)
          .references.filter((reference) => reference.identifier === node);
        for (const reference of references) this.check(reference.identifier);
      }
    }
  }

  /** @param {ReceiptReference} node */
  check(node) {
    // Set membership is decoded at the ESLint reporting boundary.
    switch (this.names.has(node.name)) {
      case true:
        return;
      case false: {
        /** @type {import("eslint").Rule.ReportDescriptor} */
        const report = { node, messageId: "unimported" };
        this.context.report(report);
      }
    }
  }
}
