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
                  "^(?!(?:(?:\\.\\.?/)+(?:lace/)?src/ts/lace\\.ts|(?:\\.\\.?/)(?:[^\\n]*\\.lace\\.ts|(?:[^\\n]*/)?AGENTS\\.ts))$)",
                message: "Import only the Lace model or another receipt.",
              },
            ],
          },
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "*:not(Program, ImportDeclaration, ImportSpecifier, ImportDefaultSpecifier, Literal, Identifier, ExportDefaultDeclaration, VariableDeclaration, VariableDeclarator, ObjectExpression, ArrayExpression, Property, TemplateLiteral, TemplateElement, MemberExpression, TSTypeAnnotation, TSTypeReference)",
            message:
              "Receipts contain only imports, typed Job objects, literal context, and static job references.",
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
              "VariableDeclaration:not([kind='const']), VariableDeclaration:not(Program > VariableDeclaration)",
            message: "Declare local Jobs with top-level const bindings.",
          },
          {
            selector:
              "VariableDeclarator:not([id.type='Identifier'][id.typeAnnotation.typeAnnotation.type='TSTypeReference'][id.typeAnnotation.typeAnnotation.typeName.name='Job'][init.type='ObjectExpression'])",
            message:
              "Declare each local Job as const name: Job = { stages: { name: stage } }.",
          },
          {
            selector:
              "TSTypeReference:not([typeName.type='Identifier'][typeName.name='Job']), TSTypeReference[typeArguments]",
            message: "Use the Job type annotation without type arguments.",
          },
          {
            selector:
              "Property[computed=true], Property[shorthand=true], Property[method=true]",
            message: "Give every context field an explicit literal name.",
          },
          {
            selector:
              "MemberExpression:not(Property > MemberExpression), MemberExpression[computed=true]",
            message: "Member access is limited to enum fields.",
          },
          {
            selector:
              "Property[value.type='MemberExpression']:not([key.name='kind'][value.object.name=/^(TaskKind|PromptKind)$/], [key.value='kind'][value.object.name=/^(TaskKind|PromptKind)$/], [key.name='cwd'][value.object.name='WorkingDirectory'], [key.value='cwd'][value.object.name='WorkingDirectory'])",
            message:
              "Use TaskKind or PromptKind for kind and WorkingDirectory for cwd.",
          },
          {
            selector:
              "MemberExpression[object.name='PromptKind']:not([property.name=/^(Statement|BulletList)$/])",
            message:
              "Use PromptKind.Statement or PromptKind.BulletList for prompts.",
          },
          {
            selector: "Literal[value=/^\\s*$/]",
            message:
              "Prompt content, labels, list items, and commands are nonblank.",
          },
          {
            selector: "TemplateLiteral[expressions.length!=0]",
            message: "Write literal prose or commands without interpolation.",
          },
          {
            selector: "TemplateElement[value.raw=/^\\s*$/]",
            message:
              "Prompt content, labels, list items, and commands are nonblank.",
          },
          {
            selector:
              "ImportDeclaration[source.value=/(\\.lace\\.ts|\\/AGENTS\\.ts)$/] > ImportSpecifier",
            message: "Import a receipt's default Job as a static reference.",
          },
        ],
      },
    };
  }
}

/** @typedef {{readonly node: import("eslint").Rule.Node; readonly message: string}} FieldIssue */

