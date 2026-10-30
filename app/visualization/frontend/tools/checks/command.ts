import { Effect, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export class CheckFailure extends Schema.TaggedError<CheckFailure>()(
  "CheckFailure",
  {
    message: Schema.String,
  },
) {}

export class CheckCommand {
  run = Effect.fn("CheckCommand.run")(function* (
    this: CheckCommand,
    args: readonly string[],
  ) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(this.runtime(), args),
    );
    const [stdout, stderr, status] = yield* Effect.all(
      [
        handle.stdout.pipe(
          Stream.decodeText(),
          Stream.runFold(
            () => "",
            (text, chunk) => text + chunk,
          ),
        ),
        handle.stderr.pipe(
          Stream.decodeText(),
          Stream.runFold(
            () => "",
            (text, chunk) => text + chunk,
          ),
        ),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    );
    return { stdout, stderr, status: Number(status) };
  });

  private runtime(): string {
    switch (process.versions.bun) {
      case undefined:
        return "bun";
      default:
        return process.execPath;
    }
  }

  requireSuccess = Effect.fn("CheckCommand.requireSuccess")(function* (result: {
    stdout: string;
    stderr: string;
    status: number;
  }) {
    switch (result.status) {
      case 0:
        return result.stdout;
      default:
        return yield* new CheckFailure({
          message: result.stdout + result.stderr,
        });
    }
  });
}
