import { readFileSync } from "node:fs";
import {
  type ExecFileSyncOptionsWithStringEncoding,
  execFileSync,
} from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Effect, Match, Schema } from "effect";
import type {
  Plugin,
  ViteDevServer,
  HmrContext,
  FullReloadPayload,
} from "vite";
import {
  GuideTeamId,
  GuideReporting,
  type GuidePayload,
} from "../src/guide-content";

enum SourceChange {
  Bundled = "Bundled",
  Other = "Other",
}
interface TeamSource {
  readonly team: GuideTeamId;
  readonly directory: string;
}
interface CatalogReview {
  readonly team: TeamSource;
  readonly entry: CatalogEntry;
}
interface CatalogEntry {
  readonly path: string;
  readonly detail: string;
}
class GuideSourceFields {
  static readonly FAILURE: {
    readonly cause: ReturnType<typeof Schema.Defect>;
  } = { cause: Schema.Defect() };
  static readonly ENTRY: {
    readonly path: typeof Schema.String;
    readonly detail: typeof Schema.String;
  } = { path: Schema.String, detail: Schema.String };
  static readonly HANDOFF: { readonly text: typeof Schema.String } = {
    text: Schema.String,
  };
  static readonly REFERENCE: { readonly path: typeof Schema.String } = {
    path: Schema.String,
  };
}
interface GuideSourceAttempt {
  readonly try: () => string;
  readonly catch: (cause: unknown) => GuideBuildFailure;
}
class GuideBuildFailure extends Schema.TaggedError<GuideBuildFailure>()(
  "GuideBuildFailure",
  GuideSourceFields.FAILURE,
) {}

/** Reads current framework documents; the serialized module becomes a bundled asset. */
export class GuideSource implements Plugin {
  readonly name = "canonical-agent-guide";
  private readonly module = "virtual:agent-guide";
  private readonly resolvedModule = "\0virtual:agent-guide";
  private readonly root = fileURLToPath(
    new URL("../../../../cortex/", import.meta.url),
  );
  private readonly teams: ReadonlyArray<TeamSource> = [
    { team: GuideTeamId.Gizmo, directory: "gizmo-team" },
    { team: GuideTeamId.Development, directory: "dev-team" },
    { team: GuideTeamId.Ai, directory: "ai-team" },
    { team: GuideTeamId.Security, directory: "security-team" },
    { team: GuideTeamId.Sre, directory: "sre-team" },
    { team: GuideTeamId.Delivery, directory: "delivery-team" },
  ];
  private readonly protocols = [
    "teams/AGENTS.md",
    "teams/gizmo-team/docs/coordination-state-machine.md",
    "teams/gizmo-team/docs/agent-verification.md",
  ];
  private inputs = new Set<string>();

