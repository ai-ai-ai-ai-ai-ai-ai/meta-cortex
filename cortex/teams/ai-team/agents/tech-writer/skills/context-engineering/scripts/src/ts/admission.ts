import { Effect } from "effect";
import { type ArticleDocument, type ArticleRequest } from "./article.ts";
import { type NavigationRequest } from "./navigation.ts";
import { FailureCode, SkillFailure } from "./failure.ts";

export class ArticleAdmission {
  constructor(private readonly request: ArticleRequest) {}
  validate(): Effect.Effect<ArticleRequest, SkillFailure> {
    const paths = this.request.documents.map((document) => document.path);
    if (
      new Set(paths).size !== paths.length ||
      this.request.documents.some(
        (document) => !new ArticleSourceOrder(document).valid(),
      )
    ) {
      return Effect.fail(SkillFailure.from(FailureCode.Request));
    }
    return Effect.succeed(this.request);
  }
}
export class NavigationAdmission {
  constructor(private readonly request: NavigationRequest) {}
  validate(): Effect.Effect<NavigationRequest, SkillFailure> {
    const documents = this.request.documents.map((document) => document.path);
    const graphs = this.request.graphs.map((graph) => graph.path);
    if (
      new Set(documents).size !== documents.length ||
      new Set(graphs).size !== graphs.length
    ) {
      return Effect.fail(SkillFailure.from(FailureCode.Request));
    }
    return Effect.succeed(this.request);
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
