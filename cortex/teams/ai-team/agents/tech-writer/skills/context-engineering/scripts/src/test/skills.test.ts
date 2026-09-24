import { ProtocolVersion, SkillRequestSchema } from "../ts/request.ts";
import {
  SkillRequestDocument,
  type SkillRequestWire,
} from "../ts/request-document.ts";
import { describe, expect, test } from "bun:test";
import { Effect, Schema } from "effect";
import { parse } from "yaml";
import { YamlRequest } from "../ts/transport.ts";
import { SkillApplication } from "../ts/application.ts";
import { type SkillExecution } from "../ts/response.ts";
import { ProtocolText, type YamlText } from "../ts/protocol-text.ts";
import { ResponseKind } from "../ts/response.ts";
import { ArticleFindingCode, BlockKind } from "../ts/article.ts";
import { NavigationFindingCode } from "../ts/navigation.ts";
import { RepositoryNavigationFixture } from "./repository-navigation-fixture.ts";
import { FailureCode } from "../ts/failure.ts";

type FindingCode = ArticleFindingCode | NavigationFindingCode;
type FindingCodes = readonly FindingCode[];
type YamlExamples = readonly YamlText[];
type ArticleWire = typeof SkillRequestSchema.articles.Encoded;
type ArticleBlocksWire =
  ArticleWire["articles"]["audit"]["documents"][number]["blocks"];
type NavigationWire = typeof SkillRequestSchema.navigation.Encoded;
type NavigationEntriesWire =
  NavigationWire["navigation"]["audit"]["graphs"][number]["entries"];

interface InvalidYamlCase {
  readonly name: string;
  readonly yaml: YamlText;
  readonly expectedCode: FailureCode;
}

/** Raw wire data preserves syntax defects that serialization would erase. */
class InvalidYamlFixtures {
  static readonly cases: readonly InvalidYamlCase[] = [
    {
      name: "empty input",
      yaml: ProtocolText.yaml(""),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "unsupported version",
      yaml: ProtocolText.yaml("version: 99\ntools: {list: {}}"),
      expectedCode: FailureCode.Request,
    },
    {
      name: "unknown command field",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: {}, surprise: true}"),
      expectedCode: FailureCode.Request,
    },
    {
      name: "unknown discovery request field",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: {extra: secret}}"),
      expectedCode: FailureCode.Request,
    },
    {
      name: "empty discovery request sequence",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: []}"),
      expectedCode: FailureCode.Request,
    },
    {
      name: "nonempty discovery request sequence",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: [secret]}"),
      expectedCode: FailureCode.Request,
    },
    {
      name: "unknown envelope field",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: {}}\nextra: secret"),
      expectedCode: FailureCode.Request,
    },
    {
      name: "duplicate keys",
      yaml: ProtocolText.yaml("version: 1\nversion: 1\ntools: {list: {}}"),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "YAML anchor",
      yaml: ProtocolText.yaml("version: 1\ntools: &tools {list: {}}"),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "YAML alias",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: *tools}"),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "explicit tag",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: !!map {}}"),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "tag directive",
      yaml: ProtocolText.yaml(
        "%TAG !e! tag:example.com,2026:\n---\nversion: 1\ntools: {list: {}}",
      ),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "version directive",
      yaml: ProtocolText.yaml("%YAML 1.2\n---\nversion: 1\ntools: {list: {}}"),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "multiple documents",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: {}}\n---\nversion: 1"),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "merge key",
      yaml: ProtocolText.yaml("version: 1\ntools: {list: {<<: {}}}"),
      expectedCode: FailureCode.Yaml,
    },
    {
      name: "multiple commands",
      yaml: ProtocolText.yaml(
        "version: 1\ntools: {list: {}}\narticles: {audit: {documents: []}}",
      ),
      expectedCode: FailureCode.Request,
    },
    {
      name: "parent path",
      yaml: ProtocolText.yaml(
        "version: 1\narticles: {audit: {documents: [{path: ../escape.md, blocks: []}]}}",
      ),
      expectedCode: FailureCode.Request,
    },
  ];
}

