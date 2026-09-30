import tseslint from "typescript-eslint";
import { ReceiptBindings } from "./receipt-bindings.js";

/** The declaration grammar supplements TypeScript's node and import checks. */
export class ReceiptGrammar {
  /** @returns {import("eslint").Linter.Config} */
  static configuration() {
    return {
      files: ["**/*.lace.ts"],
      linterOptions: { noInlineConfig: true },
      languageOptions: { parser: tseslint.parser },
      plugins: {
        lace: { rules: { "imported-values": ReceiptBindings.rule() } },
        "@typescript-eslint": tseslint.plugin,
      },
      rules: {
        "lace/imported-values": "error",
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
        "no-undef": "error",
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex:
                  "^(?!(?:(?:\\.\\.?/)+(?:lace/)?src/ts/lace\\.ts|(?:\\.\\.?/)[^\\n]*\\.lace\\.ts)$)",
                message: "Import only the Lace model or another receipt.",
              },
            ],
          },
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "*:not(Program, ImportDeclaration, ImportSpecifier, ImportDefaultSpecifier, Literal, Identifier, ExportDefaultDeclaration, TSSatisfiesExpression, TSAsExpression, TSTypeReference, ObjectExpression, Property, TemplateLiteral, TemplateElement, MemberExpression)",
            message:
              "Receipts contain only imports, literal jobs/tasks, and imported child references.",
          },
          {
            selector: "Program:not(:has(> ExportDefaultDeclaration))",
            message: "Every receipt must default-export a job.",
          },
          {
            selector: "ExportDefaultDeclaration > :not(TSSatisfiesExpression)",
            message: "Declare the root with 'as const satisfies Job'.",
          },
          {
            selector:
              "ExportDefaultDeclaration > TSSatisfiesExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='Job'])",
            message: "The default export must satisfy Job.",
          },
          {
            selector:
              "ExportDefaultDeclaration > TSSatisfiesExpression > :not(TSAsExpression, TSTypeReference)",
            message: "The root must be a literal job with 'as const'.",
          },
          {
            selector:
              "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const'])",
            message: "Only 'as const' is permitted; do not cast a receipt.",
          },
          {
            selector:
              "TSAsExpression > :not(ObjectExpression, TSTypeReference)",
            message: "Declare a literal root job instead of aliasing a file.",
          },
          {
            selector: "ObjectExpression[properties.length=0]",
            message: "Jobs must contain at least one named child.",
          },
          {
            selector: "Property[computed=true], Property[shorthand=true]",
            message: "Give every child and field an explicit literal name.",
          },
          {
            selector: "Literal[value=/^\\s*$/]",
            message:
              "Instruction text, commands, and child names are nonblank.",
          },
          {
            selector: "TemplateLiteral[expressions.length!=0]",
            message: "Write literal prose or commands without interpolation.",
          },
          {
            selector: "TemplateElement[value.raw=/^\\s*$/]",
            message: "Instruction text and commands are nonblank.",
          },
          {
            selector:
              "ImportDeclaration[source.value=/\\.lace\\.ts$/] > ImportSpecifier",
            message:
              "Import a receipt's default job, then select its children.",
          },
        ],
      },
    };
  }
}
