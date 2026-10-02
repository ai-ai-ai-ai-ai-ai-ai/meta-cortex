import { writeFile } from "node:fs/promises";
import { compileFromFile } from "json-schema-to-typescript";
import Ajv from "ajv/dist/2020";
import standaloneCode from "ajv/dist/standalone";
import schema from "../contracts.schema.json";
import { Effect } from "effect";

class ContractGeneration {
  run() {
    return Effect.gen({ self: this }, function* () {
      const source = yield* Effect.tryPromise(() =>
        compileFromFile("contracts.schema.json"),
      );
      yield* Effect.tryPromise(() => writeFile("src/contracts.ts", source));
      const validation = yield* Effect.try(() => this.validation());
      yield* Effect.tryPromise(() =>
        writeFile(
          "src/validators.cjs",
          "// Generated from the canonical Rust schema by AJV standalone.\n" +
            validation,
        ),
      );
    });
  }
  private validation(): string {
    const validator = new Ajv({
      strict: false,
      validateFormats: false,
      code: { source: true, esm: false },
    });
    validator.addSchema({
      $id: "dashboard-reply",
      $ref: "#/$defs/DesktopReply",
      $defs: schema.$defs,
    });
    validator.addSchema({
      $id: "dashboard-failure",
      $ref: "#/$defs/DesktopFailure",
      $defs: schema.$defs,
    });
    return standaloneCode(validator, {
      reply: "dashboard-reply",
      failure: "dashboard-failure",
    });
  }
}
await Effect.runPromise(new ContractGeneration().run());