class SkillProbe {
  private static readonly findingFields = {
    code: Schema.Union([
      Schema.Enum(ArticleFindingCode),
      Schema.Enum(NavigationFindingCode),
    ]),
    file: Schema.String,
  } satisfies Schema.Struct.Fields;
  private static readonly findingsFields = {
    kind: Schema.Literal(ResponseKind.Findings),
    findings: Schema.Array(Schema.Struct(SkillProbe.findingFields)),
  } satisfies Schema.Struct.Fields;
  private static readonly findings = Schema.Struct(SkillProbe.findingsFields);
  private static readonly commandFields = {
    name: Schema.String,
    exampleYaml: Schema.String.pipe(Schema.brand("YamlText")),
  } satisfies Schema.Struct.Fields;
  private static readonly catalogFields = {
    commands: Schema.Array(Schema.Struct(SkillProbe.commandFields)),
  } satisfies Schema.Struct.Fields;
  private static readonly catalogEnvelopeFields = {
    catalog: Schema.Struct(SkillProbe.catalogFields),
  } satisfies Schema.Struct.Fields;
  private static readonly catalog = Schema.Struct(
    SkillProbe.catalogEnvelopeFields,
  );
  private readonly yaml: YamlText;
  constructor(yaml: string) {
    this.yaml = ProtocolText.yaml(yaml);
  }
  static forRequest(request: SkillRequestWire): SkillProbe {
    return new SkillProbe(new SkillRequestDocument(request).encode());
  }
  execute(): SkillExecution {
    return Effect.runSync(new SkillApplication(this.yaml).execute());
  }
  codes(): FindingCodes {
    const output = this.execute();
    const response = Schema.decodeUnknownSync(SkillProbe.findings)(
      parse(output.yaml),
    );
    return response.findings.map((finding) => finding.code);
  }
  examples(): YamlExamples {
    const output = this.execute();
    const response = Schema.decodeUnknownSync(SkillProbe.catalog)(
      parse(output.yaml),
    );
    return response.catalog.commands.map((command) => command.exampleYaml);
  }
}

// Synthetic facts: these paths are identifiers, not files on disk.
class ArticleFixture {
  constructor(private readonly blocks: ArticleBlocksWire) {}
  request(): ArticleWire {
    return {
      version: ProtocolVersion.V1,
      articles: {
        audit: {
          documents: [{ path: "fixtures/article.md", blocks: this.blocks }],
        },
      },
    };
  }
}

class NavigationFixture {
  constructor(private readonly entries: NavigationEntriesWire) {}
  request(): NavigationWire {
    return {
      version: ProtocolVersion.V1,
      navigation: {
        audit: {
          documents: [
            {
              path: "fixtures/practice.md",
              owner: "fixtures/index.md",
              anchors: ["one", "two"],
            },
          ],
          graphs: [{ path: "fixtures/index.md", entries: this.entries }],
        },
      },
    };
  }
}

describe("discovery and YAML boundary", () => {
  test("every catalog example is directly invocable", () => {
    const request: SkillRequestWire = {
      version: ProtocolVersion.V1,
      tools: { list: {} },
    };
    const probe = SkillProbe.forRequest(request);
    expect(probe.examples()).toHaveLength(3);
    for (const example of probe.examples())
      expect(new SkillProbe(example).execute().exitCode).toBe(0);
  });
  test.each([...InvalidYamlFixtures.cases])("rejects $name", (fixture) => {
    const result = new SkillProbe(fixture.yaml).execute();
    expect(result.exitCode).toBe(2);
    expect(result.yaml).toContain("kind: failure");
    expect(result.yaml).toContain(`code: ${fixture.expectedCode}`);
    expect(result.yaml).not.toContain("secret");
  });
  test("rejects oversized input and deep YAML", () => {
    expect(new SkillProbe("x".repeat(65537)).execute().exitCode).toBe(2);
    expect(
      new SkillProbe("[".repeat(80) + "0" + "]".repeat(80)).execute().exitCode,
    ).toBe(2);
  });
});

