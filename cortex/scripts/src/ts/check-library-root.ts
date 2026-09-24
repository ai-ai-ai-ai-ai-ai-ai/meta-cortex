import type { BunFile } from "bun";
import type { Cause } from "effect";
import { Console, Effect } from "effect";

enum ConfigurationPresence {
  Present = "present",
  Missing = "missing",
}

class LibraryRootCheck {
  constructor(private readonly configuration: BunFile) {}

  run(): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const presence = yield* this.inspectConfiguration();
      switch (presence) {
        case ConfigurationPresence.Present:
          return yield* Console.log(
            "Found meta-cortex.toml in the current directory.",
          );
        case ConfigurationPresence.Missing:
          return yield* this.reportFailure(
            "Missing meta-cortex.toml in the current directory.",
          );
      }
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
    return Effect.tryPromise(async () => {
      switch (await this.configuration.exists()) {
        case true:
          return ConfigurationPresence.Present;
        case false:
          return ConfigurationPresence.Missing;
      }
    });
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
