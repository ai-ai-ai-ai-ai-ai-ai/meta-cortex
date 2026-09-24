import { Schema } from "effect";
import type { SubmittedNumber } from "./protocol.ts";
import {
  FieldType,
  FormSchema,
  Requirement,
  type AnswerValue,
  type Field,
  type FieldName,
} from "./schema.ts";

export enum IssueCode {
  Required = "required",
  Integer = "integer",
  Choice = "choice",
  Text = "text",
  Unknown = "unknown_field",
  AlreadyAnswered = "already_answered",
}
export interface FieldIssue {
  readonly name: FieldName;
  readonly code: IssueCode;
}
export enum AnswerKind {
  Accepted = "accepted",
  Skipped = "skipped",
  Invalid = "invalid",
}
export type AnswerCheck =
  | { readonly kind: AnswerKind.Accepted; readonly value: AnswerValue }
  | { readonly kind: AnswerKind.Skipped }
  | { readonly kind: AnswerKind.Invalid; readonly issue: FieldIssue };
export type SubmittedValue = AnswerValue | SubmittedNumber;

export class FieldAnswer {
  constructor(private readonly field: Field) {}
  convert(value: SubmittedValue): AnswerCheck {
    if (typeof value === "string" && value.trim().length === 0) {
      return this.skip();
    }
    switch (this.field.type) {
      case FieldType.Text:
        if (typeof value === "string") {
          return { kind: AnswerKind.Accepted, value };
        }
        return this.invalid(IssueCode.Text);
      case FieldType.Choice:
        if (typeof value === "string" && this.field.options.includes(value)) {
          return { kind: AnswerKind.Accepted, value };
        }
        return this.invalid(IssueCode.Choice);
      case FieldType.Integer: {
        if (typeof value === "string" && !/^[+-]?\d+$/.test(value.trim()))
          return this.invalid(IssueCode.Integer);
        const parsed = Schema.decodeUnknownResult(FormSchema.integer)(
          Number(value),
        );
        switch (parsed._tag) {
          case "Success":
            return { kind: AnswerKind.Accepted, value: parsed.success };
          case "Failure":
            return this.invalid(IssueCode.Integer);
        }
      }
    }
    const unhandled: never = this.field;
    return unhandled;
  }
  skip(): AnswerCheck {
    switch (this.field.required) {
      case Requirement.Optional:
        return { kind: AnswerKind.Skipped };
      case Requirement.Required:
        return this.invalid(IssueCode.Required);
    }
    const unhandled: never = this.field.required;
    return unhandled;
  }
  private invalid(code: IssueCode): AnswerCheck {
    return { kind: AnswerKind.Invalid, issue: { name: this.field.name, code } };
  }
}
