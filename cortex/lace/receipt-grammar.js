import tseslint from "typescript-eslint";

/** The declaration grammar supplements TypeScript's node and import checks. */
export class ReceiptGrammar {
  /** @returns {import("eslint").Linter.Config} */
  static configuration() {
    return {
      files: ["**/*.lace.ts", "**/AGENTS.ts"],
      linterOptions: { noInlineConfig: true },
      languageOptions: { parser: tseslint.parser },
      plugins: {
        "@typescript-eslint": tseslint.plugin,
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
        "no-dupe-keys": "error",
        "no-sparse-arrays": "error",
        "no-undef": "error",
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex:
                  "^(?!(?:(?:\\.\\.?/)+(?:lace/)?src/ts/(?:lace|job)\\.ts|(?:\\.\\.?/)(?:[^\\n]*\\.lace\\.ts|(?:[^\\n]*/)?AGENTS\\.ts))$)",
                message:
                  "Import only the Lace model, Job builder, or another receipt.",
              },
            ],
          },
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "*:not(Program, ImportDeclaration, ImportSpecifier, ImportDefaultSpecifier, Literal, Identifier, ExportDefaultDeclaration, VariableDeclaration, VariableDeclarator, CallExpression, ObjectExpression, ArrayExpression, Property, TemplateLiteral, TemplateElement, MemberExpression)",
            message:
              "Receipts contain only imports, Job builders, literal prompts and commands, and static job references.",
          },
          {
            selector: "Program:not(:has(> ExportDefaultDeclaration))",
            message: "Every receipt must default-export a job.",
          },
          {
            selector: "ExportDefaultDeclaration > :not(CallExpression)",
            message: "Every receipt must default-export a Job builder chain.",
          },
          {
            selector:
              "CallExpression:not([callee.type='MemberExpression'][callee.computed=false][callee.property.name=/^(statement|shellCommand|job)$/])",
            message: "Call only statement, shellCommand, or job builders.",
          },
          {
            selector: "CallExpression[arguments.length!=1]",
            message: "Each builder takes exactly one prompt, command, or Job.",
          },
          {
            selector:
              "CallExpression[callee.property.name=/^(statement|shellCommand)$/]:not([arguments.0.type='ObjectExpression'])",
            message: "Declare builder prompts and commands as literal objects.",
          },
          {
            selector:
              "CallExpression[callee.property.name='job']:not([arguments.0.type='Identifier'], [arguments.0.type='CallExpression'])",
            message: "Nest a declared Job or a builder chain.",
          },
          {
            selector:
              "VariableDeclaration:not([kind='const']), VariableDeclaration:not(Program > VariableDeclaration)",
            message: "Declare local Jobs with top-level const bindings.",
          },
          {
            selector:
              "VariableDeclarator:not([id.type='Identifier'][init.type='CallExpression'])",
            message: "Local bindings must name a Job builder chain.",
          },
          {
            selector: "Property[computed=true], Property[shorthand=true]",
            message: "Give every task field an explicit literal name.",
          },
          {
            selector:
              ":matches(Property[key.name=/^(content|label|script)$/], Property[key.value=/^(content|label|script)$/]):not([value.type='Literal'], [value.type='TemplateLiteral'])",
            message: "Write prompt content, labels, and commands as literals.",
          },
          {
            selector:
              ":matches(Property[key.name='items'], Property[key.value='items']):not([value.type='ArrayExpression'])",
            message: "Declare list items as a literal array.",
          },
          {
            selector:
              "ArrayExpression:not(Property[key.name='items'] > ArrayExpression, Property[key.value='items'] > ArrayExpression)",
            message: "Arrays belong only to prompt list items.",
          },
          {
            selector: "ArrayExpression[elements.length=0]",
            message: "Prompt lists contain at least one item.",
          },
          {
            selector:
              "ArrayExpression > :not(Literal, TemplateLiteral, ObjectExpression)",
            message: "List items are literal prose or labelled groups.",
          },
          {
            selector:
              "MemberExpression:not(Property > MemberExpression, CallExpression > MemberExpression.callee), MemberExpression[computed=true], CallExpression > MemberExpression.callee:not([object.type='Identifier'], [object.type='CallExpression'])",
            message:
              "Member access is limited to builder calls and enum fields.",
          },
          {
            selector:
              "Property[value.type='MemberExpression']:not([key.name='kind'][value.object.name='PromptKind'], [key.value='kind'][value.object.name='PromptKind'], [key.name='cwd'][value.object.name='WorkingDirectory'], [key.value='cwd'][value.object.name='WorkingDirectory'])",
            message: "Use PromptKind for kind and WorkingDirectory for cwd.",
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
            message: "Import a receipt's default job as a static reference.",
          },
        ],
      },
    };
  }
}
