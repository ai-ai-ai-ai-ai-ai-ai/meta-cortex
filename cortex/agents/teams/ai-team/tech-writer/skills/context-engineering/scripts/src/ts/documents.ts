import { Schema } from "effect";

/** Validated wire values; paths identify supplied facts and are never opened. */
export class DocumentFields {
  static readonly path = Schema.String.pipe(
    Schema.maxLength(4096),
    Schema.pattern(
      /^(?!\/)(?!.*\\)(?!.*[\u0000-\u001f\u007f-\u009f])(?!\.\.?(?:\/|$))(?!.*\/\.\.?(?:\/|$))[^/#]+(?:\/[^/#]+)*\.md$/u,
    ),
    Schema.brand("DocumentPath"),
  );
  static readonly line = Schema.Int.pipe(
    Schema.positive(),
    Schema.lessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
    Schema.brand("SourceLine"),
  );
  static readonly anchor = Schema.String.pipe(
    Schema.maxLength(512),
    Schema.pattern(/^[^#\s]*$/u),
    Schema.brand("HeadingAnchor"),
  );
}