describe("article audits adapted from Nook", () => {
  test("empty H2 and explicit procedure without ordered actions", () => {
    const blocks: ArticleBlocksWire = [
      {
        kind: BlockKind.Heading,
        depth: 2,
        line: 1,
        text: "Empty",
      },
      {
        kind: BlockKind.Transparent,
        line: 2,
      },
      {
        kind: BlockKind.Heading,
        depth: 2,
        line: 3,
        text: "Procedure",
      },
      {
        kind: BlockKind.Paragraph,
        line: 4,
      },
    ];
    const fixture = new ArticleFixture(blocks);
    expect(SkillProbe.forRequest(fixture.request()).codes()).toEqual([
      ArticleFindingCode.Empty,
      ArticleFindingCode.Procedure,
    ]);
  });
  test("transparent definitions preserve a prose run; structural relief resets it", () => {
    const blocks: ArticleBlocksWire = [
      {
        kind: BlockKind.Heading,
        depth: 2,
        line: 1,
        text: "Rationale",
      },
      {
        kind: BlockKind.Paragraph,
        line: 2,
      },
      {
        kind: BlockKind.Transparent,
        line: 3,
      },
      {
        kind: BlockKind.Paragraph,
        line: 4,
      },
      {
        kind: BlockKind.Paragraph,
        line: 5,
      },
      {
        kind: BlockKind.Paragraph,
        line: 6,
      },
      {
        kind: BlockKind.Separator,
        line: 7,
      },
      {
        kind: BlockKind.Paragraph,
        line: 8,
      },
    ];
    const fixture = new ArticleFixture(blocks);
    expect(SkillProbe.forRequest(fixture.request()).codes()).toEqual([
      ArticleFindingCode.Dense,
    ]);
  });
  test("H3 content makes its parent substantive; H4 resets density", () => {
    const blocks: ArticleBlocksWire = [
      {
        kind: BlockKind.Heading,
        depth: 2,
        line: 1,
        text: "Parent",
      },
      {
        kind: BlockKind.Heading,
        depth: 3,
        line: 2,
        text: "Steps",
      },
      {
        kind: BlockKind.OrderedList,
        line: 3,
      },
      {
        kind: BlockKind.Paragraph,
        line: 4,
      },
      {
        kind: BlockKind.Paragraph,
        line: 5,
      },
      {
        kind: BlockKind.Paragraph,
        line: 6,
      },
      {
        kind: BlockKind.Heading,
        depth: 4,
        line: 7,
        text: "Detail",
      },
      {
        kind: BlockKind.Paragraph,
        line: 8,
      },
    ];
    const fixture = new ArticleFixture(blocks);
    expect(SkillProbe.forRequest(fixture.request()).codes()).toEqual([]);
  });
  test("table is prohibited and does not make an empty article substantive", () => {
    const blocks: ArticleBlocksWire = [
      {
        kind: BlockKind.Heading,
        depth: 2,
        line: 1,
        text: "Table",
      },
      {
        kind: BlockKind.Table,
        line: 2,
      },
    ];
    const fixture = new ArticleFixture(blocks);
    const result = SkillProbe.forRequest(fixture.request());
    expect(result.codes()).toEqual([
      ArticleFindingCode.Empty,
      ArticleFindingCode.Table,
    ]);
    expect(result.execute().exitCode).toBe(1);
  });
  test("rejects unknown block fields and out-of-order source lines", () => {
    // Deliberately invalid wire records must reach the decoder unchanged.
    for (const source of [
      "version: 1\narticles: {audit: {documents: [{path: fixtures/article.md, blocks: [{kind: paragraph, line: 1, text: secret}]}]}}",
      "version: 1\narticles: {audit: {documents: [{path: fixtures/article.md, blocks: [{kind: paragraph, line: 4}, {kind: paragraph, line: 2}]}]}}",
    ])
      expect(new SkillProbe(source).execute().exitCode).toBe(2);
  });
});

describe("navigation without Nook topology", () => {
  test("allows separate rule anchors in the same document", () => {
    const entries: NavigationEntriesWire = [
      {
        rule: "practice:first",
        target: "fixtures/practice.md",
        anchor: "one",
        line: 1,
      },
      {
        rule: "practice:second",
        target: "fixtures/practice.md",
        anchor: "two",
        line: 2,
      },
    ];
    const fixture = new NavigationFixture(entries);
    expect(SkillProbe.forRequest(fixture.request()).codes()).toEqual([]);
  });
  test("detects missing entries, targets, anchors, and duplicate rule names", () => {
    expect(
      SkillProbe.forRequest(new NavigationFixture([]).request()).codes(),
    ).toEqual([NavigationFindingCode.MissingEntry]);
    const entries: NavigationEntriesWire = [
      {
        rule: "practice:missing",
        target: "fixtures/practice.md",
        anchor: "missing",
        line: 1,
      },
      {
        rule: "practice:first",
        target: "fixtures/practice.md",
        anchor: "one",
        line: 2,
      },
      {
        rule: "practice:first",
        target: "fixtures/practice.md",
        anchor: "one",
        line: 3,
      },
      {
        rule: "practice:absent",
        target: "fixtures/missing.md",
        anchor: "",
        line: 4,
      },
    ];
    const fixture = new NavigationFixture(entries);
    expect(SkillProbe.forRequest(fixture.request()).codes()).toEqual([
      NavigationFindingCode.MissingAnchor,
      NavigationFindingCode.DuplicateEntry,
      NavigationFindingCode.MissingTarget,
    ]);
  });
  test("reports unknown owner rather than inferring team ownership from paths", () => {
    const entries: NavigationEntriesWire = [
      {
        rule: "practice:first",
        target: "fixtures/practice.md",
        anchor: "one",
        line: 1,
      },
    ];
    const request = new NavigationFixture(entries).request();
    const changed: NavigationWire = {
      ...request,
      navigation: {
        audit: {
          ...request.navigation.audit,
          documents: request.navigation.audit.documents.map((document) => ({
            ...document,
            owner: "other/owner.md",
          })),
        },
      },
    };
    expect(SkillProbe.forRequest(changed).codes()).toEqual([
      NavigationFindingCode.MissingOwner,
      NavigationFindingCode.ForeignOwner,
    ]);
  });
  test("rejects ambiguous duplicate document inventories", () => {
    const yaml =
      "version: 1\nnavigation:\n  audit:\n    graphs: []\n    documents:\n      - {path: a.md, owner: g.md, anchors: []}\n      - {path: a.md, owner: g.md, anchors: []}";
    const result = new SkillProbe(yaml).execute();
    expect(result.exitCode).toBe(2);
    expect(result.yaml).toContain(FailureCode.Request);
  });
});

