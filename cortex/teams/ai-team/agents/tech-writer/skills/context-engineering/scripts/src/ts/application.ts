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
    const decoded = new YamlRequest(this.source).decode();
    const owner = this;
    const program = Effect.gen(function* () {
      const request = yield* decoded;
      const response = yield* owner.dispatch(request);
      const yaml = yield* new YamlResponse(response).encode();
      return { yaml, exitCode: owner.exitCode(response) };
    });

    return Effect.catch(program, (failure) =>
      Effect.sync(() => new FailurePresentation(failure).render()),
    );
  }

  private exitCode(response: SkillResponse): ExitCode {
    switch (response.kind) {
      case ResponseKind.Catalog:
        return ExitCode.Success;
      case ResponseKind.Findings:
        switch (response.findings.length) {
          case 0:
            return ExitCode.Success;
          default:
            return ExitCode.Findings;
        }
    }
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
