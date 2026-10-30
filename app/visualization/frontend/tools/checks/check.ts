import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { CheckCommand, CheckFailure } from "./command.ts";
import { SvelteProjection } from "./projection.ts";
import { ComponentCss } from "./css.ts";
import { AuthoredSvelteCheck } from "./authored-svelte.ts";

class NativeDiagnostic extends Schema.Class<NativeDiagnostic>(
  "NativeDiagnostic",
)({
  filename: Schema.String,
  code: Schema.optional(Schema.String),
  message: Schema.String,
  severity: Schema.String,
  labels: Schema.Array(
    Schema.Struct({
      span: Schema.Struct({ offset: Schema.Number, length: Schema.Number }),
    }),
  ),
}) {}
class NativeReport extends Schema.Class<NativeReport>("NativeReport")({
  diagnostics: Schema.Array(NativeDiagnostic),
  number_of_files: Schema.Number,
}) {}

class FrontendChecks {
  private readonly command = new CheckCommand();

  private files(pattern: string) {
    return globSync(pattern, {
      exclude: [
        "node_modules/**",
        "dist/**",
        ".svelte-check/**",
        "src/contracts.ts",
      ],
    });
  }

  private nativeLint = Effect.fn("FrontendChecks.nativeLint")(function* (
    this: FrontendChecks,
    files: readonly string[],
    config: string,
    tsconfig: string,
  ) {
    const result = yield* this.command.run([
      "run",
      "oxlint",
      "--type-aware",
      "--no-ignore",
      "--config",
      config,
      "--tsconfig",
      tsconfig,
      "--format",
      "json",
      ...files,
    ]);
    switch (result.status) {
      case 0:
      case 1:
        break;
      default:
        return yield* new CheckFailure({
          message: result.stderr + result.stdout,
        });
    }
    const report = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(NativeReport),
    )(result.stdout);
    switch (report.number_of_files === files.length) {
      case true:
        break;
      case false:
        return yield* new CheckFailure({
          message: `Native lint checked ${report.number_of_files} of ${files.length} requested files.`,
        });
    }
    switch (result.status === 1 && report.diagnostics.length === 0) {
      case true:
        return yield* new CheckFailure({
          message: `Native lint failed without diagnostics: ${result.stderr}`,
        });
      case false:
        return report;
    }
  });

  private projectedFinding(
    finding: NativeDiagnostic,
    projections: ReadonlyMap<string, SvelteProjection>,
  ): string[] {
    const projection = projections.get(resolve(finding.filename));
    switch (projection) {
      case undefined:
        return [
          `Unmapped native diagnostic file: ${finding.filename}: ${finding.message}`,
        ];
      default: {
        const origins = finding.labels.map((label) =>
          projection.classify(
            label.span.offset,
            label.span.length,
            finding.code ?? "parse",
          ),
        );
        const authored = origins.find((origin) => origin.kind === "authored");
        switch (authored?.kind) {
          case "authored":
            return this.authoredFinding(finding, projection, authored.span);
          case undefined:
            break;
        }
        switch (
          origins.length > 0 &&
          origins.every((origin) => origin.kind === "generated")
        ) {
          case true:
            return [];
          case false:
            return [
              `Unmapped native diagnostic: ${finding.filename}: ${finding.code ?? "parse"}: ${finding.message}`,
            ];
        }
      }
    }
  }

  private authoredFinding(
    finding: NativeDiagnostic,
    projection: SvelteProjection,
    span: { start: number; end: number },
  ): string[] {
    const authored = new AuthoredSvelteCheck({
      source: projection.source,
      filepath: projection.filepath,
      allowConditionals: false,
    });
    switch (finding.code) {
      case undefined:
        break;
      case "eslint(no-unused-expressions)":
        switch (authored.ownsExpressionStatement(span.start, span.end)) {
          case false:
            return [];
          case true:
            break;
        }
        break;
      case "typescript(no-unsafe-assignment)":
        switch (authored.isTypedPropsAssignment(span.start, span.end)) {
          case true:
            return [];
          case false:
            break;
        }
        break;
    }
    return [
      `${projection.filepath}:${span.start}: ${finding.code ?? "parse"}: ${finding.message}`,
    ];
  }

  run = Effect.fn("FrontendChecks.run")(function* (this: FrontendChecks) {
    const mode = process.argv[2] ?? "all";
    const emit = yield* this.command.run([
      "run",
      "rsvelte-check",
      "--emit-overlay",
      "--incremental",
      "--tsconfig",
      "tsconfig.json",
      "--fail-on-warnings",
    ]);
    yield* this.command.requireSuccess(emit);
    const components = yield* Effect.try(() => this.files("**/*.svelte"));
    const failures: string[] = [];
    const projections = new Map<string, SvelteProjection>();
    for (const file of components) {
      const source = yield* Effect.tryPromise(() => readFile(file, "utf8"));
      const css = yield* Effect.try(() =>
        new ComponentCss().check(source, file),
      );
      css.forEach((finding) =>
        failures.push(
          `${file}:${finding.start}: ${finding.rule}: ${finding.message}`,
        ),
      );
      switch (mode) {
        case "typecheck":
          break;
        default: {
          const authored = yield* Effect.try(() =>
            new AuthoredSvelteCheck({
              source,
              filepath: file,
              allowConditionals:
                file.replaceAll("\\", "/") ===
                "src/lib/components/ui/button/button.svelte",
            }).run(),
          );
          authored.forEach((finding) =>
            failures.push(
              `${file}:${finding.start}: ${finding.rule}: ${finding.message}`,
            ),
          );
          const projected = join(".svelte-check/svelte", `${file}.tsx`);
          const [code, map] = yield* Effect.all([
            Effect.tryPromise(() => readFile(projected, "utf8")),
            Effect.tryPromise(() => readFile(`${projected}.map`, "utf8")),
          ]);
          projections.set(
            resolve(projected),
            new SvelteProjection(source, file, { code, map }),
          );
        }
      }
    }
    switch (mode) {
      case "typecheck":
        break;
      default: {
        const files = yield* Effect.try(() =>
          this.files("**/*.{ts,js,mjs,cjs}"),
        );
        const authored = yield* this.nativeLint(
          files,
          "tools/checks/oxlint.json",
          "tsconfig.json",
        );
        authored.diagnostics.forEach((finding) =>
          failures.push(
            `${finding.filename}: ${finding.code ?? "parse"}: ${finding.message}`,
          ),
        );
        const projected = yield* this.nativeLint(
          [...projections.keys()],
          "tools/checks/oxlint-projected.json",
          ".svelte-check/tsconfig.json",
        );
        for (const finding of projected.diagnostics) {
          failures.push(...this.projectedFinding(finding, projections));
        }
        const svelte = yield* this.command.run([
          "run",
          "rsvelte-lint",
          "--config",
          "tools/checks/rsvelte-lint.json",
          "--max-warnings",
          "0",
          ...components,
        ]);
        switch (svelte.status) {
          case 0:
            break;
          default:
            failures.push(svelte.stdout + svelte.stderr);
        }
      }
    }
    switch (failures.length) {
      case 0:
        console.log(
          `Frontend ${mode}: native TypeScript 7 checks passed (${components.length} components).`,
        );
        break;
      default:
        return yield* new CheckFailure({ message: failures.join("\n") });
    }
  });
}

await Effect.runPromise(
  new FrontendChecks()
    .run()
    .pipe(Effect.scoped, Effect.provide(BunServices.layer)),
);
