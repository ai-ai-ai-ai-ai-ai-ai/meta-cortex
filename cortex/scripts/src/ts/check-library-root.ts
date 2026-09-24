import type { BunFile } from "bun";
import { Effect } from "effect";

class LibraryRootCheck {
  constructor(private readonly configuration: BunFile) {}

  run(): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      if (!(yield* Effect.tryPromise(() => this.configuration.exists()))) {
        process.stderr.write(
          "Missing meta-cortex.toml in the current directory.\n",
        );
        process.exitCode = 1;
        return;
      }
      process.stdout.write(
        "Found meta-cortex.toml in the current directory.\n",
      );
    }).pipe(
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
