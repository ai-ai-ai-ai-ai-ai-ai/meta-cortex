import { Effect } from "effect";
import type { Root, Link } from "mdast";
import { dirname, resolve } from "node:path";
import { unified } from "unified";
import remarkStringify from "remark-stringify";
import { VFile, type Options as FileOptions } from "vfile";
import {
  CatalogInput,
  CatalogKind,
  type Catalog,
  type CatalogReference,
  type CatalogComparison,
} from "./catalog.ts";

import type { PracticeOwner } from "./practice-owner.ts";

export interface PracticeSource {
  readonly owner: PracticeOwner;
  readonly path: string;
}

interface CatalogContent {
  readonly file: VFile;
  readonly catalog: Catalog;
}

export class CatalogDocument {
  constructor(readonly content: CatalogContent) {}

  target(path: string): string {
    return resolve(
      dirname(this.content.file.path),
      decodeURIComponent(path.split("#")[0] || ""),
    );
  }

  children(): string[] {
    switch (this.content.catalog.kind) {
      case CatalogKind.Navigation:
        return this.content.catalog.entries
          .filter(
            (entry) =>
              entry.path.endsWith("/index.yaml") || entry.path === "index.yaml",
          )
          .map((entry) => this.target(entry.path));
      case CatalogKind.Practice:
      case CatalogKind.Check:
        return [];
    }
  }

  references(): readonly CatalogReference[] {
    const catalog = this.content.catalog;
    switch (catalog.kind) {
      case CatalogKind.Navigation:
        return catalog.entries;
      case CatalogKind.Practice:
        return [
          { title: catalog.source_title, path: catalog.source },
          ...catalog.related,
          ...catalog.rules.map((rule) => ({
            title: rule.id,
            path: rule.source,
          })),
        ];
      case CatalogKind.Check:
        return catalog.compare.map((rule) => ({
          title: rule.id,
          path: rule.source,
        }));
    }
  }

  sources(): readonly PracticeSource[] {
    const catalog = this.content.catalog;
    switch (catalog.kind) {
      case CatalogKind.Practice:
        return [{ owner: catalog.owner, path: this.target(catalog.source) }];
      case CatalogKind.Navigation:
      case CatalogKind.Check:
        return [];
    }
  }

  definitions(): readonly CatalogComparison[] {
    switch (this.content.catalog.kind) {
      case CatalogKind.Practice:
        return this.content.catalog.rules;
      case CatalogKind.Navigation:
      case CatalogKind.Check:
        return [];
    }
  }

  comparisons(): readonly CatalogComparison[] {
    switch (this.content.catalog.kind) {
      case CatalogKind.Check:
        return this.content.catalog.compare;
      case CatalogKind.Navigation:
      case CatalogKind.Practice:
        return [];
    }
  }

  linkFile(): VFile {
    const links: Link[] = this.references().map((reference) => ({
      type: "link",
      url: reference.path,
      children: [{ type: "text", value: reference.title }],
    }));
    const tree: Root = {
      type: "root",
      children: [{ type: "paragraph", children: links }],
    };
    this.content.file.value = unified().use(remarkStringify).stringify(tree);
    return this.content.file;
  }
}

export class CatalogReader {
  constructor(private readonly path: string) {}

  readonly read = Effect.fnUntraced(function* (this: CatalogReader) {
    const source = yield* Effect.tryPromise(() => Bun.file(this.path).text());
    const catalog = yield* new CatalogInput(source).decode();
    const options: FileOptions = { path: this.path };
    const file = new VFile(options);
    const content: CatalogContent = { file, catalog };
    return new CatalogDocument(content);
  });
}