test("response capacity failures are explicit rather than truncated findings", () => {
  const capacity = { length: 100 } satisfies ArrayLike<never>;
  const blocks: ArticleBlocksWire = Array.from(capacity, () => ({
    kind: BlockKind.Table,
    line: 1,
  }));
  const request: ArticleWire = {
    version: ProtocolVersion.V1,
    articles: {
      audit: { documents: [{ path: "a".repeat(3800) + ".md", blocks }] },
    },
  };
  const result = SkillProbe.forRequest(request).execute();
  expect(result.exitCode).toBe(2);
  expect(result.yaml).toContain(FailureCode.Response);
  expect(result.yaml.length).toBeLessThan(1024);
});

test("YAML recovery example is itself a usable discovery request", () => {
  const result = new SkillProbe("bad request").execute();
  const recoveryFields = {
    recovery: Schema.String,
  } satisfies Schema.Struct.Fields;
  const recoverySchema = Schema.Struct(recoveryFields);
  const response = Schema.decodeUnknownSync(recoverySchema)(parse(result.yaml));
  expect(new SkillProbe(response.recovery).execute().exitCode).toBe(0);
});

test("real TypeScript rules can share their owning section", () => {
  const request = Effect.runSync(
    new RepositoryNavigationFixture(import.meta.url).request(),
  );
  expect(SkillProbe.forRequest(request).codes()).toEqual([]);
});

test("a renamed anchor in real graph facts is reported", () => {
  const request = Effect.runSync(
    new RepositoryNavigationFixture(import.meta.url).request(),
  );
  const broken: NavigationWire = {
    ...request,
    navigation: {
      audit: {
        ...request.navigation.audit,
        graphs: request.navigation.audit.graphs.map((graph) => ({
          ...graph,
          entries: graph.entries.map((entry) => {
            if (entry.rule === "function_ownership:instances") {
              return { ...entry, anchor: "missing-section" };
            }
            return entry;
          }),
        })),
      },
    },
  };
  expect(SkillProbe.forRequest(broken).codes()).toEqual([
    NavigationFindingCode.MissingAnchor,
  ]);
});

test("duplicate rule names are rejected even when their anchors differ", () => {
  const entries: NavigationEntriesWire = [
    {
      rule: "practice:first",
      target: "fixtures/practice.md",
      anchor: "one",
      line: 1,
    },
    {
      rule: "practice:first",
      target: "fixtures/practice.md",
      anchor: "two",
      line: 2,
    },
  ];
  const fixture = new NavigationFixture(entries);
  expect(SkillProbe.forRequest(fixture.request()).codes()).toEqual([
    NavigationFindingCode.DuplicateEntry,
  ]);
});

test("navigation entries require a nonempty rule name", () => {
  for (const source of [
    "version: 1\nnavigation: {audit: {documents: [], graphs: [{path: fixtures/index.md, entries: [{target: fixtures/practice.md, anchor: one, line: 1}]}]}}",
    "version: 1\nnavigation: {audit: {documents: [], graphs: [{path: fixtures/index.md, entries: [{rule: '', target: fixtures/practice.md, anchor: one, line: 1}]}]}}",
  ])
    expect(new SkillProbe(source).execute().exitCode).toBe(2);
});

test("duplicate graph inventories are rejected", () => {
  const yaml = `version: 1
navigation:
  audit:
    documents: []
    graphs:
      - {path: fixtures/index.md, entries: []}
      - {path: fixtures/index.md, entries: []}`;
  expect(new SkillProbe(yaml).execute().exitCode).toBe(2);
});

test("typed request serialization preserves YAML-like text as data", () => {
  const request: ArticleWire = {
    version: ProtocolVersion.V1,
    articles: {
      audit: {
        documents: [
          {
            path: 'fixtures/quote "and": colon.md',
            blocks: [
              {
                kind: BlockKind.Heading,
                depth: 2,
                line: 1,
                text: 'Heading: "quoted"\n---\nversion: 99\n# still text — ✓',
              },
              { kind: BlockKind.Paragraph, line: 2 },
            ],
          },
        ],
      },
    },
  };
  const source = new SkillRequestDocument(request).encode();
  const decoded = Effect.runSync(new YamlRequest(source).decode());
  const roundTrip = Schema.encodeSync(SkillRequestSchema.value)(decoded);
  expect(roundTrip).toEqual(request);
  expect(new SkillProbe(source).execute().exitCode).toBe(0);
});
