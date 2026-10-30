import { GeneratedSyntax } from "./generated-syntax.ts";
import { decodedMappings, TraceMap } from "@jridgewell/trace-mapping";
import { svelte2tsx } from "@rsvelte/svelte2tsx";

export enum ProjectionOrigin {
  Authored = "authored",
  Generated = "generated",
  Unknown = "unknown",
}

export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

export class SvelteProjection {
  readonly code: string;
  private readonly origins = new Map<number, number>();
  private readonly scopeAnchors = new Map<number, number>();
  private readonly syntax: GeneratedSyntax;

  constructor(
    readonly source: string,
    readonly filepath: string,
    emitted?: { code: string; map?: string; typescript?: boolean },
  ) {
    const transformed = svelte2tsx(source, {
      filename: filepath,
      isTsFile: emitted?.typescript ?? true,
      version: "5",
    });
    this.code = emitted?.code ?? transformed.code;
    this.syntax = new GeneratedSyntax(this.code);
    switch (transformed.map) {
      case null:
        throw new Error(
          `The native Svelte transform returned no source map: ${filepath}`,
        );
      default: {
        const map = new TraceMap(emitted?.map ?? transformed.map.toString());
        switch (emitted !== undefined && emitted.map === undefined) {
          case true:
            this.validateMappedCode(transformed.code, map);
            break;
          case false:
            break;
        }
        this.readMappings(map);
      }
    }
    const keys = this.syntax.templateKeys(source);
    const classes = this.syntax.templateClasses(
      source,
      (position) => this.generatedPosition(position) !== undefined,
      (start, end) =>
        Array.from(this.origins.keys()).some(
          (position) => position >= start && position < end,
        ),
    );
    const styles = this.syntax.templateStyles(
      source,
      (position) => this.generatedPosition(position) !== undefined,
      (start, end) => this.hasGeneratedOrigin(start, end),
    );
    const bindings = this.syntax.templateBindings(
      source,
      (position) => this.generatedPosition(position) !== undefined,
      (start, end) => this.hasGeneratedOrigin(start, end),
    );
    for (const key of [...keys, ...classes, ...styles, ...bindings]) {
      for (let offset = 0; offset < key.length; offset += 1) {
        this.origins.set(key.generated + offset, key.original + offset);
      }
    }
  }

  private hasGeneratedOrigin(start: number, end: number): boolean {
    return Array.from(this.origins.keys()).some(
      (position) => position >= start && position < end,
    );
  }

  private validateMappedCode(transformed: string, map: TraceMap): void {
    const lines = decodedMappings(map);
    const lastMappedLine =
      lines
        .map((segments, index) => ({ segments, index }))
        .filter(({ segments }) => segments.length > 0)
        .at(-1)?.index ?? 0;
    const expected = transformed
      .split("\n")
      .slice(1, lastMappedLine + 1)
      .join("\n");
    const actual = this.code
      .split("\n")
      .slice(1, lastMappedLine + 1)
      .join("\n");
    switch (expected === actual) {
      case true:
        break;
      case false:
        throw new Error(
          `Native JSX output differs within source-mapped code: ${this.filepath}`,
        );
    }
  }

  private lineOffsets(text: string): number[] {
    return [0, ...Array.from(text.matchAll(/\n/g), (match) => match.index + 1)];
  }

  private readMappings(map: TraceMap): void {
    const generatedLines = this.lineOffsets(this.code);
    const originalLines = this.lineOffsets(this.source);
    for (const [line, segments] of decodedMappings(map).entries()) {
      for (const [index, segment] of segments.entries()) {
        this.readSegment(
          segment,
          segments[index + 1]?.[0],
          generatedLines[line] ?? 0,
          originalLines,
        );
      }
    }
  }

