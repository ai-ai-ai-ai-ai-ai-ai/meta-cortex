import { Schema } from "effect";

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
    Schema.pattern(/^[A-Za-z][A-Za-z0-9_.-]*$/),
    Schema.filter((name) => !["constructor", "prototype"].includes(name)),
    Schema.brand("FieldName"),
  );
  static readonly text = Schema.String.pipe(Schema.brand("AnswerText"));
  static readonly integer = Schema.Number.pipe(
    Schema.int(),
    Schema.filter(Number.isSafeInteger),
    Schema.brand("AnswerInteger"),
  );
  static readonly question = Schema.String.pipe(
    Schema.filter((text) => text.trim().length > 0),
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
  private static readonly requirement = Schema.transform(
    Schema.Boolean,
    Schema.Enums(Requirement),
    FormSchema.requirementConversion,
  );
  private static readonly requiredDefault = {
    default: () => Requirement.Required,
  };
  private static readonly choiceDefault = {
    default: (): FieldType.Choice => FieldType.Choice,
  };
  private static readonly common = {
    name: FormSchema.name,
    question: FormSchema.question,
    required: Schema.optionalWith(
      FormSchema.requirement,
      FormSchema.requiredDefault,
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
    type: Schema.optionalWith(
      Schema.Literal(FieldType.Choice),
      FormSchema.choiceDefault,
    ),
    options: Schema.Array(FormSchema.text).pipe(
      Schema.minItems(1),
      Schema.filter(
        (items) =>
          items.every((item) => item.trim().length > 0) &&
          new Set(items).size === items.length,
      ),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly field = Schema.Union(
    Schema.Struct(FormSchema.textFields),
    Schema.Struct(FormSchema.integerFields),
    Schema.Struct(FormSchema.choiceFields),
  );
  private static readonly formFields = {
    fields: Schema.Array(FormSchema.field).pipe(
      Schema.minItems(1),
      Schema.filter(
        (fields) =>
          new Set(fields.map((field) => field.name)).size === fields.length,
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
