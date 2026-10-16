import { Effect } from "effect";
import { globby, type Options } from "globby";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, type Options as FormatOptions } from "prettier";
import {
  CatalogInput,
  CatalogKind,
  type CatalogDeclaration,
} from "./catalog.ts";

export enum VocabularyKind {
  Rule = "Rule",
  PracticeOwner = "PracticeOwner",
}

interface VocabularyInput {
  readonly kind: VocabularyKind;
  readonly ids: readonly string[];
}

interface EnumSource {
  readonly namespace: string;
  readonly identifiers: readonly CatalogIdentifier[];
}

export interface GeneratedCatalogs {
  readonly rules: string;
  readonly owners: string;
}

class CatalogIdentifier {
  constructor(private readonly value: string) {}

  private pascal(value: string): string {
    return value.replace(/(?:^|_)[a-z0-9]/g, (part) =>
      part.replace("_", "").toUpperCase(),
    );
  }

  namespace(): string {
    return this.pascal(this.value.slice(0, this.value.indexOf(":")));
  }

  member(): string {
    return this.pascal(this.value.slice(this.value.indexOf(":") + 1));
  }

  declaration(): string {
    return `${this.member()} = ${JSON.stringify(this.value)},`;
  }
}

class VocabularySource {
  private static readonly formatting: FormatOptions = {
    parser: "typescript",
    printWidth: 78,
  };
  constructor(private readonly input: VocabularyInput) {}

  readonly render = Effect.fnUntraced(function* (this: VocabularySource) {
    const ids = [...new Set(this.input.ids)].sort();
    const identifiers = ids.map((id) => new CatalogIdentifier(id));
    const names = identifiers.map((id) => `${id.namespace()}.${id.member()}`);
    switch (names.length - new Set(names).size) {
      case 0:
        break;
      default:
        return yield* Effect.fail(
          new Error(`Colliding ${this.input.kind} enum names in catalog IDs.`),
        );
    }
    switch (ids.length) {
      case 0:
        return yield* Effect.fail(
          new Error(`No ${this.input.kind} declarations found.`),
        );
      default:
        break;
    }
    const namespaces = [...new Set(identifiers.map((id) => id.namespace()))];
    const enums = namespaces.map((namespace) => {
      const request: EnumSource = { namespace, identifiers };
      return this.renderEnum(request);
    });
    const types = namespaces.map(
      (namespace) => `${namespace}${this.input.kind}`,
    );
    const source = [
      "// Generated from practice index.yaml declarations by bun run catalog:generate. Do not edit.",
      ...enums,
      `export type ${this.typeName()} = ${types.join(" | ")};`,
      `export class ${this.input.kind}Vocabulary { static readonly values = [${types.map((name) => `...Object.values(${name})`).join(",")}]; }`,
    ].join("\n\n");
    return yield* Effect.tryPromise(() =>
      format(source, VocabularySource.formatting),
    );
  });

  private renderEnum(request: EnumSource): string {
    const members = request.identifiers.filter(
      (id) => id.namespace() === request.namespace,
    );
    const declarations = members.map((id) => id.declaration());
    return `export enum ${request.namespace}${this.input.kind} {\n${declarations.join("\n")}\n}`;
  }

  private typeName(): string {
    switch (this.input.kind) {
      case VocabularyKind.Rule:
        return "RuleName";
      case VocabularyKind.PracticeOwner:
        return "PracticeOwner";
    }
  }
}

export class CatalogVocabulary {
  constructor(private readonly declarations: readonly CatalogDeclaration[]) {}

  readonly render = Effect.fnUntraced(function* (this: CatalogVocabulary) {
    const practices = this.declarations.filter(
      (catalog) => catalog.kind === CatalogKind.Practice,
    );
    const rules: VocabularyInput = {
      kind: VocabularyKind.Rule,
      ids: practices.flatMap((catalog) => catalog.rules).map((rule) => rule.id),
    };
    const owners: VocabularyInput = {
      kind: VocabularyKind.PracticeOwner,
      ids: practices.map((catalog) => catalog.owner),
    };
    const generated: GeneratedCatalogs = {
      rules: yield* new VocabularySource(rules).render(),
      owners: yield* new VocabularySource(owners).render(),
    };
    return generated;
  });
}

export class CatalogGeneration {
  private static readonly library = fileURLToPath(
    new URL("../../../../../../../../../", import.meta.url),
  );
  private static readonly output = fileURLToPath(
    new URL("./", import.meta.url),
  );
  private readonly options: Options;

  constructor(private readonly library: string) {
    this.options = {
      cwd: library,
      absolute: true,
      ignore: ["**/node_modules/**"],
    };
  }

  static shipped(): CatalogGeneration {
    return new CatalogGeneration(CatalogGeneration.library);
  }

  readonly render = Effect.fnUntraced(function* (this: CatalogGeneration) {
    const paths = yield* Effect.tryPromise(() =>
      globby("teams/**/index.yaml", this.options),
    );
    const declarations = yield* Effect.forEach(paths.sort(), (path) =>
      this.read(path),
    );
    return yield* new CatalogVocabulary(declarations).render();
  });

  private readonly read = Effect.fnUntraced(function* (
    this: CatalogGeneration,
    path: string,
  ) {
    const text = yield* Effect.tryPromise(() => readFile(path, "utf8"));
    return yield* new CatalogInput(text)
      .declarations()
      .pipe(Effect.mapError((error) => new Error(`${path}: ${error.message}`)));
  });

  readonly write = Effect.fnUntraced(function* (this: CatalogGeneration) {
    const result = yield* this.render();
    yield* Effect.tryPromise(() =>
      writeFile(join(CatalogGeneration.output, "rule-name.ts"), result.rules),
    );
    yield* Effect.tryPromise(() =>
      writeFile(
        join(CatalogGeneration.output, "practice-owner.ts"),
        result.owners,
      ),
    );
  });
}
