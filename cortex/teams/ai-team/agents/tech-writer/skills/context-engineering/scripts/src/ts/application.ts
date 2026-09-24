import { Effect } from "effect";
import { ArticleAudit } from "./article.ts";
import { NavigationAudit } from "./navigation.ts";
import { ArticleAdmission, NavigationAdmission } from "./admission.ts";
import { SkillCatalog } from "./catalog.ts";
import { Command, type SkillRequest } from "./request.ts";
import type { SkillFailure } from "./failure.ts";
import { YamlRequest, YamlResponse } from "./transport.ts";
import {
  ExitCode,
  ResponseKind,
  FailurePresentation,
  type SkillExecution,
  type SkillResponse,
  type ArticleResponse,
  type NavigationResponse,
} from "./response.ts";
import { ProtocolText, type YamlText } from "./protocol-text.ts";

export class SkillApplication {
  private static readonly invocation = ProtocolText.invocation(
    "bun teams/ai-team/agents/tech-writer/skills/context-engineering/scripts/src/ts/cli.ts --request-yaml=<yaml>",
  );
  constructor(private readonly source: YamlText) {}
  execute(): Effect.Effect<SkillExecution> {
    return new YamlRequest(this.source).decode().pipe(
      Effect.flatMap((request) => this.dispatch(request)),
      Effect.flatMap((response) =>
        new YamlResponse(response).encode().pipe(
          Effect.map((yaml): SkillExecution => {
            switch (response.kind) {
              case ResponseKind.Catalog:
                return { yaml, exitCode: ExitCode.Success };
              case ResponseKind.Findings:
                if (response.findings.length > 0) {
                  return { yaml, exitCode: ExitCode.Findings };
                }
                return { yaml, exitCode: ExitCode.Success };
            }
            const unhandled: never = response;
            return unhandled;
          }),
        ),
      ),
      Effect.catch((failure) =>
        Effect.succeed(new FailurePresentation(failure).render()),
      ),
    );
  }
  private dispatch(
    request: SkillRequest,
  ): Effect.Effect<SkillResponse, SkillFailure> {
    if ("tools" in request) {
      const response: SkillResponse = {
        kind: ResponseKind.Catalog,
        catalog: new SkillCatalog(SkillApplication.invocation).describe(),
      };
      return Effect.succeed(response);
    }
    if ("articles" in request) {
      return new ArticleAdmission(request.articles.audit).validate().pipe(
        Effect.map((admitted): ArticleResponse => ({
          kind: ResponseKind.Findings,
          command: Command.Articles,
          findings: new ArticleAudit(admitted).execute(),
        })),
      );
    }
    return new NavigationAdmission(request.navigation.audit).validate().pipe(
      Effect.map((admitted): NavigationResponse => ({
        kind: ResponseKind.Findings,
        command: Command.Navigation,
        findings: new NavigationAudit(admitted).execute(),
      })),
    );
  }
}