/** Position checks keep stage names separate from schema field selectors. */
class ReceiptFieldGrammar {
  /** @returns {import("eslint").Rule.RuleModule} */
  static rule() {
    return {
      create(context) {
        const grammar = new ReceiptFieldGrammar(context);
        return grammar.listeners();
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
      ":matches(Property[key.name=/^(content|label|script)$/], Property[key.value=/^(content|label|script)$/]):not([value.type='Literal'], [value.type='TemplateLiteral'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Write prompt content, labels, and commands as literals.",
          };
          this.schema(issue);
        },
      ":matches(Property[key.name='stages'], Property[key.value='stages']):not([value.type='ObjectExpression'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Declare Job stages as a literal named object.",
          };
          this.schema(issue);
        },
      ":matches(Property[key.name='stages'], Property[key.value='stages']) > ObjectExpression[properties.length=0]":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Jobs contain at least one named stage.",
          };
          this.schema(issue);
        },
      ":matches(Property[key.name='items'], Property[key.value='items']):not([value.type='ArrayExpression'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Declare list items as literal arrays.",
          };
          this.schema(issue);
        },
      ArrayExpression: (node) => this.array(node),
      "ArrayExpression[elements.length=0]":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Prompt lists contain at least one entry or item.",
          };
          this.schema(issue);
        },
      ":matches(Property[key.name='stages'], Property[key.value='stages']) > ObjectExpression > Property:not([value.type='ObjectExpression'], [value.type='Identifier'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Job stages are literal objects or static Job references.",
          };
          this.stage(issue);
        },
      ":matches(Property[key.name='stages'], Property[key.value='stages']) > ObjectExpression > Property:not([key.type='Identifier'], [key.type='Literal'][key.raw=/^[\"']/])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Name Job stages with identifiers or string literals.",
          };
          this.stage(issue);
        },
      ":matches(Property[key.name='items'], Property[key.value='items']) > ArrayExpression > :not(ObjectExpression)":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message:
              "List items are literal prompt statement or bullet list objects.",
          };
          this.schema(issue);
        },
      ":matches(Property[key.name='entries'], Property[key.value='entries'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Declare Job stages; the entries field is not supported.",
          };
          this.schema(issue);
        },
      "Property[value.type='Identifier']":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message:
              "Nest literal context objects; Job references belong as named stage values.",
          };
          this.schema(issue);
        },
    };
  }

  /** @param {import("eslint").Rule.Node} node */
  array(node) {
    const field = this.property(node);
    switch (this.name(field)) {
      case "items":
        switch (this.isStageProperty(field)) {
          case false:
            return;
          case true:
            break;
        }
    }
    const issue = { node, message: "Arrays belong only to prompt list items." };
    this.context.report(issue);
  }

  /** @param {FieldIssue} issue */
  schema(issue) {
    switch (this.isStageProperty(this.property(issue.node))) {
      case false:
        this.context.report(issue);
        break;
      case true:
        break;
    }
  }

  /** @param {FieldIssue} issue */
  stage(issue) {
    switch (this.isStageProperty(this.property(issue.node))) {
      case true:
        this.context.report(issue);
        break;
      case false:
        break;
    }
  }

  /** @param {import("eslint").Rule.Node} node */
  property(node) {
    let current = node;
    while (current.type !== "Property" && current.type !== "Program") {
      current = current.parent;
    }
    return current;
  }

  // Boolean predicates adapt ESLint's raw AST position at the lint boundary.
  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isJobObject(node) {
    return (
      node.type !== "Program" &&
      (node.parent.type === "VariableDeclarator" ||
        (node.parent.type === "Property" && this.isStageProperty(node.parent)))
    );
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isStageProperty(node) {
    return node.type === "Property" && this.isStageMap(node.parent);
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isStageMap(node) {
    return (
      node.type === "ObjectExpression" &&
      node.parent.type === "Property" &&
      this.name(node.parent) === "stages" &&
      this.isJobObject(node.parent.parent)
    );
  }

  /** @param {import("eslint").Rule.Node} node */
  name(node) {
    switch (true) {
      case node.type === "Property":
        return this.key(node.key);
      case true:
        break;
    }
    return "";
  }

  /** @param {import("estree").Node} node */
  key(node) {
    switch (true) {
      case node.type === "Identifier":
        return node.name;
      case node.type === "Literal":
        return String(node.value);
      case true:
        break;
    }
    return "";
  }
}
