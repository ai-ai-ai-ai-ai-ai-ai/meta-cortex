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
              "*:not(Program, ImportDeclaration, ImportSpecifier, ImportDefaultSpecifier, Literal, Identifier, ExportDefaultDeclaration, VariableDeclaration, VariableDeclarator, ObjectExpression, Property, TemplateLiteral, TemplateElement, MemberExpression, CallExpression, TSTypeAnnotation, TSTypeReference)",
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
              "MemberExpression:not(Property > MemberExpression, CallExpression > MemberExpression), MemberExpression[computed=true]",
            message: "Member access is limited to enum fields.",
          },
          {
            selector:
              "Property[value.type='MemberExpression']:not([key.name='cwd'][value.object.name='WorkingDirectory'], [key.value='cwd'][value.object.name='WorkingDirectory'])",
            message: "Use WorkingDirectory only for cwd fields.",
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
      ":matches(Property[key.name='items'], Property[key.value='items']):not([value.type='ObjectExpression'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Declare list items as literal named objects.",
          };
          this.schema(issue);
        },
      "ObjectExpression[properties.length=0]":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          switch (this.isItemMap(node)) {
            case true: {
              const issue = {
                node,
                message: "Bullet lists contain at least one named item.",
              };
              this.context.report(issue);
              break;
            }
            case false:
              break;
          }
        },
      ObjectExpression: (node) => this.mapped(node),
      ":matches(Property[key.name=/^(Statement|ShellCommand|PromptStatement|BulletList|Required|Prohibited)$/], Property[key.value=/^(Statement|ShellCommand|PromptStatement|BulletList|Required|Prohibited)$/])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => this.wrapper(node),
      ":matches(Property[key.name='kind'], Property[key.value='kind'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Use mapped variants; kind fields are not supported.",
          };
          this.schema(issue);
        },
      ":matches(Property[key.name='cwd'], Property[key.value='cwd']):not([value.type='MemberExpression'][value.object.name='WorkingDirectory'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          /** @type {FieldIssue} */
          const issue = {
            node,
            message: "Use WorkingDirectory for shell cwd.",
          };
          this.schema(issue);
        },
      CallExpression: (node) => this.call(node),
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
      ":matches(Property[key.name='prompt'], Property[key.value='prompt']):not([value.type='ObjectExpression'], [value.type='CallExpression'])":
        /** @param {import("eslint").Rule.Node} node */
        (node) => {
          switch (
            node.type === "Property" &&
            node.parent.type === "ObjectExpression" &&
            this.isPayload(node.parent) &&
            this.name(node.parent.parent) === "Statement"
          ) {
            case true: {
              const issue = {
                node,
                message:
                  "Standalone prompts are mapped objects or the literal content helper.",
              };
              this.context.report(issue);
              break;
            }
            case false:
              break;
          }
        },
      Property: (node) => {
        this.item(node);
        this.normative(node);
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
  mapped(node) {
    switch (
      node.type === "ObjectExpression" &&
      node.parent.type === "Property" &&
      this.isStageProperty(node.parent)
    ) {
      case true:
        this.single(node);
        return;
      case false:
        break;
    }
    switch (this.isPromptPosition(node)) {
      case true:
        this.single(node);
        break;
      case false:
        break;
    }
  }

  /** @param {import("eslint").Rule.Node} node */
  single(node) {
    switch (
      node.type === "ObjectExpression" &&
      node.properties.length === 1 &&
      0 in node.properties &&
      node.properties[0].type === "Property" &&
      this.isPromptPosition(node) ===
        /^(PromptStatement|BulletList|Required|Prohibited)$/.test(
          this.name(node.properties[0]),
        ) &&
      (!this.isItemProperty(node.parent) ||
        /^(BulletList|Required|Prohibited)$/.test(
          this.name(node.properties[0]),
        )) &&
      /^(stages|Statement|ShellCommand|PromptStatement|BulletList|Required|Prohibited)$/.test(
        this.name(node.properties[0]),
      )
    ) {
      case true:
        return;
      case false:
        break;
    }
    /** @type {FieldIssue} */
    const issue = {
      node,
      message: "Declare exactly one mapped variant or nested Job.",
    };
    this.context.report(issue);
  }

  /** @param {import("eslint").Rule.Node} node */
  wrapper(node) {
    switch (this.isStageProperty(node) || this.isItemProperty(node)) {
      case true:
        return;
      case false:
        break;
    }
    switch (
      node.type === "Property" &&
      node.value.type === "ObjectExpression" &&
      node.parent.type === "ObjectExpression" &&
      node.parent.properties.length === 1 &&
      this.wrapperPosition(node)
    ) {
      case true:
        return;
      case false:
        break;
    }
    /** @type {FieldIssue} */
    const issue = {
      node,
      message:
        "Mapped variants have one literal payload in their task or prompt position.",
    };
    this.context.report(issue);
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  wrapperPosition(node) {
    switch (this.name(node)) {
      case "Statement":
      case "ShellCommand":
        return (
          node.type === "Property" &&
          node.parent.type === "ObjectExpression" &&
          this.isStageProperty(node.parent.parent)
        );
      case "PromptStatement":
        return node.type === "Property" && this.isStandalonePrompt(node.parent);
      case "BulletList":
      case "Required":
      case "Prohibited":
        return node.type === "Property" && this.isPromptPosition(node.parent);
    }
    return false;
  }

  /** @param {import("eslint").Rule.Node} node */
  call(node) {
    switch (this.isContentCall(node) && this.isStandalonePrompt(node)) {
      case true:
        return;
      case false:
        /** @type {FieldIssue} */
        const issue = {
          node,
          message:
            "Receipts contain only imports, typed Job objects, literal context, static job references, and PromptStatement.content with one nonblank literal in a prompt position.",
        };
        this.context.report(issue);
        break;
    }
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isContentCall(node) {
    return (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      !node.optional &&
      !node.callee.optional &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "PromptStatement" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "content" &&
      node.arguments.length === 1 &&
      0 in node.arguments &&
      this.isTextLiteral(node.arguments[0])
    );
  }

  /** @param {import("estree").Node} node @returns {boolean} */
  isTextLiteral(node) {
    switch (true) {
      case node.type === "Literal":
        return typeof node.value === "string" && node.value.trim().length > 0;
      case node.type === "TemplateLiteral":
        return (
          node.expressions.length === 0 &&
          0 in node.quasis &&
          typeof node.quasis[0].value.cooked === "string" &&
          node.quasis[0].value.cooked.trim().length > 0
        );
      case true:
        break;
    }
    return false;
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isPromptPosition(node) {
    switch (true) {
      case node.type === "Program":
        return false;
      case true:
        break;
    }
    return this.isStandalonePrompt(node) || this.isItemProperty(node.parent);
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isStandalonePrompt(node) {
    return (
      node.type !== "Program" &&
      node.parent.type === "Property" &&
      node.parent.value === node &&
      this.name(node.parent) === "prompt" &&
      node.parent.parent.type === "ObjectExpression" &&
      this.isPayload(node.parent.parent) &&
      this.name(node.parent.parent.parent) === "Statement"
    );
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isPayload(node) {
    return (
      node.type === "ObjectExpression" &&
      node.parent.type === "Property" &&
      /^(Statement|BulletList|Required|Prohibited)$/.test(
        this.name(node.parent),
      ) &&
      this.wrapperPosition(node.parent)
    );
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isItemMap(node) {
    return (
      node.type === "ObjectExpression" &&
      node.parent.type === "Property" &&
      this.name(node.parent) === "items" &&
      node.parent.parent.type === "ObjectExpression" &&
      this.isPayload(node.parent.parent) &&
      /^(BulletList|Required|Prohibited)$/.test(
        this.name(node.parent.parent.parent),
      )
    );
  }

  /** @param {import("eslint").Rule.Node} node @returns {boolean} */
  isItemProperty(node) {
    return node.type === "Property" && this.isItemMap(node.parent);
  }

  /** @param {import("eslint").Rule.Node} node */
  item(node) {
    switch (this.isItemProperty(node)) {
      case false:
        return;
      case true:
        break;
    }
    switch (
      node.type === "Property" &&
      !node.computed &&
      !node.method &&
      !node.shorthand &&
      (node.key.type === "Identifier" ||
        (node.key.type === "Literal" &&
          typeof node.key.value === "string" &&
          node.key.value.trim().length > 0)) &&
      (this.isTextLiteral(node.value) || node.value.type === "ObjectExpression")
    ) {
      case true:
        return;
      case false:
        break;
    }
    const issue = {
      node,
      message:
        "Named bullet items require explicit names and literal text or mapped BulletList groups.",
    };
    this.context.report(issue);
  }

  /** @param {import("eslint").Rule.Node} node */
  normative(node) {
    switch (true) {
      case node.type === "Property" && this.isPayload(node.parent):
        break;
      case true:
        return;
    }
    switch (true) {
      case node.type === "Property" &&
        node.parent.type === "ObjectExpression" &&
        /^(Required|Prohibited)$/.test(this.name(node.parent.parent)) &&
        this.name(node) !== "items": {
        /** @type {FieldIssue} */
        const issue = {
          node,
          message: "Typed normative payloads contain only items.",
        };
        this.context.report(issue);
        return;
      }
      case node.type === "Property" &&
        node.parent.type === "ObjectExpression" &&
        this.name(node.parent.parent) === "BulletList" &&
        this.name(node) === "label":
        break;
      case true:
        return;
    }
    switch (true) {
      case node.type === "Property" &&
        node.value.type === "Literal" &&
        [
          "Preferred",
          "Preferred actions",
          "Required",
          "Required actions",
          "Prohibited",
          "Prohibited actions",
        ].includes(String(node.value.value)):
      case node.type === "Property" &&
        node.value.type === "TemplateLiteral" &&
        node.value.expressions.length === 0 &&
        0 in node.value.quasis &&
        [
          "Preferred",
          "Preferred actions",
          "Required",
          "Required actions",
          "Prohibited",
          "Prohibited actions",
        ].includes(String(node.value.quasis[0].value.cooked)): {
        /** @type {FieldIssue} */
        const issue = {
          node,
          message:
            "Use Required or Prohibited typed prompts for normative categories.",
        };
        this.context.report(issue);
        break;
      }
      case true:
        break;
    }
  }

  /** @param {FieldIssue} issue */
  schema(issue) {
    switch (
      this.isStageProperty(this.property(issue.node)) ||
      this.isItemProperty(this.property(issue.node))
    ) {
      case false:
        this.context.report(issue);
        break;
      case true:
        break;
    }
  }

  /** @param {FieldIssue} issue */
  stage(issue) {
    switch (
      this.isStageProperty(this.property(issue.node)) ||
      this.isItemProperty(this.property(issue.node))
    ) {
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

  /** @param {import("estree").Node} node */
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
