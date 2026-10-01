import tseslint from "typescript-eslint";

/** The declaration grammar supplements TypeScript's object and import checks. */
export class ReceiptGrammar {
  /** @returns {import("eslint").Linter.Config} */
  static configuration() {
    return {
      files: ["**/*.lace.ts", "**/AGENTS.ts"],
      linterOptions: { noInlineConfig: true },
      languageOptions: { parser: tseslint.parser },
      plugins: { "@typescript-eslint": tseslint.plugin },
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
              "Declare each local Job as const name: Job = { entries: [...] }.",
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
              ":matches(Property[key.name=/^(content|label|script)$/], Property[key.value=/^(content|label|script)$/]):not([value.type='Literal'], [value.type='TemplateLiteral'])",
            message: "Write prompt content, labels, and commands as literals.",
          },
          {
            selector:
              ":matches(Property[key.name=/^(entries|items)$/], Property[key.value=/^(entries|items)$/]):not([value.type='ArrayExpression'])",
            message: "Declare entries and list items as literal arrays.",
          },
          {
            selector:
              "ArrayExpression:not(Property[key.name=/^(entries|items)$/] > ArrayExpression, Property[key.value=/^(entries|items)$/] > ArrayExpression)",
            message: "Arrays belong only to Job entries and prompt list items.",
          },
          {
            selector: "ArrayExpression[elements.length=0]",
            message:
              "Jobs and prompt lists contain at least one entry or item.",
          },
          {
            selector:
              ":matches(Property[key.name='entries'], Property[key.value='entries']) > ArrayExpression > :not(ObjectExpression, Identifier)",
            message:
              "Job entries are literal objects or static Job references.",
          },
          {
            selector:
              ":matches(Property[key.name='items'], Property[key.value='items']) > ArrayExpression > :not(ObjectExpression)",
            message:
              "List items are literal prompt statement or bullet list objects.",
          },
          {
            selector: "Property[value.type='Identifier']",
            message:
              "Nest literal context objects; Job references belong in entries arrays.",
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
