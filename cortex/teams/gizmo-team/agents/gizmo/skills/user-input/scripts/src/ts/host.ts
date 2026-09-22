import { FieldType, type Field, type FieldName } from "./schema.ts";

// The host owns these argument shapes. This adapter emits data; it cannot call
// request_user_input_async from Bun or an ordinary JavaScript application.
export interface NativeQuestion {
  readonly title: string;
  readonly options?: readonly string[];
}
export interface NativeInputArguments {
  readonly questions: readonly NativeQuestion[];
}
export interface NativePrompt {
  readonly field: FieldName;
  readonly arguments: NativeInputArguments;
}

export class CodexPrompt {
  constructor(private readonly field: Field) {}
  render(): NativePrompt {
    const question: NativeQuestion =
      this.field.type === FieldType.Choice
        ? { title: this.field.question, options: this.field.options }
        : { title: this.field.question };
    return { field: this.field.name, arguments: { questions: [question] } };
  }
}
