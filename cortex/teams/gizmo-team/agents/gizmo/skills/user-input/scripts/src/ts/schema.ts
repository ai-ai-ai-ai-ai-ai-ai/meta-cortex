import { Effect, Schema, SchemaTransformation } from "effect";

export enum FieldType {
  Text = "text",
  Integer = "integer",
  Choice = "choice",
}
export enum Requirement {
  Required = "required",
  Optional = "optional",
}

export class FormSchema {
  static readonly name = Schema.String.pipe(
    Schema.check(Schema.isPattern(/^[A-Za-z][A-Za-z0-9_.-]*$/)),
    Schema.check(
      Schema.makeFilter((name) => !["constructor", "prototype"].includes(name)),
    ),
    Schema.brand("FieldName"),
  );
  static readonly text = Schema.String.pipe(Schema.brand("AnswerText"));
  static readonly integer = Schema.Number.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.makeFilter(Number.isSafeInteger)),
    Schema.brand("AnswerInteger"),
  );
  static readonly question = Schema.String.pipe(
    Schema.check(Schema.makeFilter((text) => text.trim().length > 0)),
    Schema.brand("Question"),
  );
  private static readonly requirementConversion = {
    decode: (required: boolean) => {
      switch (required) {
        case true:
          return Requirement.Required;
        case false:
          return Requirement.Optional;
      }
      const unhandled: never = required;
      return unhandled;
    },
    encode: (required: Requirement) => required === Requirement.Required,
  };
  private static readonly requirement = Schema.Boolean.pipe(
    Schema.decodeTo(
      Schema.Enum(Requirement),
      SchemaTransformation.transform(FormSchema.requirementConversion),
    ),
  );
  private static readonly common = {
    name: FormSchema.name,
    question: FormSchema.question,
    required: FormSchema.requirement.pipe(
      Schema.withDecodingDefaultType(Effect.succeed(Requirement.Required)),
    ),
  } satisfies Schema.Struct.Fields;
  private static readonly textFields = {
    ...FormSchema.common,
    type: Schema.Literal(FieldType.Text),
  } satisfies Schema.Struct.Fields;
  private static readonly integerFields = {
    ...FormSchema.common,
    type: Schema.Literal(FieldType.Integer),
  } satisfies Schema.Struct.Fields;
  private static readonly choiceFields = {
    ...FormSchema.common,
    type: Schema.Literal(FieldType.Choice).pipe(
      Schema.withDecodingDefaultType(Effect.succeed(FieldType.Choice)),
    ),
    options: Schema.Array(FormSchema.text).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(
        Schema.makeFilter(
          (items) =>
            items.every((item) => item.trim().length > 0) &&
            new Set(items).size === items.length,
        ),
      ),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly field = Schema.Union([
    Schema.Struct(FormSchema.textFields),
    Schema.Struct(FormSchema.integerFields),
    Schema.Struct(FormSchema.choiceFields),
  ]);
  private static readonly formFields = {
    fields: Schema.Array(FormSchema.field).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(
        Schema.makeFilter(
          (fields) =>
            new Set(fields.map((field) => field.name)).size === fields.length,
        ),
      ),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly value = Schema.Struct(FormSchema.formFields);
}

export type FieldName = typeof FormSchema.name.Type;
export type AnswerText = typeof FormSchema.text.Type;
export type AnswerInteger = typeof FormSchema.integer.Type;
export type AnswerValue = AnswerText | AnswerInteger;
export type Field = typeof FormSchema.field.Type;
export type Form = typeof FormSchema.value.Type;
