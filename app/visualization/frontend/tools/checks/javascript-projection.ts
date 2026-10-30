import MagicString from "magic-string";
import remapping from "@jridgewell/remapping";
import { decodedMappings, TraceMap } from "@jridgewell/trace-mapping";
import { svelte2tsx } from "@rsvelte/svelte2tsx";
import { GeneratedSyntax } from "./generated-syntax.ts";

/** Keeps JavaScript inference while converting only the producer's synthetic type alias. */
export class JavascriptProjection {
  generate(source: string, filepath: string): { code: string; map: string } {
    const transformed = svelte2tsx(source, {
      filename: filepath,
      isTsFile: false,
      version: "5",
    });
    switch (transformed.map) {
      case null:
        throw new Error(
          `The native JavaScript transform returned no map: ${filepath}`,
        );
      default: {
        const alias = new GeneratedSyntax(transformed.code).javascriptAlias();
        this.requireGeneratedAlias(
          transformed.code,
          transformed.map.toString(),
          alias.start,
          alias.end,
        );
        const edited = new MagicString(transformed.code);
        edited.overwrite(alias.start, alias.end, alias.replacement);
        const map = remapping(
          [
            edited
              .generateMap({
                source: `${filepath}.generated`,
                includeContent: true,
                hires: true,
              })
              .toString(),
            transformed.map.toString(),
          ],
          () => null,
        );
        return { code: edited.toString(), map: map.toString() };
      }
    }
  }

  private requireGeneratedAlias(
    code: string,
    map: string,
    start: number,
    end: number,
  ): void {
    const lines = [
      0,
      ...Array.from(code.matchAll(/\n/g), (match) => match.index + 1),
    ];
    const anchors = decodedMappings(new TraceMap(map)).flatMap(
      (segments, line) =>
        segments
          .filter((segment) => segment.length > 1)
          .map((segment) => (lines[line] ?? 0) + segment[0]),
    );
    const marker = code.lastIndexOf("/*Ωignore_startΩ*/", start);
    switch (
      marker >= 0 &&
      code.indexOf("/*Ωignore_endΩ*/", marker) >= end &&
      !anchors.some((position) => position >= start && position < end)
    ) {
      case true:
        break;
      case false:
        throw new Error(
          "Refusing to rewrite a type alias with authored source ownership.",
        );
    }
  }
}
