import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";

export class GuideSource {
  static base(): string {
    return Effect.runSync(
      Effect.try(() => {
        const cwd = fileURLToPath(new URL("../../../../", import.meta.url));
        const revision = execFileSync("git", ["rev-parse", "HEAD"], {
          cwd,
          encoding: "utf8",
        }).trim();
        return `https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/blob/${revision}/cortex/`;
      }),
    );
  }
}
