import { Cause, Effect } from "effect";
import { InputApplication, type InputSources } from "./application.ts";
import {
  FailureCode,
  InputFailure,
  SourceKind,
  type FailureDetail,
  type FailureContext,
} from "./failure.ts";

export type CommandArguments = readonly string[];
export interface FailureOutput {
  readonly error: FailureCode;
  readonly message: string;
}
export class InputCli {
  constructor(private readonly arguments_: CommandArguments) {}
  run(): Effect.Effect<void> {
    return this.execute().pipe(
      Effect.catch((failure) =>
        Effect.sync(() => {
          const output: FailureOutput = {
            error: failure.code,
            message: failure.message,
          };
          process.stdout.write(JSON.stringify(output) + "\n");
          process.exitCode = 1;
        }),
      ),
    );
  }
  private execute(): Effect.Effect<void, InputFailure> {
    const owner = this;
    return Effect.gen(function* () {
      const argument = owner.arguments_.at(0);
      if (
        owner.arguments_.length !== 1 ||
        typeof argument !== "string" ||
        !argument.startsWith("--schema=") ||
        argument.length === "--schema=".length
      ) {
        const detail: FailureDetail = {
          code: FailureCode.Usage,
          message:
            "Use --schema=/absolute/path/form.yaml and pass a v1 request on stdin.",
        };
        return yield* Effect.fail(InputFailure.from(detail));
      }
      const schema = yield* Effect.tryPromise(() =>
        Bun.file(argument.slice("--schema=".length)).text(),
      ).pipe(Effect.mapError((error) => owner.readFailure(error)));
      const request = yield* Effect.tryPromise(() => Bun.stdin.text()).pipe(
        Effect.mapError((error) => owner.readFailure(error)),
      );
      const sources: InputSources = { schema, request };
      const result = yield* new InputApplication(sources).run();
      process.stdout.write(JSON.stringify(result) + "\n");
    });
  }
  private readFailure(error: Cause.UnknownError): InputFailure {
    const context: FailureContext = {
      code: FailureCode.Io,
      message: "Could not read schema or stdin.",
      source: { kind: SourceKind.Host, error },
    };
    return new InputFailure(context);
  }
}
if (import.meta.main)
  await Effect.runPromise(new InputCli(process.argv.slice(2)).run());
