import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { Effect, type Cause } from "effect";

/** A verified slice of the shipped graph, not a general Markdown parser. */
export class RepositoryNavigationFixture {
  constructor(private readonly moduleUrl: string) {}

  request(): Effect.Effect<string, Cause.UnknownException> {
    return Effect.try(() => {
      const skill = new URL(
        "../../../../../../../../dev-team/agents/typescript-dev/skills/ts-dev-skill/",
        this.moduleUrl,
      );
      const practicePath = "practices/typescript-function-ownership.md";
      const graph = readFileSync(new URL("index.md", skill), "utf8");
      const practice = readFileSync(new URL(practicePath, skill), "utf8");
      const anchor = "use-instances-for-owned-behavior";
      expect(practice.split("\n")).toContain(
        "## Use instances for owned behavior",
      );
      const prefix = "teams/dev-team/agents/typescript-dev/skills/ts-dev-skill";
      const target = `${prefix}/${practicePath}`;
      const owner = `${prefix}/index.md`;
      const rules = [
        "function_ownership:instances",
        "function_ownership:meaningful_state",
      ];
      const entries = rules.map((rule) => {
        const declaration = `- **[${rule}](${practicePath}#${anchor})**`;
        const line = graph.split("\n").indexOf(declaration) + 1;
        expect(line).toBeGreaterThan(0);
        return `          - {rule: '${rule}', target: ${target}, anchor: ${anchor}, line: ${line}}`;
      });
      return `version: 1
navigation:
  audit:
    documents:
      - path: ${target}
        owner: ${owner}
        anchors: [${anchor}]
    graphs:
      - path: ${owner}
        entries:
${entries.join("\n")}
`;
    });
  }
}
