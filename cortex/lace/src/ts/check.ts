import { Glob } from "bun";
import { resolve } from "node:path";
import { Effect } from "effect";
import { ContextLoader, type ContextLoadRequest } from "./context-loader.ts";

/** Library command discovers declarations, then validates each without executing content. */
class ContextCheck {
  readonly run = Effect.fnUntraced(function* (this: ContextCheck) {
    const paths = process.argv.slice(2);
    switch (paths.length) {
      case 0:
        const scan: Parameters<Glob["scanSync"]>[0] = {
          cwd: process.cwd(),
          absolute: true,
          onlyFiles: true,
        };
        paths.push(...new Glob("**/{AGENTS,*.lace}.yaml").scanSync(scan));
        break;
      default:
        break;
    }
    for (const path of paths) {
      const request: ContextLoadRequest = { path: resolve(path), ancestry: [] };
      yield* new ContextLoader(request).load();
    }
    console.log(`Validated ${paths.length} YAML context declarations.`);
  });
}
Effect.runPromise(new ContextCheck().run()).catch((failure: Error) => {
  console.error(failure.message);
  process.exitCode = 1;
});
