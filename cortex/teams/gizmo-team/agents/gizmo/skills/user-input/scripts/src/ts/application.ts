import { Effect } from "effect";
import { FormSchema } from "./schema.ts";
import { InputProtocol } from "./protocol.ts";
import { YamlInput, type YamlDecodeRequest } from "./transport.ts";
import {
  InputWorkflow,
  type WorkflowRequest,
  type WorkflowResult,
} from "./workflow.ts";
import type { InputFailure } from "./failure.ts";

export interface InputSources {
  readonly schema: string;
  readonly request: string;
}
export class InputApplication {
  constructor(private readonly sources: InputSources) {}
  run(): Effect.Effect<WorkflowResult, InputFailure> {
    const owner = this;
    return Effect.gen(function* () {
      const formRequest: YamlDecodeRequest<
        typeof FormSchema.value.Type,
        typeof FormSchema.value.Encoded
      > = { source: owner.sources.schema, schema: FormSchema.value };
      const inputRequest: YamlDecodeRequest<
        typeof InputProtocol.value.Type,
        typeof InputProtocol.value.Encoded
      > = { source: owner.sources.request, schema: InputProtocol.value };
      const form = yield* new YamlInput(formRequest).decode();
      const input = yield* new YamlInput(inputRequest).decode();
      const workflow: WorkflowRequest = { form, input };
      return yield* new InputWorkflow(workflow).advance();
    });
  }
}
