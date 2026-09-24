import { Cause, Console, Effect } from "effect";
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
    const program = this.execute();
    return Effect.catch(program, (failure) => this.reportFailure(failure));
  }
  private reportFailure(failure: InputFailure): Effect.Effect<void> {
    return Effect.sync(() => {
      const output: FailureOutput = {
        error: failure.code,
        message: failure.message,
      };
      process.stdout.write(JSON.stringify(output) + "\n");
      process.exitCode = 1;
    });
  }
  private readonly execute = Effect.fnUntraced(function* (
    this: InputCli,
  ): Effect.fn.Return<void, InputFailure> {
    const argument = this.arguments_.at(0);
    if (
      this.arguments_.length !== 1 ||
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
    ).pipe(Effect.mapError((error) => this.readFailure(error)));
    const request = yield* Effect.tryPromise(() => Bun.stdin.text()).pipe(
      Effect.mapError((error) => this.readFailure(error)),
    );
    const sources: InputSources = { schema, request };
    const result = yield* new InputApplication(sources).run();
    yield* Console.log(JSON.stringify(result));
  });

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
