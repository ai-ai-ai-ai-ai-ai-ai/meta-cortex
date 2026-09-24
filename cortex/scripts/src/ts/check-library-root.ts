import type { BunFile } from "bun";
import { Effect, Match } from "effect";

class LibraryRootCheck {
  constructor(private readonly configuration: BunFile) {}

  run(): Effect.Effect<void> {
    return Effect.tryPromise(() => this.configuration.exists()).pipe(
      Effect.flatMap((exists) =>
        Match.value(exists).pipe(
          Match.when(true, () =>
            Effect.sync(() => {
              process.stdout.write(
                "Found meta-cortex.toml in the current directory.\n",
              );
            }),
          ),
          Match.when(false, () =>
            Effect.sync(() => {
              process.stderr.write(
                "Missing meta-cortex.toml in the current directory.\n",
              );
              process.exitCode = 1;
            }),
          ),
          Match.exhaustive,
        ),
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          process.stderr.write(
            `Could not check meta-cortex.toml: ${error.message}\n`,
          );
          process.exitCode = 1;
        }),
      ),
    );
  }
}

await Effect.runPromise(
  new LibraryRootCheck(Bun.file("meta-cortex.toml")).run(),
);
