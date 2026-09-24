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
    switch (this.field.type) {
      case FieldType.Text:
      case FieldType.Integer: {
        const question: NativeQuestion = { title: this.field.question };
        return { field: this.field.name, arguments: { questions: [question] } };
      }
      case FieldType.Choice: {
        const question: NativeQuestion = {
          title: this.field.question,
          options: this.field.options,
        };
        return { field: this.field.name, arguments: { questions: [question] } };
      }
    }
    const unhandled: never = this.field;
    return unhandled;
  }
}
