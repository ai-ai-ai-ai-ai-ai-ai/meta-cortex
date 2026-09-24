import { Effect } from "effect";
import { SkillApplication } from "./application.ts";
import { FailurePresentation, type SkillExecution } from "./response.ts";
import { FailureCode, SkillFailure } from "./failure.ts";
import { ProtocolText } from "./protocol-text.ts";

export type CommandArguments = readonly string[];
export class SkillCli {
  constructor(private readonly arguments_: CommandArguments) {}
  readonly run = Effect.fnUntraced(function* (
    this: SkillCli,
  ): Effect.fn.Return<void> {
    const argument = this.arguments_.at(0);
    if (
      this.arguments_.length !== 1 ||
      typeof argument !== "string" ||
      !argument.startsWith("--request-yaml=")
    ) {
      const execution = new FailurePresentation(
        SkillFailure.from(FailureCode.Usage),
      ).render();
      return yield* this.report(execution);
    }
    const execution = yield* new SkillApplication(
      ProtocolText.yaml(argument.slice("--request-yaml=".length)),
    ).execute();
    yield* this.report(execution);
  });

  private report(execution: SkillExecution): Effect.Effect<void> {
    return Effect.sync(() => {
      process.stdout.write(execution.yaml);
      process.exitCode = execution.exitCode;
    });
  }
}

if (import.meta.main)
  await Effect.runPromise(new SkillCli(process.argv.slice(2)).run());
