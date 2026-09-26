import { expect, test } from "bun:test";
import { Effect } from "effect";
import { globby, type Options } from "globby";
import { fileURLToPath } from "node:url";
import { CatalogReader } from "../ts/catalog-document.ts";
import { CatalogSchema } from "../ts/catalog.ts";

class ShippedCatalogs {
  private readonly options: Options = {
    cwd: fileURLToPath(new URL("../../../../../../../../../", import.meta.url)),
    absolute: true,
    ignore: ["**/node_modules/**"],
  };

  readonly read = Effect.fnUntraced(function* (this: ShippedCatalogs) {
    const paths = yield* Effect.tryPromise(() =>
      globby("teams/**/index.yaml", this.options),
    );
    return yield* Effect.forEach(paths, (path) =>
      new CatalogReader(path).read(),
    );
  });

  readonly verify = Effect.fnUntraced(function* (this: ShippedCatalogs) {
    const catalogs = yield* this.read();
    const rules = new Set(
      catalogs
        .flatMap((catalog) => catalog.definitions())
        .map((rule) => rule.id),
    );
    const sources = catalogs.flatMap((catalog) => catalog.sources());
    const owners = new Set(sources.map((source) => source.owner));
    expect([...rules].sort()).toEqual(
      [...CatalogSchema.ruleName.literals].sort(),
    );
    expect([...owners].sort()).toEqual(
      [...CatalogSchema.practiceOwner.literals].sort(),
    );
    for (const owner of owners) {
      const paths = new Set(
        sources
          .filter((source) => source.owner === owner)
          .map((source) => source.path),
      );
      expect(paths.size).toBe(1);
    }
    const paths = new Set(sources.map((source) => source.path));
    for (const path of paths) {
      const identities = new Set(
        sources
          .filter((source) => source.path === path)
          .map((source) => source.owner),
      );
      expect(identities.size).toBe(1);
    }
  });
}

test("static enums exactly cover shipped rule names and canonical practice owners", () =>
  Effect.runPromise(new ShippedCatalogs().verify()));
