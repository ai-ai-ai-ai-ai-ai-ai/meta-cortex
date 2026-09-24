import { Effect } from "effect";
import { FormSchema } from "./schema.ts";
import { InputProtocol } from "./protocol.ts";
import { YamlInput, type YamlDecodeRequest } from "./transport.ts";
import { InputWorkflow, type WorkflowResult } from "./workflow.ts";
import type { InputFailure } from "./failure.ts";

export interface InputSources {
  readonly schema: string;
  readonly request: string;
}
export class InputApplication {
  constructor(private readonly sources: InputSources) {}
  readonly run = Effect.fnUntraced(function* (
    this: InputApplication,
  ): Effect.fn.Return<WorkflowResult, InputFailure> {
    const formRequest: YamlDecodeRequest<
      typeof FormSchema.value.Type,
      typeof FormSchema.value.Encoded
    > = { source: this.sources.schema, schema: FormSchema.value };
    const inputRequest: YamlDecodeRequest<
      typeof InputProtocol.value.Type,
      typeof InputProtocol.value.Encoded
    > = { source: this.sources.request, schema: InputProtocol.value };
    const form = new YamlInput(formRequest).decode();
    const input = new YamlInput(inputRequest).decode();
    const inputs = { form, input };
    const decoded = Effect.all(inputs);

    const workflow = yield* decoded;
    return yield* new InputWorkflow(workflow).advance();
  });
}
