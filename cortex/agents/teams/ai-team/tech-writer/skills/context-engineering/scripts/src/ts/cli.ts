import { Effect } from "effect";
import { SkillApplication } from "./application.ts";

export type CommandArguments = readonly string[];
export class SkillCli {
  constructor(private readonly arguments_: CommandArguments) {}
  run(): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const argument = this.arguments_.at(0);
      if (
        this.arguments_.length !== 1 ||
        typeof argument !== "string" ||
        !argument.startsWith("--request-yaml=")
      ) {
        process.stdout.write(
          'kind: failure\ncode: usage\nrecovery: "Pass one --request-yaml argument. Discover with version: 1 and tools: {list: {}}."\n',
        );
        process.exitCode = 2;
        return;
      }
      const execution = yield* new SkillApplication(
        argument.slice("--request-yaml=".length),
      ).execute();
      process.stdout.write(execution.yaml);
      process.exitCode = execution.exitCode;
    });
  }
}

if (import.meta.main)
  await Effect.runPromise(new SkillCli(process.argv.slice(2)).run());
