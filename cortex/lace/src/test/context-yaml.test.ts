import { expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { stringify, type CreateNodeOptions } from "yaml";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContextInput } from "../ts/context-input.ts";
import {
  ContextLoader,
  type ContextLoadRequest,
} from "../ts/context-loader.ts";
import type { ContextDocument } from "../ts/context-schema.ts";
import { WorkingDirectory, type Stage } from "../ts/lace.ts";

class ContextCases {
  static readonly stage: Stage = {
    spec: {},
    Required: { statements: {} },
    Prohibited: { statements: {} },
  };
  static readonly empty: ContextDocument = { stages: {} };
  static readonly literal: ContextDocument = {
    stages: {
      orderedFirst: {
        spec: { read: "Quotes: 'yes'\n# YAML-like prose ${inert}" },
        Required: {
          statements: {
            compile: {
              content: "Compile.",
              ShellCommand: {
                cwd: WorkingDirectory.LibraryRoot,
                script: "exit 99\n",
              },
            },
          },
        },
        Prohibited: { statements: { skip: "Do not skip." } },
      },
      orderedSecond: ContextCases.stage,
    },
  };
  static encode(document: ContextDocument): string {
    const options: CreateNodeOptions = {
      aliasDuplicateObjects: false,
    };
    return stringify(document, options);
  }
  static decode(source: string) {
    return Effect.runSync(new ContextInput(source).decode());
  }
  static rejection(source: string): void {
    expect(
      Exit.isFailure(Effect.runSyncExit(new ContextInput(source).decode())),
    ).toBe(true);
  }
}

for (const document of [ContextCases.empty, ContextCases.literal]) {
  test("literal YAML roundtrip retains complete fixed context and prose", () => {
    expect(ContextCases.decode(ContextCases.encode(document))).toEqual(
      document,
    );
  });
}
for (const name of [
  "stages",
  "spec",
  "Required",
  "Prohibited",
  "statements",
  "content",
  "ShellCommand",
  "cwd",
  "script",
  "Statement",
  "Stage",
  "Job",
  "WorkingDirectory",
  "receipt",
  "quoted/name~value",
  "1",
]) {
  test(`explicit quoted schema-named map key works: ${name}`, () => {
    const document: ContextDocument = {
      stages: {
        [name]: {
          spec: { [name]: "Read." },
          Required: { statements: { [name]: "Read." } },
          Prohibited: { statements: { [name]: "Do not skip." } },
        },
      },
    };
    expect(ContextCases.decode(ContextCases.encode(document))).toEqual(
      document,
    );
  });
}
// Deliberately malformed decoder inputs retain raw syntax to preserve each defect.
for (const statement of [
  "",
  " ",
  42,
  true,
  null,
  [],
  { content: "Read." },
  { ShellCommand: { cwd: "library-root", script: "exit 99" } },
  { content: " ", ShellCommand: { cwd: "library-root", script: "exit 99" } },
  { content: "Run.", ShellCommand: { cwd: "other", script: "exit 99" } },
  { content: "Run.", ShellCommand: { cwd: "library-root", script: " " } },
  {
    content: "Run.",
    ShellCommand: { cwd: "library-root", script: "exit 99", extra: "x" },
  },
  { UnsupportedText: { content: "Read." } },
  { UnsupportedGroup: { statements: {} } },
  { Statement: { prompt: "Read." } },
  { stages: {} },
  { $ref: "x", extra: "x" },
]) {
  test(`reject malformed Statement: ${JSON.stringify(statement)}`, () => {
    const malformed = {
      stages: {
        context: {
          spec: { context: statement },
          Required: { statements: {} },
          Prohibited: { statements: {} },
        },
      },
    };
    ContextCases.rejection(JSON.stringify(malformed));
  });
}
for (const stage of [
  {},
  { stages: {} },
  { spec: {} },
  { spec: [], Required: { statements: {} }, Prohibited: { statements: {} } },
  { spec: {}, Required: { items: {} }, Prohibited: { statements: {} } },
  { spec: {}, Required: { statements: [] }, Prohibited: { statements: {} } },
  {
    spec: {},
    Required: { statements: {}, label: "Required" },
    Prohibited: { statements: {} },
  },
  {
    spec: {},
    Required: { statements: {} },
    Prohibited: { statements: {} },
    extra: {},
  },
  {
    spec: { "": "Read." },
    Required: { statements: {} },
    Prohibited: { statements: {} },
  },
]) {
  test(`reject malformed Stage: ${JSON.stringify(stage)}`, () => {
    const malformed = { stages: { context: stage } };
    ContextCases.rejection(JSON.stringify(malformed));
  });
}
for (const source of [
  "{}",
  "stages: []",
  "stages: {}\nJob: {}",
  "stages: {}\nexports: {jobs: {}}",
  "stages: {}\nstages: {}",
  "stages:\n  ' ': {}",
  "stages:\n  1: {}",
  "stages: &stages {}\nexports: *stages",
  "stages: !!map {}",
  "stages: {}\n---\nstages: {}",
  "stages: {context: {spec: {read: Read., read: Again.}, Required: {statements: {}}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {<<: {read: Read.}}, Required: {statements: {}}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {read: !custom Read.}, Required: {statements: {}}, Prohibited: {statements: {}}}}",
  "import {Job} from '@meta-cortex/lace';",
]) {
  test(`reject unsupported declaration syntax: ${source}`, () =>
    ContextCases.rejection(source));
}

