import { Effect } from "effect";
import { globby, type Options } from "globby";
import { dirname, relative } from "node:path";
import { VFile, type Options as FileOptions } from "vfile";
import { CatalogLinkAudit } from "./catalog-links.ts";
import { CatalogKind, type CatalogComparison } from "./catalog.ts";
import { CatalogDocument, CatalogReader } from "./catalog-document.ts";

import type { RuleName } from "./rule-name.ts";
import type { PracticeOwner } from "./practice-owner.ts";

type CatalogPaths = readonly string[];
interface RuleLocation {
  readonly document: CatalogDocument;
  readonly rule: CatalogComparison;
}

interface RuleComparison {
  readonly owner: RuleLocation;
  readonly candidate: RuleLocation;
}

class CatalogScope {
  private readonly rules = new Map<RuleName, RuleLocation>();
  private readonly owners = new Map<PracticeOwner, CatalogDocument[]>();
  constructor(private readonly documents: readonly CatalogDocument[]) {}

  register(document: CatalogDocument): void {
    const { catalog, file } = document.content;
    switch (catalog.kind) {
      case CatalogKind.Practice: {
        const owners = this.owners.get(catalog.owner) || [];
        owners.push(document);
        this.owners.set(catalog.owner, owners);
        break;
      }
      case CatalogKind.Navigation:
      case CatalogKind.Check:
        break;
    }
    for (const rule of document.definitions()) {
      const location: RuleLocation = { document, rule };
      switch (this.rules.has(rule.id)) {
        case true:
          file.message(
            `Duplicate rule name: ${rule.id}.`,
            "cortex:duplicate-rule",
          );
          break;
        case false:
          this.rules.set(rule.id, location);
      }
      switch (rule.source.includes("#") && !rule.source.endsWith("#")) {
        case false:
          file.message(
            `Link ${rule.id} to its exact source heading.`,
            "cortex:missing-rule-anchor",
          );
          break;
        case true:
          break;
      }
    }
  }

  compare(document: CatalogDocument): void {
    // A selected check leaf has source links but no enclosing rule inventory.
    switch (this.rules.size) {
      case 0:
        return;
      default:
        break;
    }
    for (const rule of document.comparisons()) {
      const candidate: RuleLocation = { document, rule };
      const owners = [...this.rules.values()].filter(
        (owner) => owner.rule.id === rule.id,
      );
      switch (owners.length) {
        case 0:
          document.content.file.message(
            `Unknown compared rule: ${rule.id}.`,
            "cortex:unknown-rule",
          );
          break;
        default:
          break;
      }
      for (const owner of owners) {
        const comparison: RuleComparison = { owner, candidate };
        this.compareSource(comparison);
      }
    }
  }

  compareSource(comparison: RuleComparison): void {
    const { owner, candidate } = comparison;
    const expected =
      owner.document.target(owner.rule.source) +
      owner.rule.source.slice(owner.rule.source.indexOf("#"));
    const actual =
      candidate.document.target(candidate.rule.source) +
      candidate.rule.source.slice(candidate.rule.source.indexOf("#"));
    switch (actual === expected) {
      case false:
        candidate.document.content.file.message(
          `Comparison ${candidate.rule.id} disagrees with its canonical source.`,
          "cortex:rule-source-mismatch",
        );
        break;
      case true:
        break;
    }
  }

  readonly audit = Effect.fnUntraced(function* (
    this: CatalogScope,
    root: CatalogDocument,
  ) {
    for (const document of this.documents) this.register(document);
    for (const document of this.documents) this.compare(document);
    for (const [owner, owners] of this.owners) {
      switch (owners.length) {
        case 1:
          break;
        default:
          root.content.file.message(
            `Duplicate owning entry for ${owner}.`,
            "cortex:duplicate-owner-entry",
          );
      }
    }
    const directory = dirname(root.content.file.path);
    const options: Options = {
      cwd: directory,
      absolute: true,
      ignore: ["**/node_modules/**"],
    };
    const practices = yield* Effect.tryPromise(() =>
      globby("practices/**/*.md", options),
    );
    const sources = this.documents.flatMap((document) => document.sources());
    const paths = new Set(sources.map((source) => source.path));
    for (const path of paths) {
      const owners = new Set(
        sources
          .filter((source) => source.path === path)
          .map((source) => source.owner),
      );
      switch (owners.size) {
        case 1:
          break;
        default:
          root.content.file.message(
            `Multiple owner identities for ${path}: ${[...owners].join(", ")}.`,
            "cortex:duplicate-owner-entry",
          );
      }
    }
    const missing = practices.filter((path) => !paths.has(path));
    for (const practice of missing) {
      root.content.file.message(
        `Missing owning entry for ${relative(directory, practice)}.`,
        "cortex:missing-owner-entry",
      );
    }
    const catalogs = yield* Effect.tryPromise(() =>
      globby("**/index.yaml", options),
    );
    const reached = new Set(
      this.documents.map((document) => document.content.file.path),
    );
    for (const orphan of catalogs.filter((path) => !reached.has(path))) {
      root.content.file.message(
        `Unlinked catalog: ${relative(directory, orphan)}.`,
        "cortex:unlinked-catalog",
      );
    }
  });
}

export class Navigation {
  private readonly documents = new Map<string, CatalogDocument>();
  private readonly failures: VFile[] = [];
  constructor(private readonly paths: CatalogPaths) {}

  readonly load = Effect.fnUntraced(function* (this: Navigation, path: string) {
    const loaded = new CatalogReader(path).read().pipe(
      Effect.map((document) => {
        this.documents.set(path, document);
        return document.children();
      }),
      Effect.catch((error) => {
        const options: FileOptions = { path };
        const file = new VFile(options);
        file.message(error.message, "cortex:invalid-catalog");
        this.failures.push(file);
        return Effect.succeed<string[]>([]);
      }),
    );
    return yield* loaded;
  });

  scope(root: CatalogDocument): CatalogDocument[] {
    const selected: CatalogDocument[] = [];
    const pending = [root.content.file.path];
    const visited = new Set<string>();
    for (const path of pending) {
      switch (visited.has(path)) {
        case true:
          root.content.file.message(
            `Repeated or cyclic catalog reference: ${path}.`,
            "cortex:catalog-cycle",
          );
          continue;
        case false:
          visited.add(path);
      }
      const matches = [...this.documents.values()].filter(
        (document) => document.content.file.path === path,
      );
      for (const document of matches) {
        selected.push(document);
        pending.push(...document.children());
      }
    }
    return selected;
  }

  readonly audit = Effect.fnUntraced(function* (this: Navigation) {
    const pending = [...this.paths];
    const attempted = new Set<string>();
    for (const path of pending) {
      switch (attempted.has(path)) {
        case true:
          continue;
        case false:
          attempted.add(path);
      }
      pending.push(...(yield* this.load(path)));
    }
    const documents = [...this.documents.values()];
    const children = new Set(
      documents.flatMap((document) => document.children()),
    );
    const roots = documents.filter(
      (document) => !children.has(document.content.file.path),
    );
    const reached = new Set<string>();
    for (const root of roots) {
      const scope = this.scope(root);
      for (const document of scope) reached.add(document.content.file.path);
      yield* new CatalogScope(scope).audit(root);
    }
    for (const document of documents.filter(
      (item) => !reached.has(item.content.file.path),
    )) {
      document.content.file.message(
        "Catalog cycle has no navigation root.",
        "cortex:catalog-cycle",
      );
    }
    yield* new CatalogLinkAudit(documents).audit();
    return [
      ...this.failures,
      ...documents.map((document) => document.content.file),
    ];
  });
}
