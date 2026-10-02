import { Schema } from "effect";
import { WorkingDirectory } from "./lace.ts";

/** Authoritative YAML admission contract; model fields retain their readonly types. */
export class ContextSchema {
  static readonly text = Schema.String.check(Schema.isPattern(/\S/));
  static readonly name = ContextSchema.text;
  private static readonly referenceFields = {
    $ref: ContextSchema.text,
  } satisfies Schema.Struct.Fields;
  static readonly reference = Schema.Struct(ContextSchema.referenceFields);
  private static readonly commandFields = {
    cwd: Schema.Enum(WorkingDirectory),
    script: ContextSchema.text,
  } satisfies Schema.Struct.Fields;
  static readonly command = Schema.Struct(ContextSchema.commandFields);
  private static readonly statementFields = {
    content: ContextSchema.text,
    ShellCommand: ContextSchema.command,
  } satisfies Schema.Struct.Fields;
  static readonly statement = Schema.Union([
    ContextSchema.text,
    Schema.Struct(ContextSchema.statementFields),
  ]);
  static readonly statementUse = Schema.Union([
    ContextSchema.statement,
    ContextSchema.reference,
  ]);
  static readonly statements = Schema.Record(
    ContextSchema.name,
    ContextSchema.statementUse,
  );
  private static readonly normativeFields = {
    statements: ContextSchema.statements,
  } satisfies Schema.Struct.Fields;
  static readonly normative = Schema.Struct(ContextSchema.normativeFields);
  private static readonly stageFields = {
    spec: ContextSchema.statements,
    Required: ContextSchema.normative,
    Prohibited: ContextSchema.normative,
  } satisfies Schema.Struct.Fields;
  static readonly stage = Schema.Struct(ContextSchema.stageFields);
  static readonly stageUse = Schema.Union([
    ContextSchema.stage,
    ContextSchema.reference,
  ]);
  static readonly stages = Schema.Record(
    ContextSchema.name,
    ContextSchema.stageUse,
  );
  private static readonly exportsFields = {
    stages: ContextSchema.stages,
    statements: ContextSchema.statements,
  } satisfies Schema.Struct.Fields;
  static readonly exports = Schema.Struct(ContextSchema.exportsFields);
  private static readonly documentFields = {
    stages: ContextSchema.stages,
    exports: Schema.optionalKey(ContextSchema.exports),
  } satisfies Schema.Struct.Fields;
  static readonly document = Schema.Struct(ContextSchema.documentFields);
  static readonly pointer = Schema.String.check(
    Schema.isPattern(
      /^\.\.?\/(?:[^#\n]+\/)?(?:AGENTS|[^/#\n]+\.lace)\.yaml#\/exports\/(?:stages|statements)\/(?:[^~\/]|~[01])+$/,
    ),
  );
}
export type ContextDocument = typeof ContextSchema.document.Type;
export type StageUse = typeof ContextSchema.stageUse.Type;
export type StatementUse = typeof ContextSchema.statementUse.Type;
export type ContextReference = typeof ContextSchema.reference.Type;
