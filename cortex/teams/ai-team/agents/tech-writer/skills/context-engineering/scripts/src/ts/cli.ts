import { Effect } from "effect";
import { globby, type Options } from "globby";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

type LintCommand = Bun.SpawnOptions.OptionsObject<
  "ignore",
  "inherit",
  "inherit"
> & { cmd: string[] };

type DocumentInputs = Parameters<typeof globby>[0];

class DocumentationCheck {
  private static readonly library = fileURLToPath(
    new URL("../../../../../../../../../", import.meta.url),
  );
  private static readonly scripts = fileURLToPath(
    new URL("../../", import.meta.url),
  );
  constructor(private readonly inputs: DocumentInputs) {}

  readonly run = Effect.fnUntraced(
    function* (this: DocumentationCheck) {
      const options: Options = {
        absolute: true,
        dot: true,
        expandDirectories: { extensions: ["md"] },
        ignore: ["**/node_modules/**", "**/.git/**", "**/target/**"],
      };
      const files = yield* Effect.tryPromise(() =>
        globby(this.inputs, options),
      );
      switch (files.length) {
        case 0:
          return yield* Effect.fail(
            new Error("No Markdown files matched the supplied paths."),
          );
        default:
          break;
      }
      const vale: LintCommand = {
        cmd: [
          "vale",
          `--config=${join(DocumentationCheck.library, ".vale.ini")}`,
          "--no-global",
          "--output=line",
          ...files,
        ],
        stdout: "inherit",
        stderr: "inherit",
        stdin: "ignore",
      };
      const remark: LintCommand = {
        cmd: [
          process.execPath,
          join(DocumentationCheck.library, "node_modules/remark-cli/cli.js"),
          "--rc-path",
          join(DocumentationCheck.scripts, "remark.config.json"),
          "--no-config",
          "--no-ignore",
          "--no-stdout",
          "--frail",
          "--quiet",
          ...files,
        ],
        stdout: "inherit",
        stderr: "inherit",
        stdin: "ignore",
      };
      const prose = yield* Effect.tryPromise(() => Bun.spawn(vale).exited);
      const markdown = yield* Effect.tryPromise(() => Bun.spawn(remark).exited);
      yield* Effect.sync(() => {
        process.exitCode = Math.max(prose, markdown);
      });
    },
    Effect.catch((error) =>
      Effect.sync(() => {
        console.error(error.message);
        process.exitCode = 2;
      }),
    ),
  );

  static fromArguments(): DocumentationCheck {
    const paths = process.argv.slice(2);
    switch (paths.length) {
      case 0:
        return new DocumentationCheck(["**/*.md"]);
      default:
        return new DocumentationCheck(paths);
    }
  }
}

await Effect.runPromise(DocumentationCheck.fromArguments().run());