  // Vite normally binds hook `this` to PluginContext; these arrows retain the source owner.
  resolveId = (source: string) => {
    switch (source) {
      case this.module:
        return this.resolvedModule;
      default:
        return null;
    }
  };
  load = (id: string) => {
    switch (id) {
      case this.resolvedModule:
        return Effect.runSync(this.generate());
      default:
        return null;
    }
  };
  configureServer = (server: ViteDevServer): void => {
    Effect.runSync(this.generate());
    server.watcher.add(resolve(this.root, "teams"));
  };
  handleHotUpdate = (context: HmrContext) => {
    switch (this.change(context.file)) {
      case SourceChange.Bundled: {
        Match.value(
          context.server.moduleGraph.getModuleById(this.resolvedModule),
        ).pipe(
          Match.when(Match.defined, (module) =>
            context.server.moduleGraph.invalidateModule(module),
          ),
          Match.orElse(() => {}),
        );
        const reload: FullReloadPayload = { type: "full-reload" as const };
        context.server.ws.send(reload);
        return [];
      }
      case SourceChange.Other:
        return context.modules;
    }
  };
  private change(path: string): SourceChange {
    switch (this.inputs.has(path)) {
      case true:
        return SourceChange.Bundled;
      case false:
        return SourceChange.Other;
    }
  }
  private generate() {
    const attempt: GuideSourceAttempt = {
      try: () => {
        const payload = this.payload();
        return `import { Schema } from "effect";\nimport { GuideContent } from ${JSON.stringify(resolve(this.root, "../app/visualization/frontend/src/guide-content.ts"))};\nexport const guide = Schema.decodeUnknownSync(GuideContent.SCHEMA)(${JSON.stringify(payload)});`;
      },
      catch: (cause: unknown) => {
        const input: ConstructorParameters<typeof GuideBuildFailure>[0] = {
          cause,
        };
        return new GuideBuildFailure(input);
      },
    };
    return Effect.try(attempt);
  }
  private read(path: string): string {
    const absolute = resolve(this.root, path);
    this.inputs.add(absolute);
    return readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
  }
  private entries(source: string): ReadonlyArray<CatalogEntry> {
    const entrySchema = Schema.Struct(GuideSourceFields.ENTRY);
    return [
      ...source.matchAll(
        /^- \*\*\[[^\]]+\]\((?<path>agents\/[^)]+\/AGENTS\.md)\)\*\*\n(?<detail>[\s\S]*?)(?=^- \*\*|^## |$(?![\s\S]))/gm,
      ),
    ].map((match) => Schema.decodeUnknownSync(entrySchema)(match.groups));
  }
  private reporting(path: string): GuideReporting {
    switch (path) {
      case "teams/gizmo-team/agents/gizmo-prime/AGENTS.md":
        return GuideReporting.Host;
      case "teams/gizmo-team/agents/gizmo/AGENTS.md":
        return GuideReporting.Prime;
      default:
        return GuideReporting.Team;
    }
  }
  private payload(): GuidePayload {
    const communication = this.read("teams/AGENTS.md");
    const handoff = Schema.decodeUnknownSync(
      Schema.Struct(GuideSourceFields.HANDOFF),
    )(
      communication.match(/(?<text>In multi-agent mode,[\s\S]*?)(?=\n\n)/)
        ?.groups,
    ).text.replace(/\n/g, " ");
    const payload: GuidePayload = {
      sourceBase: this.sourceBase(),
      agents: [],
      reviews: [],
      documents: [],
    };
    const agents: Array<GuidePayload["agents"][number]> = [];
    const reviews: Array<GuidePayload["reviews"][number]> = [];
    const documents: Array<GuidePayload["documents"][number]> = [];
    for (const team of this.teams) {
      const catalog = this.read(`teams/${team.directory}/AGENTS.md`);
      for (const entry of this.entries(catalog)) {
        const path = `teams/${team.directory}/${entry.path}`;
        const markdown = this.read(path);
        const label = Schema.decodeUnknownSync(Schema.String)(
          markdown.split("\n").at(0),
        ).replace(/^# /, "");
        const summary = entry.detail.replace(/^ {2}- /gm, "").trim();
        const responsibility = summary
          .split("\n")
          .filter((line) => !line.startsWith("Verifier:"))
          .join("\n");
        const agent: GuidePayload["agents"][number] = {
          team: team.team,
          path,
          label,
          reports_to: this.reporting(path),
          responsibility,
          handoff,
        };
        agents.push(agent);
        const document: GuidePayload["documents"][number] = { path, markdown };
        documents.push(document);
        const reviewRequest: CatalogReview = { team, entry };
        reviews.push(...this.reviews(reviewRequest));
      }
    }
    for (const path of this.protocols) {
      const document: GuidePayload["documents"][number] = {
        path,
        markdown: this.read(path),
      };
      documents.push(document);
    }
    return { ...payload, agents, reviews, documents };
  }
  private reviews(
    request: CatalogReview,
  ): Array<GuidePayload["reviews"][number]> {
    return [
      ...request.entry.detail.matchAll(
        /Verifier: \[[^\]]+\]\((?<path>agents\/[^)]+\/AGENTS\.md)\)/g,
      ),
    ].map((match) => {
      const reference = Schema.decodeUnknownSync(
        Schema.Struct(GuideSourceFields.REFERENCE),
      )(match.groups);
      return {
        author: `teams/${request.team.directory}/${request.entry.path}`,
        reviewer: `teams/${request.team.directory}/${reference.path}`,
      };
    });
  }
  private sourceBase(): string {
    const options: ExecFileSyncOptionsWithStringEncoding = {
      cwd: this.root,
      encoding: "utf8",
    };
    const revision = execFileSync("git", ["rev-parse", "HEAD"], options).trim();
    return `https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/blob/${revision}/cortex/`;
  }
}
