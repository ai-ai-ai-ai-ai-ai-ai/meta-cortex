import type { BunFile } from "bun";
import type { Cause } from "effect";
import { Console, Effect, Match } from "effect";

enum ConfigurationPresence {
  Present = "present",
  Missing = "missing",
}

class LibraryRootCheck {
  constructor(private readonly configuration: BunFile) {}

  run(): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const presence = yield* this.inspectConfiguration();
      yield* Match.value(presence).pipe(
        Match.when(ConfigurationPresence.Present, () =>
          Console.log("Found meta-cortex.toml in the current directory."),
        ),
        Match.when(ConfigurationPresence.Missing, () =>
          this.reportFailure(
            "Missing meta-cortex.toml in the current directory.",
          ),
        ),
        Match.exhaustive,
      );
    }).pipe(
      Effect.catchAll((error) =>
        this.reportFailure(
          `Could not check meta-cortex.toml: ${error.message}`,
        ),
      ),
    );
  }

  private inspectConfiguration(): Effect.Effect<
    ConfigurationPresence,
    Cause.UnknownException
  > {
    return Effect.tryPromise(async () =>
      Match.value(await this.configuration.exists()).pipe(
        Match.when(true, () => ConfigurationPresence.Present),
        Match.when(false, () => ConfigurationPresence.Missing),
        Match.exhaustive,
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
