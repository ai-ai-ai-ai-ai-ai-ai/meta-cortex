import { Schema } from "effect";
import { FormSchema } from "./schema.ts";

export enum ProtocolVersion {
  V1 = 1,
}
export enum EventType {
  Start = "start",
  Answer = "answer",
  Skip = "skip",
  Cancel = "cancel",
  Unavailable = "unavailable",
}
export enum Status {
  Pending = "pending",
  Complete = "complete",
  Cancelled = "cancelled",
  Unavailable = "unavailable",
}

export class InputProtocol {
  static readonly submittedNumber = Schema.Number.pipe(
    Schema.brand("SubmittedNumber"),
  );
  static readonly answers = Schema.Record(
    FormSchema.name,
    Schema.Union([FormSchema.text, FormSchema.integer]),
  );
  private static readonly stateFields = {
    answers: InputProtocol.answers,
    skipped: Schema.Array(FormSchema.name),
  } satisfies Schema.Struct.Fields;
  static readonly state = Schema.Struct(InputProtocol.stateFields);
  private static readonly startFields = {
    type: Schema.Literal(EventType.Start),
  } satisfies Schema.Struct.Fields;
  private static readonly answerFields = {
    type: Schema.Literal(EventType.Answer),
    name: FormSchema.name,
    value: Schema.Union([FormSchema.text, InputProtocol.submittedNumber]),
  } satisfies Schema.Struct.Fields;
  private static readonly skipFields = {
    type: Schema.Literal(EventType.Skip),
    name: FormSchema.name,
  } satisfies Schema.Struct.Fields;
  private static readonly cancelFields = {
    type: Schema.Literal(EventType.Cancel),
  } satisfies Schema.Struct.Fields;
  private static readonly unavailableFields = {
    type: Schema.Literal(EventType.Unavailable),
  } satisfies Schema.Struct.Fields;
  static readonly event = Schema.Union([
    Schema.Struct(InputProtocol.startFields),
    Schema.Struct(InputProtocol.answerFields),
    Schema.Struct(InputProtocol.skipFields),
    Schema.Struct(InputProtocol.cancelFields),
    Schema.Struct(InputProtocol.unavailableFields),
  ]);
  private static readonly requestFields = {
    version: Schema.Literal(ProtocolVersion.V1),
    state: InputProtocol.state,
    event: InputProtocol.event,
  } satisfies Schema.Struct.Fields;
  static readonly value = Schema.Struct(InputProtocol.requestFields);
}
export type Answers = typeof InputProtocol.answers.Type;
export type InputState = typeof InputProtocol.state.Type;
export type InputEvent = typeof InputProtocol.event.Type;
export type InputRequest = typeof InputProtocol.value.Type;
export type SubmittedNumber = typeof InputProtocol.submittedNumber.Type;
