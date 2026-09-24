import tseslint from "typescript-eslint";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ConditionalExpression",
          message:
            "Use simple Effect composition and exhaustive Match branches.",
        },
        {
          selector:
            ":matches(IfStatement, SwitchStatement, ForStatement, ForInStatement, ForOfStatement, WhileStatement, DoWhileStatement, TryStatement)",
          message:
            "Keep workflow control in Effect combinators and exhaustive Match branches; do not mix in procedural control flow.",
        },
        {
          selector: "CallExpression > ObjectExpression",
          message: "Pass a named, typed request instead of an inline object.",
        },
        {
          selector: "NewExpression > ObjectExpression",
          message: "Name and type constructor requests.",
        },
        {
          selector: "Program > VariableDeclaration",
          message: "Constants and mutable state belong to concrete owners.",
        },
        {
          selector: "Program > ExportNamedDeclaration > VariableDeclaration",
          message: "Export owned contracts instead of module variables.",
        },
        {
          selector: "FunctionDeclaration",
          message:
            "Behavior belongs to an instance or its construction factory.",
        },
        { selector: "TSNullKeyword", message: "Model explicit domain states." },
        {
          selector: "TSUndefinedKeyword",
          message: "Normalize absence at the external edge.",
        },
        {
          selector: "LogicalExpression[operator='??']",
          message: "Handle absence explicitly.",
        },
      ],
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            object: "Use a concrete contract.",
            Object: "Use a concrete contract.",
            "{}": "Use a concrete contract.",
            unknown: "Keep unknown in the transport decoder only.",
          },
        },
      ],
      "max-params": ["error", 1],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unused-vars": "error",
    },
  },
];
