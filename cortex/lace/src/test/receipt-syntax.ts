import { Linter } from "eslint";

import { ReceiptGrammar } from "../../receipt-grammar.js";

type GrammarMessages = readonly string[];

/** Check the actual receipt grammar in memory; no source is evaluated. */
export class ReceiptSyntax {
  constructor(private readonly source: string) {}

  messages(): GrammarMessages {
    const config: Linter.Config[] = [ReceiptGrammar.configuration()];
    const options: Linter.LintOptions = { filename: "case.lace.ts" };
    return new Linter()
      .verify(this.source, config, options)
      .map((finding) => finding.message);
  }
}
