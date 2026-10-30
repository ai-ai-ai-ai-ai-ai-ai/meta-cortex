import { getCSSLanguageService } from "vscode-css-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "svelte/compiler";

export interface CheckFinding {
  readonly rule: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly start: number;
  readonly end: number;
}

export class ComponentCss {
  private severity(value: number | undefined): "error" | "warning" {
    switch (value) {
      case 1:
        return "error";
      case undefined:
      default:
        return "warning";
    }
  }

  check(source: string, filepath: string): readonly CheckFinding[] {
    const ast = parse(source, { modern: true });
    switch (ast.css) {
      case null:
        return [];
      default: {
        const content = ast.css.content;
        const document = TextDocument.create(
          filepath,
          "css",
          0,
          source.slice(content.start, content.end),
        );
        const service = getCSSLanguageService();
        return service
          .doValidation(document, service.parseStylesheet(document))
          .map((diagnostic) => ({
            rule: `css/${String(diagnostic.code)}`,
            message: diagnostic.message,
            severity: this.severity(diagnostic.severity),
            start: content.start + document.offsetAt(diagnostic.range.start),
            end: content.start + document.offsetAt(diagnostic.range.end),
          }));
      }
    }
  }
}
