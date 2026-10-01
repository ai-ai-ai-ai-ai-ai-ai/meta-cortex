import tseslint from "typescript-eslint";

/** The declaration grammar supplements TypeScript's object and import checks. */
export class ReceiptGrammar {
  /** @returns {import("eslint").Linter.Config} */
  static configuration() {
    return {
      files: ["**/*.lace.ts", "**/AGENTS.ts"],
      linterOptions: { noInlineConfig: true },
      languageOptions: { parser: tseslint.parser },
      plugins: {
        "@typescript-eslint": tseslint.plugin,
        lace: { rules: { "declaration-fields": ReceiptFieldGrammar.rule() } },
      },
      rules: {
        "@typescript-eslint/ban-ts-comment": [
          "error",
          {
            "ts-ignore": true,
            "ts-nocheck": true,
            "ts-expect-error": true,
            "ts-check": false,
          },
        ],
        "lace/declaration-fields": "error",
        "no-dupe-keys": "error",
        "no-sparse-arrays": "error",
        "no-undef": "error",
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex:
                  "^(?!(?:@meta-cortex/lace|(?:\\.\\.?/)(?:[^\\n]*\\.lace\\.ts|(?:[^\\n]*/)?AGENTS\\.ts))$)",
                message: "Import only the Lace model or another receipt.",
              },
            ],
          },
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "*:not(Program, ImportDeclaration, ImportSpecifier, ImportDefaultSpecifier, Literal, Identifier, ExportDefaultDeclaration, VariableDeclaration, VariableDeclarator, ObjectExpression, Property, TemplateLiteral, TemplateElement, MemberExpression, ExportNamedDeclaration, TSTypeAnnotation, TSTypeReference)",
            message:
              "Receipts contain only imports, typed Job, Stage, or Statement declarations, literal context, and static references.",
          },
          {
            selector: "Program:not(:has(> ExportDefaultDeclaration))",
            message: "Every receipt must default-export receipt.",
          },
          {
            selector:
              "ExportDefaultDeclaration:not([declaration.type='Identifier'][declaration.name='receipt'])",
            message: "Default-export the typed receipt binding.",
          },
          {
            selector:
              "Program:not(:has(VariableDeclarator[id.name='receipt']))",
            message: "Declare const receipt: Job as the root object.",
          },
          {
            selector:
              "VariableDeclaration:not([kind='const']), VariableDeclaration:not(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration)",
            message: "Declare local context with top-level const bindings.",
          },
          {
            selector:
              "VariableDeclarator:not([id.type='Identifier'][id.typeAnnotation.typeAnnotation.type='TSTypeReference'][id.typeAnnotation.typeAnnotation.typeName.name=/^(Job|Stage|Statement)$/])",
            message: "Use explicit Job, Stage, or Statement type annotations.",
          },
          {
            selector:
              "TSTypeReference:not([typeName.type='Identifier'][typeName.name=/^(Job|Stage|Statement)$/]), TSTypeReference[typeArguments]",
            message: "Use Job, Stage, or Statement without type arguments.",
          },
          {
            selector: "Property[computed=true], Property[method=true]",
            message: "Give every context field an explicit literal name.",
          },
          {
            selector: "Literal[value=/^\\s*$/]",
            message: "Statement text, names, and commands are nonblank.",
          },
          {
            selector: "TemplateLiteral[expressions.length!=0]",
            message: "Write literal prose or commands without interpolation.",
          },
          {
            selector: "TemplateElement[value.raw=/^\\s*$/]",
            message: "Statement text, names, and commands are nonblank.",
          },
        ],
      },
    };
  }
}

/** @typedef {{readonly node: import("estree").Node; readonly position: string}} ValueRequest */

