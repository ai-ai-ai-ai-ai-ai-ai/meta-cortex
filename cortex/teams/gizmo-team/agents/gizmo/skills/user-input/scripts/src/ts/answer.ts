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
      return this.field.required === Requirement.Optional
        ? { kind: AnswerKind.Skipped }
        : this.invalid(IssueCode.Required);
    }
    switch (this.field.type) {
      case FieldType.Text:
        return typeof value === "string"
          ? { kind: AnswerKind.Accepted, value }
          : this.invalid(IssueCode.Text);
      case FieldType.Choice:
        return typeof value === "string" && this.field.options.includes(value)
          ? { kind: AnswerKind.Accepted, value }
          : this.invalid(IssueCode.Choice);
      case FieldType.Integer: {
        if (typeof value === "string" && !/^[+-]?\d+$/.test(value.trim()))
          return this.invalid(IssueCode.Integer);
        const parsed = Schema.decodeUnknownEither(FormSchema.integer)(
          Number(value),
        );
        return parsed._tag === "Right"
          ? { kind: AnswerKind.Accepted, value: parsed.right }
          : this.invalid(IssueCode.Integer);
      }
    }
  }
  skip(): AnswerCheck {
    return this.field.required === Requirement.Optional
      ? { kind: AnswerKind.Skipped }
      : this.invalid(IssueCode.Required);
  }
  private invalid(code: IssueCode): AnswerCheck {
    return { kind: AnswerKind.Invalid, issue: { name: this.field.name, code } };
  }
}
