// Adapted from Nook's cortex-article-structure skill scripts. See LICENSE.nook.
import { Schema } from "effect";
import { DocumentFields } from "./documents.ts";

export enum BlockKind {
  Heading = "heading",
  Paragraph = "paragraph",
  OrderedList = "visible-ordered-list",
  Structure = "structure",
  Transparent = "transparent",
  Separator = "density-separator",
  Table = "table",
}

export enum ArticleFindingCode {
  Empty = "empty-article",
  Dense = "dense-article",
  Table = "markdown-table",
  Procedure = "unordered-procedure",
}

export class ArticleSchema {
  private static readonly headingFields = {
    kind: Schema.Literal(BlockKind.Heading),
    line: DocumentFields.line,
    depth: Schema.Int.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(1)),
      Schema.check(Schema.isLessThanOrEqualTo(6)),
      Schema.brand("HeadingDepth"),
    ),
    text: Schema.String.pipe(
      Schema.check(Schema.isMaxLength(3800)),
      Schema.brand("HeadingText"),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly heading = Schema.Struct(ArticleSchema.headingFields);
  private static readonly contentFields = {
    kind: Schema.Literals([
      BlockKind.Paragraph,
      BlockKind.OrderedList,
      BlockKind.Structure,
      BlockKind.Transparent,
      BlockKind.Separator,
      BlockKind.Table,
    ]),
    line: DocumentFields.line,
  } satisfies Schema.Struct.Fields;
  private static readonly documentFields = {
    path: DocumentFields.path,
    blocks: Schema.Array(
      Schema.Union([
        ArticleSchema.heading,
        Schema.Struct(ArticleSchema.contentFields),
      ]),
    ).pipe(Schema.check(Schema.isMaxLength(2000))),
  } satisfies Schema.Struct.Fields;
  private static readonly requestFields = {
    documents: Schema.Array(Schema.Struct(ArticleSchema.documentFields)).pipe(
      Schema.check(Schema.isMaxLength(100)),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly value = Schema.Struct(ArticleSchema.requestFields);
}
export type ArticleRequest = typeof ArticleSchema.value.Type;

export type ArticleDocument = ArticleRequest["documents"][number];
export type ArticleBlock = ArticleDocument["blocks"][number];
export type ArticleHeading = typeof ArticleSchema.heading.Type;
export type ArticleBlocks = readonly ArticleBlock[];
export type ArticleFinding = {
  readonly code: ArticleFindingCode;
  readonly file: ArticleDocument["path"];
  readonly line: ArticleBlock["line"];
};
export type ArticleFindings = readonly ArticleFinding[];
export type ArticleSectionRequest = {
  readonly document: ArticleDocument;
  readonly heading: ArticleHeading;
  readonly blocks: ArticleBlocks;
};

export class ArticleAudit {
  constructor(private readonly request: ArticleRequest) {}

  execute(): ArticleFindings {
    return this.request.documents.flatMap((document) =>
      new DocumentArticles(document).audit(),
    );
  }
}

class DocumentArticles {
  constructor(private readonly document: ArticleDocument) {}

  audit(): ArticleFindings {
    const findings: ArticleFinding[] = [];
    for (const [index, block] of this.document.blocks.entries()) {
      if (block.kind === BlockKind.Table) {
        const finding: ArticleFinding = {
          code: ArticleFindingCode.Table,
          file: this.document.path,
          line: block.line,
        };
        findings.push(finding);
      }
      if (
        block.kind !== BlockKind.Heading ||
        block.depth < 2 ||
        block.depth > 3
      )
        continue;
      const following = this.document.blocks.slice(index + 1);
      const boundary = following.findIndex(
        (candidate) =>
          candidate.kind === BlockKind.Heading &&
          candidate.depth <= block.depth,
      );
      let blocks: ArticleBlocks = following;
      if (boundary >= 0) {
        blocks = following.slice(0, boundary);
      }
      const request: ArticleSectionRequest = {
        document: this.document,
        heading: block,
        blocks,
      };
      findings.push(...new ArticleSection(request).audit());
    }
    return findings;
  }
}

class ArticleSection {
  private static readonly procedure =
    /\b(procedures?|runbooks?|steps|ordered deliver(?:y|ies)|delivery sequences?)\b/i;
  private static readonly maximumProseRun = 3;
  constructor(private readonly request: ArticleSectionRequest) {}

  audit(): ArticleFindings {
    const findings: ArticleFinding[] = [];
    if (
      !this.request.blocks.some(
        (block) =>
          block.kind === BlockKind.Paragraph ||
          block.kind === BlockKind.OrderedList ||
          block.kind === BlockKind.Structure,
      )
    ) {
      return [this.finding(ArticleFindingCode.Empty)];
    }
    let consecutive = 0;
    for (const block of this.request.blocks) {
      if (block.kind === BlockKind.Heading && block.depth <= 3) break;
      if (block.kind === BlockKind.Transparent) continue;
      if (block.kind === BlockKind.Paragraph) {
        consecutive += 1;
      } else {
        consecutive = 0;
      }
      if (consecutive === ArticleSection.maximumProseRun + 1) {
        const finding: ArticleFinding = {
          code: ArticleFindingCode.Dense,
          file: this.request.document.path,
          line: block.line,
        };
        findings.push(finding);
      }
    }
    if (
      ArticleSection.procedure.test(this.request.heading.text) &&
      !this.request.blocks.some((block) => block.kind === BlockKind.OrderedList)
    ) {
      findings.push(this.finding(ArticleFindingCode.Procedure));
    }
    return findings;
  }

  private finding(code: ArticleFindingCode): ArticleFinding {
    return {
      code,
      file: this.request.document.path,
      line: this.request.heading.line,
    };
  }
}
