import { resolve } from "node:path";
import { Effect } from "effect";
import {
  API,
  DiagnosticCategory,
  type Diagnostic,
  type Project,
  type Snapshot,
} from "typescript/unstable/async";
import { CheckFailure } from "./command.ts";
import { SvelteTypeChecks } from "./svelte-types.ts";
import type { SvelteProjection } from "./projection.ts";

/** Owns the native compiler process and snapshots for one fresh lint run. */
export class NativeProject {
  check = Effect.fn("NativeProject.check")(function* (
    this: NativeProject,
    projections: ReadonlyMap<string, SvelteProjection>,
    files: readonly string[],
    mode: "lint" | "typecheck" = "lint",
  ) {
    const api = yield* Effect.acquireRelease(
      Effect.try(() => new API({ cwd: process.cwd() })),
      (resource) => this.closeApi(resource),
    );
    const config = resolve(".svelte-check/tsconfig.json");
    const snapshot = yield* Effect.acquireRelease(
      Effect.tryPromise(() => api.updateSnapshot({ openProjects: [config] })),
      (resource) => this.closeSnapshot(resource),
    );
    const project = snapshot.getProject(config);
    switch (project) {
      case undefined:
        return yield* new CheckFailure({
          message: `Native TypeScript did not open ${config}`,
        });
      default:
        switch (mode) {
          case "lint":
            return yield* this.checkProject(project, projections, files);
          case "typecheck":
            return yield* this.compilerDiagnostics(project, projections);
        }
    }
  });

  private closeApi(resource: API) {
    return Effect.promise(() => resource.close());
  }

  private closeSnapshot(resource: Snapshot) {
    return Effect.promise(() => resource.dispose());
  }

  private compilerDiagnostics = Effect.fn("NativeProject.compilerDiagnostics")(
    function* (
      this: NativeProject,
      project: Project,
      projections: ReadonlyMap<string, SvelteProjection>,
    ) {
      const groups = yield* Effect.all([
        Effect.tryPromise(() => project.program.getSyntacticDiagnostics()),
        Effect.tryPromise(() => project.program.getSemanticDiagnostics()),
        Effect.tryPromise(() => project.program.getProgramDiagnostics()),
        Effect.tryPromise(() => project.program.getGlobalDiagnostics()),
        Effect.tryPromise(() =>
          project.program.getConfigFileParsingDiagnostics(),
        ),
      ]);
      return [
        ...new Set(
          groups
            .flat()
            .filter(
              (diagnostic) =>
                diagnostic.category === DiagnosticCategory.Error ||
                diagnostic.category === DiagnosticCategory.Warning,
            )
            .map((diagnostic) =>
              this.formatDiagnostic(diagnostic, projections),
            ),
        ),
      ];
    },
  );

  private formatDiagnostic(
    diagnostic: Diagnostic,
    projections: ReadonlyMap<string, SvelteProjection>,
  ): string {
    const projection = projections.get(resolve(diagnostic.fileName ?? ""));
    switch (projection) {
      case undefined:
        return `${diagnostic.fileName ?? "tsconfig"}:${diagnostic.pos}: TS${diagnostic.code}: ${diagnostic.text}`;
      default: {
        const offset = Buffer.byteLength(
          projection.code.slice(0, diagnostic.pos),
        );
        const length = Buffer.byteLength(
          projection.code.slice(diagnostic.pos, diagnostic.end),
        );
        const origin = projection.originalSpan(offset, length);
        switch (origin) {
          case undefined:
            return `Unmapped compiler diagnostic in ${projection.filepath}: TS${diagnostic.code}: ${diagnostic.text}`;
          default:
            return `${projection.filepath}:${origin.start}: TS${diagnostic.code}: ${diagnostic.text}`;
        }
      }
    }
  }

  private checkProject = Effect.fn("NativeProject.checkProject")(function* (
    project: Project,
    projections: ReadonlyMap<string, SvelteProjection>,
    files: readonly string[],
  ) {
    for (const file of files) {
      const source = yield* Effect.tryPromise(() =>
        project.program.getSourceFile(resolve(file)),
      );
      switch (source) {
        case undefined:
          return yield* new CheckFailure({
            message: `Source file is outside the native TypeScript project: ${file}`,
          });
        default:
          break;
      }
    }
    const checks = new SvelteTypeChecks(project);
    const failures: string[] = [];
    for (const [projectedPath, projection] of projections) {
      const findings = yield* checks.check({
        source: projection.source,
        filepath: projection.filepath,
        projectedPath,
        generatedPosition: (position) => projection.generatedPosition(position),
        generatedScopePosition: (position: number) =>
          projection.generatedScopePosition(position),
      });
      for (const finding of findings)
        failures.push(
          `${projection.filepath}:${finding.start}: ${finding.rule}: ${finding.message}`,
        );
    }
    return failures;
  });
}
