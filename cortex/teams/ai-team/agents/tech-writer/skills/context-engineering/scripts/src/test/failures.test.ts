import { expect, test } from "bun:test";
import { Effect, Either, ParseResult } from "effect";
import { YamlRequest } from "../ts/transport.ts";
import { FailureCode, FailureSourceKind } from "../ts/failure.ts";
import { SkillApplication } from "../ts/application.ts";
import { ProtocolText } from "../ts/protocol-text.ts";

test("schema failures retain their concrete parse error until presentation", () => {
  const source = ProtocolText.yaml("version: 99\ntools: {list: {}}");
  const decoded = Effect.runSync(
    Effect.either(new YamlRequest(source).decode()),
  );
  expect(Either.isLeft(decoded)).toBe(true);
  if (Either.isLeft(decoded)) {
    expect(decoded.left.code).toBe(FailureCode.Request);
    expect(decoded.left.source.kind).toBe(FailureSourceKind.Schema);
    if (decoded.left.source.kind === FailureSourceKind.Schema) {
      expect(ParseResult.isParseError(decoded.left.source.error)).toBe(true);
    }
  }
});

test("YAML diagnostics are preserved internally and excluded from responses", () => {
  const source = ProtocolText.yaml(
    "version: 1\nversion: private-fixture-value\ntools: {list: {}}",
  );
  const decoded = Effect.runSync(
    Effect.either(new YamlRequest(source).decode()),
  );
  expect(Either.isLeft(decoded)).toBe(true);
  if (Either.isLeft(decoded)) {
    expect(decoded.left.code).toBe(FailureCode.Yaml);
    expect(decoded.left.source.kind).toBe(FailureSourceKind.Yaml);
    if (decoded.left.source.kind === FailureSourceKind.Yaml) {
      expect(decoded.left.source.diagnostics.length).toBeGreaterThan(0);
    }
  }
  const response = Effect.runSync(new SkillApplication(source).execute());
  expect(response.yaml).not.toContain("private-fixture-value");
  expect(response.yaml).not.toContain("diagnostics");
});

test("a policy rejection does not fabricate a parser failure", () => {
  const source = ProtocolText.yaml("x".repeat(YamlRequest.maximumBytes + 1));
  const decoded = Effect.runSync(
    Effect.either(new YamlRequest(source).decode()),
  );
  expect(Either.isLeft(decoded)).toBe(true);
  if (Either.isLeft(decoded)) {
    expect(decoded.left.code).toBe(FailureCode.Request);
    expect(decoded.left.source.kind).toBe(FailureSourceKind.Policy);
  }
});
