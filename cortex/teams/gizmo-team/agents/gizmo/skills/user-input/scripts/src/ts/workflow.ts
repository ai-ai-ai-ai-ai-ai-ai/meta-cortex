import { Effect } from "effect";
import {
  AnswerKind,
  FieldAnswer,
  IssueCode,
  type AnswerCheck,
  type FieldIssue,
} from "./answer.ts";
import { FailureCode, InputFailure, type FailureDetail } from "./failure.ts";
import { CodexPrompt, type NativePrompt } from "./host.ts";
import {
  EventType,
  ProtocolVersion,
  Status,
  type InputRequest,
  type InputState,
} from "./protocol.ts";
import { Requirement, type Form } from "./schema.ts";

export interface WorkflowRequest {
  readonly form: Form;
  readonly input: InputRequest;
}
export type TerminalStatus =
  Status.Complete | Status.Cancelled | Status.Unavailable;
export type WorkflowResult =
  | {
      readonly version: ProtocolVersion.V1;
      readonly status: Status.Pending;
      readonly state: InputState;
      readonly issues: readonly FieldIssue[];
      readonly prompt: NativePrompt;
    }
  | {
      readonly version: ProtocolVersion.V1;
      readonly status: TerminalStatus;
      readonly state: InputState;
      readonly issues: readonly FieldIssue[];
    };

export class InputWorkflow {
  constructor(private readonly request: WorkflowRequest) {}
  advance(): Effect.Effect<WorkflowResult, InputFailure> {
    return Effect.gen(this, function* () {
      yield* this.validateState();
      const { input, form } = this.request;
      const { event } = input;
      const answers = { ...input.state.answers };
      const skipped = [...input.state.skipped];
      const issues: FieldIssue[] = [];
      const state: InputState = { answers, skipped };
      const base = { version: ProtocolVersion.V1, state, issues } as const;
      if (event.type === EventType.Cancel)
        return { ...base, status: Status.Cancelled };
      if (event.type === EventType.Unavailable)
        return { ...base, status: Status.Unavailable };
      if (event.type === EventType.Answer || event.type === EventType.Skip) {
        const field = form.fields.find((field) => field.name === event.name);
        if (!field) {
          const issue: FieldIssue = {
            name: event.name,
            code: IssueCode.Unknown,
          };
          issues.push(issue);
        } else if (
          Object.hasOwn(answers, field.name) ||
          skipped.includes(field.name)
        ) {
          const issue: FieldIssue = {
            name: field.name,
            code: IssueCode.AlreadyAnswered,
          };
          issues.push(issue);
        } else {
          const answer = new FieldAnswer(field);
          const checked: AnswerCheck =
            event.type === EventType.Skip
              ? answer.skip()
              : answer.convert(event.value);
          switch (checked.kind) {
            case AnswerKind.Accepted:
              answers[field.name] = checked.value;
              break;
            case AnswerKind.Skipped:
              skipped.push(field.name);
              break;
            case AnswerKind.Invalid:
              issues.push(checked.issue);
              break;
          }
        }
      }
      const next = form.fields.find(
        (field) =>
          !Object.hasOwn(answers, field.name) && !skipped.includes(field.name),
      );
      if (next)
        return {
          ...base,
          status: Status.Pending,
          prompt: new CodexPrompt(next).render(),
        };
      return { ...base, status: Status.Complete };
    });
  }

  private validateState(): Effect.Effect<void, InputFailure> {
    const { form, input } = this.request;
    const { answers, skipped } = input.state;
    const detail: FailureDetail = {
      code: FailureCode.State,
      message:
        "Prior state must contain only validated answers and optional skips for this schema.",
    };
    const failure = InputFailure.from(detail);
    if (new Set(skipped).size !== skipped.length) return Effect.fail(failure);
    for (const name of Object.keys(answers)) {
      const field = form.fields.find((field) => field.name === name);
      if (!field) return Effect.fail(failure);
      const value = answers[field.name];
      if (typeof value !== "string" && typeof value !== "number")
        return Effect.fail(failure);
      const checked = new FieldAnswer(field).convert(value);
      if (checked.kind !== AnswerKind.Accepted || checked.value !== value)
        return Effect.fail(failure);
    }
    for (const name of skipped) {
      const field = form.fields.find((field) => field.name === name);
      if (
        !field ||
        field.required !== Requirement.Optional ||
        Object.hasOwn(answers, name)
      )
        return Effect.fail(failure);
    }
    return Effect.void;
  }
}
