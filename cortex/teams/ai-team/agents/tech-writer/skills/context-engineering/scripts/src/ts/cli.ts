import { Effect } from "effect";
import { SkillApplication } from "./application.ts";
import { FailurePresentation } from "./response.ts";
import { FailureCode, SkillFailure } from "./failure.ts";
import { ProtocolText } from "./protocol-text.ts";

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
        const execution = new FailurePresentation(
          SkillFailure.from(FailureCode.Usage),
        ).render();
        process.stdout.write(execution.yaml);
        process.exitCode = execution.exitCode;
        return;
      }
      const execution = yield* new SkillApplication(
        ProtocolText.yaml(argument.slice("--request-yaml=".length)),
      ).execute();
      process.stdout.write(execution.yaml);
      process.exitCode = execution.exitCode;
    });
  }
}

if (import.meta.main)
  await Effect.runPromise(new SkillCli(process.argv.slice(2)).run());
