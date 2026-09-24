import { Schema } from "effect";

/** Validated wire values; paths identify supplied facts and are never opened. */
export class DocumentFields {
  static readonly path = Schema.String.pipe(
    Schema.check(Schema.isMaxLength(4096)),
    Schema.check(
      Schema.isPattern(
        /^(?!\/)(?!.*\\)(?!.*[\u0000-\u001f\u007f-\u009f])(?!\.\.?(?:\/|$))(?!.*\/\.\.?(?:\/|$))[^/#]+(?:\/[^/#]+)*\.md$/u,
      ),
    ),
    Schema.brand("DocumentPath"),
  );
  static readonly line = Schema.Int.pipe(
    Schema.check(Schema.isGreaterThan(0)),
    Schema.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)),
    Schema.brand("SourceLine"),
  );
  static readonly anchor = Schema.String.pipe(
    Schema.check(Schema.isMaxLength(512)),
    Schema.check(Schema.isPattern(/^[^#\s]*$/u)),
    Schema.brand("HeadingAnchor"),
  );
}

export type DocumentPath = typeof DocumentFields.path.Type;
export type HeadingAnchor = typeof DocumentFields.anchor.Type;
export type SourceLine = typeof DocumentFields.line.Type;
