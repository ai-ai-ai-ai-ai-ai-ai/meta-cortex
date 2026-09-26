import { Effect } from "effect";
import { globby, type Options } from "globby";
import { fileURLToPath } from "node:url";
import { basename, extname, join } from "node:path";

import { Navigation } from "./navigation.ts";

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
        expandDirectories: { extensions: ["md", "yaml"] },
        ignore: ["**/node_modules/**", "**/.git/**", "**/target/**"],
      };
      const matched = yield* Effect.tryPromise(() =>
        globby(this.inputs, options),
      );
      const files = matched.filter((path) => extname(path) === ".md");
      const catalogs = matched.filter(
        (path) => basename(path) === "index.yaml",
      );
      switch (files.length + catalogs.length) {
        case 0:
          return yield* Effect.fail(
            new Error(
              "No Markdown files or YAML indexes matched the supplied paths.",
            ),
          );
        default:
          break;
      }
      const audited = yield* new Navigation(catalogs).audit();
      const findings: string[] = [];
      for (const file of audited) {
        findings.push(
          ...file.messages.map(
            (message) =>
              `${file.path}: ${message.reason} [${message.source}:${message.ruleId}]`,
          ),
        );
      }
      for (const finding of findings) console.error(finding);
      switch (files.length) {
        case 0:
          process.exitCode = Math.min(findings.length, 1);
          return;
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
        process.exitCode = Math.max(
          prose,
          markdown,
          Math.min(findings.length, 1),
        );
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
        return new DocumentationCheck(["**/*.md", "**/index.yaml"]);
      default:
        return new DocumentationCheck(paths);
    }
  }
}

await Effect.runPromise(DocumentationCheck.fromArguments().run());