class ReferenceCases {
  static run(document: ContextDocument) {
    const directory = mkdtempSync(join(tmpdir(), "lace-context-"));
    const path = join(directory, "case.lace.yaml");
    writeFileSync(path, ContextCases.encode(document));
    const request: ContextLoadRequest = { path, ancestry: [] };
    const result = Effect.runSyncExit(new ContextLoader(request).load());
    const removal: Parameters<typeof rmSync>[1] = { recursive: true };
    rmSync(directory, removal);
    return result;
  }
}
for (const reference of [
  "https://example.com/a.lace.yaml#/exports/stages/context",
  "/absolute.lace.yaml#/exports/stages/context",
  "./implementation.ts#/exports/stages/context",
  "./case.lace.yaml#/stages/context",
  "./case.lace.yaml#/exports/jobs/context",
  "./case.lace.yaml#/exports/stages/context/extra",
  "./case.lace.yaml#/exports/stages/bad~2",
  "./case.lace.yaml#/exports/statements/read",
  "./missing.lace.yaml#/exports/stages/context",
  "./case.lace.yaml#/exports/stages/missing",
  "./case.lace.yaml#/exports/stages/cycle",
]) {
  test(`reject malformed unresolved wrong-kind or cyclic reference: ${reference}`, () => {
    const document: ContextDocument = {
      stages: { context: { $ref: reference } },
      exports: {
        stages: { cycle: { $ref: "./case.lace.yaml#/exports/stages/cycle" } },
        statements: { read: "Read." },
      },
    };
    expect(Exit.isFailure(ReferenceCases.run(document))).toBe(true);
  });
}
test("relative named Stage/Statement composition and JSON pointer escaping remain inert", () => {
  const document: ContextDocument = {
    stages: {
      first: { $ref: "./case.lace.yaml#/exports/stages/context~1name~0" },
      second: ContextCases.stage,
    },
    exports: {
      stages: {
        "context/name~": {
          spec: {
            read: { $ref: "./case.lace.yaml#/exports/statements/read~1name~0" },
          },
          Required: { statements: {} },
          Prohibited: { statements: {} },
        },
      },
      statements: {
        "read/name~": {
          content: "Run.",
          ShellCommand: {
            cwd: WorkingDirectory.ProjectRoot,
            script: "exit 99",
          },
        },
      },
    },
  };
  const result = ReferenceCases.run(document);
  expect(Exit.isSuccess(result)).toBe(true);
  switch (result._tag) {
    case "Success":
      expect(Object.keys(result.value.stages)).toEqual(["first", "second"]);
      break;
    case "Failure":
      throw new Error("Expected successful reference resolution");
  }
});

test("cross-file Stage and Statement imports preserve inert data and map order", () => {
  const directory = mkdtempSync(join(tmpdir(), "lace-import-"));
  const provider: ContextDocument = {
    stages: {},
    exports: {
      stages: {
        context: {
          spec: {
            read: { $ref: "./common.lace.yaml#/exports/statements/read" },
          },
          Required: { statements: {} },
          Prohibited: { statements: {} },
        },
      },
      statements: { read: "Read exactly.\n" },
    },
  };
  const consumer: ContextDocument = {
    stages: {
      before: ContextCases.stage,
      imported: { $ref: "./common.lace.yaml#/exports/stages/context" },
      after: ContextCases.stage,
    },
  };
  writeFileSync(
    join(directory, "common.lace.yaml"),
    ContextCases.encode(provider),
  );
  writeFileSync(join(directory, "AGENTS.yaml"), ContextCases.encode(consumer));
  const request: ContextLoadRequest = {
    path: join(directory, "AGENTS.yaml"),
    ancestry: [],
  };
  const receipt = Effect.runSync(new ContextLoader(request).load());
  expect(Object.keys(receipt.stages)).toEqual(["before", "imported", "after"]);
  expect(receipt.stages.imported?.spec.read).toBe("Read exactly.\n");
  const removal: Parameters<typeof rmSync>[1] = { recursive: true };
  rmSync(directory, removal);
});
for (const document of [
  { stages: { " ": ContextCases.stage } },
  {
    stages: {
      context: {
        spec: { " ": "Read." },
        Required: { statements: {} },
        Prohibited: { statements: {} },
      },
    },
  },
  {
    stages: {
      context: {
        spec: {},
        Required: { statements: { " ": "Read." } },
        Prohibited: { statements: {} },
      },
    },
  },
  {
    stages: {
      context: {
        spec: {},
        Required: { statements: {} },
        Prohibited: { statements: { " ": "Do not skip." } },
      },
    },
  },
]) {
  test("blank names are rejected at every named map boundary", () =>
    ContextCases.rejection(ContextCases.encode(document)));
}
test("arbitrary prototype-like export names resolve as own literal declarations", () => {
  const document: ContextDocument = {
    stages: { context: { $ref: "./case.lace.yaml#/exports/stages/__proto__" } },
    exports: {
      stages: {
        ["__proto__"]: {
          spec: { ["__proto__"]: "Read." },
          Required: { statements: {} },
          Prohibited: { statements: {} },
        },
      },
      statements: {},
    },
  };
  const result = ReferenceCases.run(document);
  expect(Exit.isSuccess(result)).toBe(true);
  switch (result._tag) {
    case "Success": {
      const stage = result.value.stages.context;
      switch (stage) {
        case undefined:
          throw new Error("Missing context");
        default:
          expect(Object.keys(stage.spec)).toEqual(["__proto__"]);
      }
      break;
    }
    case "Failure":
      throw new Error("Expected own exported Stage");
  }
});
