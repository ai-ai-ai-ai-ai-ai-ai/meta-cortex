import { Effect } from "effect";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { unified } from "unified";
import { engine, type Options as EngineOptions } from "unified-engine";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import type { Options as LinkOptions } from "remark-validate-links";
import type { CatalogDocument } from "./catalog-document.ts";

type CatalogDocuments = readonly CatalogDocument[];

export class CatalogLinkAudit {
  constructor(private readonly documents: CatalogDocuments) {}

  readonly audit = Effect.fnUntraced(function* (this: CatalogLinkAudit) {
    switch (this.documents.length) {
      case 0:
        return;
      default:
        break;
    }
    const links: LinkOptions = { repository: false };
    const request: EngineOptions = {
      processor: unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkFrontmatter),
      files: this.documents.map((document) => document.linkFile()),
      plugins: [
        [fileURLToPath(import.meta.resolve("remark-validate-links")), links],
      ],
      extensions: ["md", "yaml"],
      detectConfig: false,
      detectIgnore: false,
      output: false,
      out: false,
      reporter: () => "",
    };
    // The engine supplies the file set that resolves cross-file heading anchors.
    yield* Effect.tryPromise(() => promisify(engine)(request));
  });
}
