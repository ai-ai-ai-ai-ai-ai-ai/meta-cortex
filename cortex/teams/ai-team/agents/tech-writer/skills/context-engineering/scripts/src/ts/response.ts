import { stringify } from "yaml";
import {
  SkillRequestDocument,
  type SkillRequestWire,
} from "./request-document.ts";
import type { ArticleFindings } from "./article.ts";
import type { NavigationFindings } from "./navigation.ts";
import type { CommandCatalog } from "./catalog.ts";
import { Command, ProtocolVersion } from "./request.ts";
import { FailureCode, type SkillFailure } from "./failure.ts";
import { ProtocolText, type YamlText } from "./protocol-text.ts";

export enum ResponseKind {
  Catalog = "catalog",
  Findings = "findings",
  Failure = "failure",
}
export enum ExitCode {
  Success = 0,
  Findings = 1,
  Invalid = 2,
}
export interface CatalogResponse {
  readonly kind: ResponseKind.Catalog;
  readonly catalog: CommandCatalog;
}
export interface ArticleResponse {
  readonly kind: ResponseKind.Findings;
  readonly command: Command.Articles;
  readonly findings: ArticleFindings;
}
export interface NavigationResponse {
  readonly kind: ResponseKind.Findings;
  readonly command: Command.Navigation;
  readonly findings: NavigationFindings;
}
export type AuditResponse = ArticleResponse | NavigationResponse;
export type SkillResponse = CatalogResponse | AuditResponse;
export interface FailureResponse {
  readonly kind: ResponseKind.Failure;
  readonly code: FailureCode;
  readonly recovery: YamlText;
}
export interface SkillExecution {
  readonly yaml: YamlText;
  readonly exitCode: ExitCode;
}

/** Only this presentation boundary discards internal causes and emits safe diagnostics. */
export class FailurePresentation {
  constructor(private readonly failure: SkillFailure) {}
  render(): SkillExecution {
    const recovery: SkillRequestWire = {
      version: ProtocolVersion.V1,
      tools: { list: {} },
    };
    const response: FailureResponse = {
      kind: ResponseKind.Failure,
      code: this.failure.code,
      recovery: new SkillRequestDocument(recovery).encode(),
    };
    return {
      yaml: ProtocolText.yaml(stringify(response)),
      exitCode: ExitCode.Invalid,
    };
  }
}
