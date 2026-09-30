import shared from "../scripts/eslint.config.js";
import { ReceiptGrammar } from "./receipt-grammar.js";

export default [
  ...shared.map((configuration) => ({
    ...configuration,
    files: ["lace/src/**/*.ts", "lace/*.js"],
    languageOptions: {
      ...configuration.languageOptions,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: new URL("..", import.meta.url).pathname,
      },
    },
  })),
  ReceiptGrammar.configuration(),
];