  private readSegment(
    segment: readonly number[],
    nextColumn: number | undefined,
    generatedLine: number,
    originalLines: readonly number[],
  ): void {
    const originalLine = segment[2];
    const originalColumn = segment[3];
    switch (originalLine !== undefined && originalColumn !== undefined) {
      case true: {
        const generated = generatedLine + (segment[0] ?? 0);
        const original =
          (originalLines[originalLine ?? 0] ?? 0) + (originalColumn ?? 0);
        switch (this.scopeAnchors.has(original)) {
          case false:
            this.scopeAnchors.set(original, generated);
            break;
          case true:
            break;
        }
        this.copyVerbatim(generated, original, nextColumn, generatedLine);
        break;
      }
      case false:
        break;
    }
  }

  private copyVerbatim(
    generated: number,
    original: number,
    nextColumn: number | undefined,
    lineStart: number,
  ): void {
    const boundary = lineStart + (nextColumn ?? this.code.length - lineStart);
    let offset = 0;
    while (
      generated + offset < boundary &&
      this.code[generated + offset] !== undefined &&
      this.code[generated + offset] === this.source[original + offset]
    ) {
      this.origins.set(generated + offset, original + offset);
      offset += 1;
    }
  }

  generatedScopePosition(originalUtf16Offset: number): number | undefined {
    return (
      this.scopeAnchors.get(originalUtf16Offset) ??
      this.generatedPosition(originalUtf16Offset)
    );
  }

  generatedPosition(originalUtf16Offset: number): number | undefined {
    return Array.from(this.origins.entries()).find(
      ([, original]) => original === originalUtf16Offset,
    )?.[0];
  }

  private utf16Span(byteOffset: number, byteLength: number): SourceSpan {
    const bytes = Buffer.from(this.code);
    const start = bytes.subarray(0, byteOffset).toString().length;
    return {
      start,
      end:
        start +
        bytes.subarray(byteOffset, byteOffset + byteLength).toString().length,
    };
  }

  /** Native diagnostics use UTF-8 bytes; Svelte and editor positions use UTF-16. */
  originalSpan(byteOffset: number, byteLength: number): SourceSpan | undefined {
    const { start, end } = this.utf16Span(byteOffset, byteLength);
    const positions = Array.from(this.origins.entries())
      .filter(
        ([generated]) =>
          generated >= start && generated < Math.max(start + 1, end),
      )
      .map(([, original]) => original);
    switch (positions.length) {
      case 0:
        return undefined;
      default:
        return {
          start: Math.min(...positions),
          end: Math.max(...positions) + 1,
        };
    }
  }

  classify(
    byteOffset: number,
    byteLength: number,
    rule: string,
  ):
    | { readonly kind: ProjectionOrigin.Authored; readonly span: SourceSpan }
    | { readonly kind: ProjectionOrigin.Generated; readonly reason: string }
    | { readonly kind: ProjectionOrigin.Unknown } {
    const { start, end } = this.utf16Span(byteOffset, byteLength);
    switch (this.syntax.owns(start, end, rule) && !this.origins.has(start)) {
      case true:
        return {
          kind: ProjectionOrigin.Generated,
          reason: "synthetic node in the native transform's rendering function",
        };
      case false:
        break;
    }
    const span = this.originalSpan(byteOffset, byteLength);
    switch (span) {
      case undefined: {
        const ignoreStart = this.code.lastIndexOf("/*Ωignore_startΩ*/", start);
        const ignoreEnd = this.code.indexOf("/*Ωignore_endΩ*/", start);
        switch (
          ignoreStart >= 0 &&
          ignoreEnd >= end &&
          this.code.indexOf("/*Ωignore_endΩ*/", ignoreStart) === ignoreEnd
        ) {
          case true:
            return {
              kind: ProjectionOrigin.Generated,
              reason: "native transform's explicit generated-only region",
            };
          case false:
            break;
        }
        return { kind: ProjectionOrigin.Unknown };
      }
      default:
        return { kind: ProjectionOrigin.Authored, span };
    }
  }
}
