import { Effect } from "effect";
import { InputApplication, type InputSources } from "../ts/application.ts";
import { EventType, ProtocolVersion, type InputState } from "../ts/protocol.ts";
import type { WorkflowResult } from "../ts/workflow.ts";

// Test inputs deliberately retain the external JSON shapes to exercise decoding.
export type SubmittedScalar = string | number;
export type HostEvent =
  | {
      readonly type: EventType.Start | EventType.Cancel | EventType.Unavailable;
    }
  | {
      readonly type: EventType.Answer;
      readonly name: string;
      readonly value: SubmittedScalar;
    }
  | { readonly type: EventType.Skip; readonly name: string };
export interface HostRequest {
  readonly version: ProtocolVersion;
  readonly state: InputState;
  readonly event: HostEvent;
}
export interface HostAnswer {
  readonly name: string;
  readonly value: SubmittedScalar;
}

export class FormScenario {
  static readonly profile = `fields:
  - name: name
    question: What is your name?
    type: text
  - name: age
    question: What is your age?
    type: integer
  - name: environment
    question: Which environment?
    options: [Development, Staging, Production]
  - name: notes
    question: Any notes?
    type: text
    required: false
`;
  private state: InputState = { answers: {}, skipped: [] };
  constructor(private readonly schema: string) {}
  send(event: HostEvent): WorkflowResult {
    const request: HostRequest = {
      version: ProtocolVersion.V1,
      state: this.state,
      event,
    };
    const sources: InputSources = {
      schema: this.schema,
      request: JSON.stringify(request),
    };
    const result = Effect.runSync(new InputApplication(sources).run());
    this.state = result.state;
    return result;
  }
  answer(answer: HostAnswer): WorkflowResult {
    const event: HostEvent = { type: EventType.Answer, ...answer };
    return this.send(event);
  }
  start(): WorkflowResult {
    const event: HostEvent = { type: EventType.Start };
    return this.send(event);
  }
}