/** Fixed declaration positions distinguish schema fields from arbitrary map names. */
class ReceiptFieldGrammar {
  /** @returns {import("eslint").Rule.RuleModule} */
  static rule() {
    return {
      create(context) {
        return new ReceiptFieldGrammar(context).listeners();
      },
    };
  }
  /** @param {import("eslint").Rule.RuleContext} context */
  constructor(context) {
    this.context = context;
  }
  /** @returns {import("eslint").Rule.RuleListener} */
  listeners() {
    return {
      VariableDeclarator: (node) => this.declaration(node),
      ObjectExpression: (node) => this.object(node),
      Property: (node) => this.field(node),
      ExportNamedDeclaration: (node) => this.export(node),
    };
  }
  /** @param {import("estree").Node} node @returns {string} */
  name(node) {
    switch (true) {
      case node.type === "Identifier":
        return node.name;
      case node.type === "Literal":
        return String(node.value);
      case true:
        return "";
    }
    return "";
  }
  /** @param {import("eslint").Rule.Node} node @returns {string} */
  position(node) {
    switch (true) {
      case node.parent !== null && node.parent.type === "VariableDeclarator":
        return this.annotation(node.parent.id);
      case node.parent !== null && node.parent.type === "Property":
        return this.valuePosition(node.parent);
      case true:
        return "";
    }
    return "";
  }
  /** Read the parser's TypeScript annotation at the raw AST boundary.
   * @param {import("estree").Node} node @returns {string}
   */
  annotation(node) {
    switch (true) {
      case "typeAnnotation" in node &&
        typeof node.typeAnnotation === "object" &&
        node.typeAnnotation !== null &&
        "typeAnnotation" in node.typeAnnotation:
        return this.typeName(node.typeAnnotation.typeAnnotation);
      case true:
        return "";
    }
    return "";
  }
  /** @param {unknown} annotation @returns {string} */
  typeName(annotation) {
    switch (true) {
      case typeof annotation === "object" &&
        annotation !== null &&
        "typeName" in annotation &&
        typeof annotation.typeName === "object" &&
        annotation.typeName !== null &&
        "name" in annotation.typeName &&
        typeof annotation.typeName.name === "string":
        return annotation.typeName.name;
      case true:
        return "";
    }
    return "";
  }
  /** @param {import("eslint").Rule.Node & import("estree").Property} node @returns {string} */
  valuePosition(node) {
    const owner = this.position(node.parent);
    const name = this.name(node.key);
    switch (owner) {
      case "Job":
        switch (name) {
          case "stages":
            return "stage-map";
          default:
            return "";
        }
      case "Stage":
        switch (name) {
          case "spec":
            return "statement-map";
          case "Required":
            return "Required";
          case "Prohibited":
            return "Prohibited";
          default:
            return "";
        }
      case "Required":
      case "Prohibited":
        switch (name) {
          case "statements":
            return "statement-map";
          default:
            return "";
        }
      case "stage-map":
        return "Stage";
      case "statement-map":
        return "Statement";
      case "Statement":
        switch (name) {
          case "content":
            return "text";
          case "ShellCommand":
            return "ShellCommand";
          default:
            return "";
        }
      case "ShellCommand":
        switch (name) {
          case "cwd":
            return "cwd";
          case "script":
            return "text";
          default:
            return "";
        }
      default:
        return "";
    }
  }
  /** @param {import("estree").VariableDeclarator} node */
  declaration(node) {
    switch (
      node.id.type === "Identifier" &&
      node.id.name === "receipt" &&
      this.annotation(node.id) !== "Job"
    ) {
      case true: {
        const issue = { node, message: "The receipt root must be a Job." };
        this.context.report(issue);
        break;
      }
      case false:
        break;
    }
    switch (node.init) {
      case null:
      case undefined: {
        const issue = { node, message: "Initialize each context binding." };
        this.context.report(issue);
        break;
      }
      default: {
        const request = { node: node.init, position: this.annotation(node.id) };
        this.value(request);
      }
    }
  }
  /** @param {import("estree").ExportNamedDeclaration} node */
  export(node) {
    switch (true) {
      case node.declaration?.type === "VariableDeclaration":
        node.declaration.declarations.forEach((declaration) =>
          this.exportedBinding(declaration),
        );
        break;
      case true: {
        const issue = {
          node,
          message: "Export typed Stage or Statement declarations only.",
        };
        this.context.report(issue);
        break;
      }
    }
  }
  /** @param {import("estree").VariableDeclarator} node */
  exportedBinding(node) {
    switch (this.annotation(node.id)) {
      case "Stage":
      case "Statement":
        break;
      default: {
        const issue = {
          node,
          message: "Named exports are typed Stage or Statement bindings.",
        };
        this.context.report(issue);
      }
    }
  }
  /** @param {import("eslint").Rule.Node & import("estree").ObjectExpression} node */
  object(node) {
    const position = this.position(node);
    /** @type {string[]} */
    let fields = [];
    switch (position) {
      case "Job":
        fields = ["stages"];
        break;
      case "Stage":
        fields = ["spec", "Required", "Prohibited"];
        break;
      case "Required":
      case "Prohibited":
        fields = ["statements"];
        break;
      case "Statement":
        fields = ["content", "ShellCommand"];
        break;
      case "ShellCommand":
        fields = ["cwd", "script"];
        break;
      case "stage-map":
      case "statement-map":
        return;
      default: {
        const issue = {
          node,
          message: "Use an object only in its fixed declaration position.",
        };
        this.context.report(issue);
        return;
      }
    }
    const names = node.properties.map((property) =>
      this.propertyName(property),
    );
    switch (
      names.length === fields.length &&
      fields.every((field) => names.includes(field))
    ) {
      case true:
        break;
      case false: {
        const issue = {
          node,
          message: `Expected exactly ${fields.join(", ")} fields.`,
        };
        this.context.report(issue);
      }
    }
  }
  /** @param {import("estree").Node} node @returns {string} */
  propertyName(node) {
    switch (true) {
      case node.type === "Property":
        return this.name(node.key);
      case true:
        return "";
    }
    return "";
  }
  /** @param {import("eslint").Rule.Node & import("estree").Property} node */
  field(node) {
    switch (
      node.key.type === "Identifier" ||
      (node.key.type === "Literal" && typeof node.key.value === "string")
    ) {
      case true:
        break;
      case false: {
        const issue = {
          node,
          message: "Use explicit identifier or string literal names.",
        };
        this.context.report(issue);
      }
    }
    const request = { node: node.value, position: this.valuePosition(node) };
    this.value(request);
  }
  /** @param {ValueRequest} request */
  value(request) {
    const { node, position } = request;
    switch (position) {
      case "Stage":
        switch (node.type === "Identifier") {
          case true:
            return;
          case false:
            break;
        }
        break;
      case "Statement":
        switch (true) {
          case node.type === "Identifier":
            return;
          case node.type === "Literal":
          case node.type === "TemplateLiteral":
            this.text(node);
            return;
          case true:
            break;
        }
        break;
      case "text":
        this.text(node);
        return;
      case "cwd":
        switch (
          node.type === "MemberExpression" &&
          !node.computed &&
          node.object.type === "Identifier" &&
          node.object.name === "WorkingDirectory" &&
          node.property.type === "Identifier" &&
          ["ProjectRoot", "LibraryRoot"].includes(node.property.name)
        ) {
          case true:
            return;
          case false: {
            const issue = {
              node,
              message: "Use a WorkingDirectory enum literal for cwd.",
            };
            this.context.report(issue);
            return;
          }
        }
        break;
      default:
        break;
    }
    switch (node.type === "ObjectExpression" && position !== "") {
      case true:
        break;
      case false: {
        const issue = {
          node,
          message: "Use literal context in its fixed declaration position.",
        };
        this.context.report(issue);
      }
    }
  }
  /** @param {import("estree").Node} node */
  text(node) {
    switch (true) {
      case node.type === "Literal" &&
        typeof node.value === "string" &&
        node.value.trim().length > 0:
      case node.type === "TemplateLiteral" &&
        node.expressions.length === 0 &&
        node.quasis.length === 1 &&
        (node.quasis[0]?.value.cooked || "").trim().length > 0:
        break;
      case true: {
        const issue = {
          node,
          message: "Write nonblank literal statement content or script.",
        };
        this.context.report(issue);
      }
    }
  }
}
