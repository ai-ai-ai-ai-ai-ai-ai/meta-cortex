import type { BunFile } from "bun";
import { Console, Effect, Match } from "effect";

class LibraryRootCheck {
  constructor(private readonly configuration: BunFile) {}

  run(): Effect.Effect<void> {
    const report = Match.type<boolean>().pipe(
      Match.when(true, () =>
        Console.log("Found meta-cortex.toml in the current directory."),
      ),
      Match.when(false, () =>
        this.reportFailure(
          "Missing meta-cortex.toml in the current directory.",
        ),
      ),
      Match.exhaustive,
    );

    return Effect.tryPromise(() => this.configuration.exists()).pipe(
      Effect.flatMap(report),
      Effect.catchAll((error) =>
        this.reportFailure(
          `Could not check meta-cortex.toml: ${error.message}`,
        ),
      ),
    );
  }

  private reportFailure(message: string): Effect.Effect<void> {
    return Effect.sync(() => {
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
  }
}

await Effect.runPromise(
  new LibraryRootCheck(Bun.file("meta-cortex.toml")).run(),
);
