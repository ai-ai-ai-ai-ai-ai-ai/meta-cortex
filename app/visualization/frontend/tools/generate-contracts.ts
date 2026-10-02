import { writeFile } from "node:fs/promises";
import { compileFromFile } from "json-schema-to-typescript";
import { Effect } from "effect";

class ContractGeneration {
  run() {
    return Effect.gen({ self: this }, function* () {
      const source = yield* Effect.tryPromise(() =>
        compileFromFile("contracts.schema.json"),
      );
      yield* Effect.tryPromise(() => writeFile("src/contracts.ts", source));
    });
  }
}
await Effect.runPromise(new ContractGeneration().run());
