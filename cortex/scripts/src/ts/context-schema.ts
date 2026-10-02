import { Schema } from "effect";

/** Canonical schema definitions only; no parallel context model or runtime API. */
export class ContextSchema {
  static readonly text = Schema.String.check(Schema.isPattern(/\S/));
  private static readonly refFields = {
    $ref: Schema.String.check(
      Schema.isPattern(
        /^\.\.?\/[^#\n]+\.yaml#\/exports\/(?:stages|statements)\/(?:[^~\/]|~[01])+$/,
      ),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly reference = Schema.Struct(ContextSchema.refFields);
  private static readonly commandFields = {
    cwd: Schema.Literals(["project-root", "library-root"]),
    script: ContextSchema.text,
  } satisfies Schema.Struct.Fields;
  private static readonly statementFields = {
    content: ContextSchema.text,
    ShellCommand: Schema.Struct(ContextSchema.commandFields),
  } satisfies Schema.Struct.Fields;
  static readonly statement = Schema.Union([
    ContextSchema.text,
    Schema.Struct(ContextSchema.statementFields),
    ContextSchema.reference,
  ]);
  static readonly statements = Schema.Record(
    ContextSchema.text,
    ContextSchema.statement,
  );
  private static readonly normativeFields = {
    statements: ContextSchema.statements,
  } satisfies Schema.Struct.Fields;
  private static readonly stageFields = {
    spec: ContextSchema.statements,
    Required: Schema.Struct(ContextSchema.normativeFields),
    Prohibited: Schema.Struct(ContextSchema.normativeFields),
  } satisfies Schema.Struct.Fields;
  static readonly stage = Schema.Union([
    Schema.Struct(ContextSchema.stageFields),
    ContextSchema.reference,
  ]);
  static readonly stages = Schema.Record(
    ContextSchema.text,
    ContextSchema.stage,
  );
  private static readonly exportFields = {
    stages: ContextSchema.stages,
    statements: ContextSchema.statements,
  } satisfies Schema.Struct.Fields;
  private static readonly documentFields = {
    stages: ContextSchema.stages,
    exports: Schema.optionalKey(Schema.Struct(ContextSchema.exportFields)),
  } satisfies Schema.Struct.Fields;
  static readonly document = Schema.Struct(ContextSchema.documentFields);
}
export type ContextDocument = typeof ContextSchema.document.Type;
