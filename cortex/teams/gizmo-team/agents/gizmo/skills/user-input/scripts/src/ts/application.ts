import { Effect } from "effect";
import { FormSchema, type Form } from "./schema.ts";
import { InputProtocol, type InputRequest } from "./protocol.ts";
import { YamlInput, type YamlDecodeRequest } from "./transport.ts";
import { InputWorkflow, type WorkflowResult } from "./workflow.ts";
import type { InputFailure } from "./failure.ts";

type FormDecodeRequest = YamlDecodeRequest<
  Form,
  typeof FormSchema.value.Encoded
>;
type InputDecodeRequest = YamlDecodeRequest<
  InputRequest,
  typeof InputProtocol.value.Encoded
>;

export interface InputSources {
  readonly schema: string;
  readonly request: string;
}
export class InputApplication {
  constructor(private readonly sources: InputSources) {}
  readonly run = Effect.fnUntraced(function* (
    this: InputApplication,
  ): Effect.fn.Return<WorkflowResult, InputFailure> {
    const formRequest: FormDecodeRequest = {
      source: this.sources.schema,
      schema: FormSchema.value,
    };
    const inputRequest: InputDecodeRequest = {
      source: this.sources.request,
      schema: InputProtocol.value,
    };
    const form = new YamlInput(formRequest).decode();
    const input = new YamlInput(inputRequest).decode();
    const inputs = { form, input };
    const decoded = Effect.all(inputs);

    const workflow = yield* decoded;
    return yield* new InputWorkflow(workflow).advance();
  });
}
