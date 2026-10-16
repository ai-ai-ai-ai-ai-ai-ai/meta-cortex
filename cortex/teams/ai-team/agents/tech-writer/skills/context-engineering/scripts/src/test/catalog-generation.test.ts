import { expect, test } from "bun:test";
import { Effect } from "effect";
import { readFile } from "node:fs/promises";
import { stringify } from "yaml";
import {
  CatalogInput,
  CatalogKind,
  type CatalogDeclaration,
} from "../ts/catalog.ts";
import {
  CatalogGeneration,
  CatalogVocabulary,
} from "../ts/catalog-generation.ts";

class CatalogScenario {
  static readonly practice = {
    kind: CatalogKind.Practice,
    owner: "example:new_owner",
    title: "New guidance",
    source_title: "New guidance",
    source: "guidance.md",
    owns: ["New decisions"],
    excludes: [],
    relationships: [],
    related: [],
    rules: [
      {
        id: "new_subject:new_decision",
        source: "guidance.md#decision",
        summary: "Choose a new decision.",
      },
    ],
  } satisfies CatalogDeclaration;
  static readonly comparison: CatalogDeclaration = {
    kind: CatalogKind.Check,
    title: "Comparison",
    overview: ["Compare the boundary."],
    prohibited: ["Do not invent identities."],
    required: ["Use declarations."],
    compare: [
      { id: "comparison_only:not_declared", source: "other.md#decision" },
    ],
  };
  private static readonly compilerOptions: Bun.TranspilerOptions = {
    loader: "ts",
  };
  readonly compiler = new Bun.Transpiler(CatalogScenario.compilerOptions);

  readonly declared = Effect.fnUntraced(function* (this: CatalogScenario) {
    return yield* new CatalogInput(
      stringify(CatalogScenario.practice),
    ).declarations();
  });
  readonly freshness = Effect.fnUntraced(function* (this: CatalogScenario) {
    const generated = yield* CatalogGeneration.shipped().render();
    const rules = yield* Effect.tryPromise(() =>
      readFile(new URL("../ts/rule-name.ts", import.meta.url), "utf8"),
    );
    const owners = yield* Effect.tryPromise(() =>
      readFile(new URL("../ts/practice-owner.ts", import.meta.url), "utf8"),
    );
    expect(rules).toBe(generated.rules);
    expect(owners).toBe(generated.owners);
  });
}

test("new catalog namespaces generate compilable enums and aggregate registration without manual TypeScript edits", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const scenario = new CatalogScenario();
      const declaration = yield* scenario.declared();
      const result = yield* new CatalogVocabulary([declaration]).render();
      expect(scenario.compiler.scan(result.rules).exports).toEqual([
        "NewSubjectRule",
        "RuleVocabulary",
      ]);
      expect(scenario.compiler.scan(result.owners).exports).toEqual([
        "ExamplePracticeOwner",
        "PracticeOwnerVocabulary",
      ]);
      expect(result.rules).toContain(
        'NewDecision = "new_subject:new_decision"',
      );
      expect(result.rules).toContain("...Object.values(NewSubjectRule)");
      expect(result.owners).toContain('NewOwner = "example:new_owner"');
    }),
  ));

test("generation is deterministic, deduplicates shared declarations, and never registers comparison-only IDs", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const declaration = yield* new CatalogScenario().declared();
      const expected = yield* new CatalogVocabulary([declaration]).render();
      const result = yield* new CatalogVocabulary([
        CatalogScenario.comparison,
        declaration,
        declaration,
      ]).render();
      expect(result).toEqual(expected);
      expect(result.rules).not.toContain("comparison_only");
    }),
  ));

test("declarations reject malformed IDs and unknown fields before generation", async () => {
  const malformed: CatalogDeclaration = {
    ...CatalogScenario.practice,
    owner: "not an identifier",
  };
  const decoding = new CatalogInput(stringify(malformed)).declarations();
  await expect(Effect.runPromise(decoding)).rejects.toThrow();
  const invalid = stringify(CatalogScenario.practice) + "unexpected: value\n";
  await expect(
    Effect.runPromise(new CatalogInput(invalid).declarations()),
  ).rejects.toThrow();
});

test("generation rejects colliding TypeScript member names", async () => {
  const collision: CatalogDeclaration = {
    ...CatalogScenario.practice,
    kind: CatalogKind.Practice,
    owner: "example:new_owner",
    title: "Collision",
    source_title: "Collision",
    source: "guidance.md",
    owns: ["Naming"],
    excludes: [],
    relationships: [],
    related: [],
    rules: [
      { id: "example:rule1", source: "guidance.md#first", summary: "First." },
      {
        id: "example:rule_1",
        source: "guidance.md#second",
        summary: "Second.",
      },
    ],
  };
  await expect(
    Effect.runPromise(new CatalogVocabulary([collision]).render()),
  ).rejects.toThrow("Colliding Rule enum names");
});

test("checked-in vocabulary exactly matches catalog generation; run bun run catalog:generate to refresh", () =>
  Effect.runPromise(new CatalogScenario().freshness()));
