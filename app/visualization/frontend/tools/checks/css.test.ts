import { expect, it } from "vitest";
import { ComponentCss } from "./css.ts";

it("reports authored CSS property diagnostics at original coordinates", () => {
  const source = "<p>Text</p>\n<style>p { colr: red; }</style>";
  expect(new ComponentCss().check(source, "Css.svelte")).toEqual([
    expect.objectContaining({
      rule: "css/unknownProperties",
      severity: "warning",
      start: source.indexOf("colr"),
      end: source.indexOf("colr") + 4,
    }),
  ]);
});
it("accepts valid CSS", () => {
  expect(
    new ComponentCss().check(
      "<p>Text</p><style>p { color: red; }</style>",
      "Css.svelte",
    ),
  ).toEqual([]);
});
