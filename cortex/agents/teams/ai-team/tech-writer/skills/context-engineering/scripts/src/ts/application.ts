import { Effect } from "effect";
import { ArticleAudit, type ArticleDocument } from "./article.ts";
import { NavigationAudit } from "./navigation.ts";
import { SkillCatalog, Command, type SkillRequest } from "./catalog.ts";
import { FailureCode, SkillFailure } from "./failure.ts";
import {
  ResponseKind,
  YamlRequest,
  YamlResponse,
  type SkillResponse,
} from "./transport.ts";

export type SkillExecution = {
  readonly yaml: string;
  readonly exitCode: number;
};

export class SkillApplication {
  private static readonly invocation =
    "bun src/ts/cli.ts --request-yaml=<yaml>";
  constructor(private readonly source: string) {}

  execute(): Effect.Effect<SkillExecution> {
    return new YamlRequest(this.source).decode().pipe(
      Effect.flatMap((request) => this.dispatch(request)),
      Effect.flatMap((response) =>
        new YamlResponse(response).encode().pipe(
          Effect.map((yaml) => ({
            yaml,
            exitCode:
              response.kind === ResponseKind.Findings &&
              response.findings.length > 0
                ? 1
                : 0,
          })),
        ),
      ),
      Effect.catchAll((failure) => Effect.succeed(this.failure(failure))),
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
      const paths = request.articles.audit.documents.map(
        (document) => document.path,
      );
      if (
        new Set(paths).size !== paths.length ||
        request.articles.audit.documents.some(
          (document) => !new ArticleSourceOrder(document).valid(),
        )
      ) {
        return Effect.fail(SkillFailure.from(FailureCode.Request));
      }
      const response: SkillResponse = {
        kind: ResponseKind.Findings,
        command: Command.Articles,
        findings: new ArticleAudit(request.articles.audit).execute(),
      };
      return Effect.succeed(response);
    }
    const documents = request.navigation.audit.documents.map(
      (document) => document.path,
    );
    const graphs = request.navigation.audit.graphs.map((graph) => graph.path);
    if (
      new Set(documents).size !== documents.length ||
      new Set(graphs).size !== graphs.length
    ) {
      return Effect.fail(SkillFailure.from(FailureCode.Request));
    }
    const response: SkillResponse = {
      kind: ResponseKind.Findings,
      command: Command.Navigation,
      findings: new NavigationAudit(request.navigation.audit).execute(),
    };
    return Effect.succeed(response);
  }

  private failure(failure: SkillFailure): SkillExecution {
    // Fixed diagnostic text never echoes untrusted YAML, parser excerpts, or secrets.
    return {
      yaml: `kind: failure\ncode: ${failure.code}\nrecovery: |\n  version: 1\n  tools:\n    list: {}\n`,
      exitCode: 2,
    };
  }
}

class ArticleSourceOrder {
  constructor(private readonly document: ArticleDocument) {}
  valid(): boolean {
    let precedingLine = 0;
    for (const block of this.document.blocks) {
      if (block.line < precedingLine) return false;
      precedingLine = block.line;
    }
    return true;
  }
}
