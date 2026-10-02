import { expect, test } from "bun:test";
import { Cause, Effect, Exit } from "effect";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import type { RmOptions } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify, type CreateNodeOptions } from "yaml";
import { ContextCheck } from "../ts/context-check.ts";
import type { ContextDocument } from "../ts/context-schema.ts";

class ContextCases {
  static readonly empty: ContextDocument = { stages: {} };
  static readonly composition: ContextDocument = {
    stages: {
      context: { $ref: "./case.context.yaml#/exports/stages/context~1name~0#" },
    },
    exports: {
      stages: {
        "context/name~#": {
          spec: {
            read: { $ref: "./case.context.yaml#/exports/statements/read" },
          },
          Required: {
            statements: {
              compile: {
                content: "Compile: exactly.\n",
                ShellCommand: { cwd: "project-root", script: "exit 99\n" },
              },
            },
          },
          Prohibited: { statements: {} },
        },
      },
      statements: { read: "Read: 'exactly'\n# inert ${value}" },
    },
  };
  static encode(document: ContextDocument): string {
    const options: CreateNodeOptions = { aliasDuplicateObjects: false };
    return stringify(document, options);
  }
  static readonly directory = Effect.acquireRelease(
    Effect.try(() => mkdtempSync(join(tmpdir(), "cortex-context-"))),
    (directory) =>
      Effect.sync(() => {
        const removal: RmOptions = { recursive: true };
        rmSync(directory, removal);
      }),
  );
  static readonly snapshot = Effect.gen(function* () {
    const directory = yield* ContextCases.directory;
    const path = join(directory, "case.context.yaml");
    yield* Effect.try(() =>
      writeFileSync(path, ContextCases.encode(ContextCases.composition)),
    );
    return yield* new ContextCheck(path).read();
  });
  static check(source: string) {
    const program = Effect.gen(function* () {
      const directory = yield* ContextCases.directory;
      const path = join(directory, "case.context.yaml");
      yield* Effect.try(() => writeFileSync(path, source));
      yield* new ContextCheck(path).run();
    });
    return Effect.runSyncExit(Effect.scoped(program));
  }
}
for (const document of [ContextCases.empty, ContextCases.composition]) {
  test("literal context and static named composition validate without running commands", () => {
    expect(
      Exit.isSuccess(ContextCases.check(ContextCases.encode(document))),
    ).toBe(true);
  });
}
for (const statement of [
  "",
  " ",
  42,
  true,
  null,
  [],
  { content: "Read." },
  { ShellCommand: { cwd: "library-root", script: "exit 99" } },
  { content: "Run.", ShellCommand: { cwd: "other", script: "exit 99" } },
  { content: "Run.", ShellCommand: { cwd: "library-root", script: " " } },
  {
    content: "Run.",
    ShellCommand: { cwd: "library-root", script: "exit 99", extra: "x" },
  },
  { stages: {} },
  { $ref: "./implementation.ts#/exports/statements/read" },
]) {
  test(`reject malformed statement ${JSON.stringify(statement)}`, () => {
    const invalid = {
      stages: {
        context: {
          spec: { read: statement },
          Required: { statements: {} },
          Prohibited: { statements: {} },
        },
      },
    };
    expect(Exit.isFailure(ContextCases.check(JSON.stringify(invalid)))).toBe(
      true,
    );
  });
}
for (const source of [
  "{}",
  "stages: []",
  "stages: {}\nextra: {}",
  "stages: {}\nstages: {}",
  "stages: {}\nexports: {jobs: {}}",
  "stages: &s {}\nexports: *s",
  "stages: !!map {}",
  "stages: {}\n---\nstages: {}",
  "stages: {context: {spec: {}, Required: {statements: {}}}}",
  "stages: {context: {spec: {}, Required: {statements: []}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {read: Read., read: Again.}, Required: {statements: {}}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {read: !custom Read.}, Required: {statements: {}}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {1: Read.}, Required: {statements: {}}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {' ': Read.}, Required: {statements: {}}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {}, Required: {statements: {}, label: Required}, Prohibited: {statements: {}}}}",
  "stages: {context: {spec: {}, Required: {statements: {}}, Prohibited: {statements: {}}, extra: {}}}",
]) {
  test(`reject malformed or nonliteral context ${source}`, () => {
    expect(Exit.isFailure(ContextCases.check(source))).toBe(true);
  });
}
for (const reference of [
  "https://example.com/common.yaml#/exports/stages/context",
  "/common.yaml#/exports/stages/context",
  "./case.context.yaml#/stages/context",
  "./case.context.yaml#/exports/jobs/context",
  "./case.context.yaml#/exports/stages/name~2",
  "./case.context.yaml#/exports/statements/read",
  "./case.context.yaml#/exports/stages/missing",
  "./missing.context.yaml#/exports/stages/context",
  "./case.context.yaml#/exports/stages/__proto__",
]) {
  test(`reject malformed missing wrong-kind or cyclic ref ${reference}`, () => {
    const document: ContextDocument = {
      stages: { context: { $ref: reference } },
      exports: {
        stages: {
          context: {
            spec: {},
            Required: { statements: {} },
            Prohibited: { statements: {} },
          },
        },
        statements: { read: "Read." },
      },
    };
    expect(
      Exit.isFailure(ContextCases.check(ContextCases.encode(document))),
    ).toBe(true);
  });
}
test("schema decoding retains field order, exact prose, and inert scripts", () => {
  const document = Effect.runSync(Effect.scoped(ContextCases.snapshot));
  expect(document).toEqual(ContextCases.composition);
  expect(Object.keys(document.stages)).toEqual(["context"]);
});
test("reject exported reference cycles", () => {
  const document: ContextDocument = {
    stages: {
      context: { $ref: "./case.context.yaml#/exports/stages/context" },
    },
    exports: {
      stages: {
        context: { $ref: "./case.context.yaml#/exports/stages/context" },
      },
      statements: {},
    },
  };
  const result = ContextCases.check(ContextCases.encode(document));
  expect(Exit.isFailure(result)).toBe(true);
  switch (result._tag) {
    case "Failure":
      expect(Cause.pretty(result.cause)).toContain("Cyclic context reference");
      break;
    case "Success":
      throw new Error("Expected cyclic reference rejection");
  }
});
