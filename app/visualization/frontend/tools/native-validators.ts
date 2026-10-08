import Ajv, { type AnySchemaObject, type Options } from "ajv/dist/2020";
import standaloneCode from "ajv/dist/standalone";
import { Effect } from "effect";
import type { Plugin } from "vite";
import schema from "../contracts.schema.json";

type ValidatorExports = NonNullable<Parameters<typeof standaloneCode>[1]>;

/** Vite owns module loading in development, production builds, and Vitest. */
export class NativeValidators implements Plugin {
  readonly name = "dashboard-native-validators";
  private readonly module = "virtual:dashboard-validators";
  private readonly resolvedModule = "\0virtual:dashboard-validators";

  // Vite binds hook `this` to its PluginContext; arrows retain this generator.
  resolveId = (source: string) => {
    switch (source) {
      case this.module:
        return this.resolvedModule;
      default:
        return null;
    }
  };

  load = (id: string) => {
    switch (id) {
      case this.resolvedModule:
        return Effect.runSync(Effect.try(() => this.validation()));
      default:
        return null;
    }
  };

  private validation(): string {
    const options: Options = {
      strict: false,
      validateFormats: false,
      code: { source: true, esm: true, lines: true },
    };
    const validator = new Ajv(options);
    const replySchema: AnySchemaObject = {
      $id: "dashboard-reply",
      $ref: "#/$defs/DesktopReply",
      $defs: schema.$defs,
    };
    const failureSchema: AnySchemaObject = {
      $id: "dashboard-failure",
      $ref: "#/$defs/DesktopFailure",
      $defs: schema.$defs,
    };
    const workflowSchema: AnySchemaObject = {
      $id: "dashboard-workflow",
      $ref: "#/$defs/FeatureWorkflow",
      $defs: schema.$defs,
    };
    const catalogSchema: AnySchemaObject = {
      $id: "dashboard-catalog",
      $ref: "#/$defs/DesktopCatalogReply",
      $defs: schema.$defs,
    };
    validator.addSchema(catalogSchema);
    validator.addSchema(workflowSchema);
    validator.addSchema(replySchema);
    validator.addSchema(failureSchema);
    const exports: ValidatorExports = {
      catalog: "dashboard-catalog",
      workflow: "dashboard-workflow",
      reply: "dashboard-reply",
      failure: "dashboard-failure",
    };
    return standaloneCode(validator, exports);
  }
}
