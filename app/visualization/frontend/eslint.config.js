import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import svelte from "eslint-plugin-svelte";
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "src/contracts.ts"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...svelte.configs["flat/recommended"],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "svelte.config.js"],
        },
        extraFileExtensions: [".svelte"],
      },
    },
    rules: {
      "max-depth": ["error", 2],
      "max-nested-callbacks": [
        "error",
        { max: 2, checkConstructorCallCallbacks: true },
      ],
      "no-restricted-syntax": ["error", "IfStatement", "ConditionalExpression"],
      "no-fallthrough": "error",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
        },
      ],
    },
  },
  { files: ["**/*.svelte.ts"], languageOptions: { parser: tseslint.parser } },
  {
    files: ["**/*.svelte"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // Registry-generated shadcn APIs retain their upstream anchor/disabled handling.
    // See src/lib/UPSTREAM.md; all other rules and authored dashboard files remain checked.
    files: ["src/lib/components/ui/button/button.svelte"],
    rules: { "no-restricted-syntax": "off" },
  },
);
