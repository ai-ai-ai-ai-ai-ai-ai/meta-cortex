import { expect, it } from "vitest";
import { Elapsed } from "./observability";
it("puts compact elapsed durations in timeline boxes while retaining precise duration evidence", () => {
  expect(new Elapsed(11 * 60000).compact()).toBe("11m");
  expect(new Elapsed(27 * 60000).compact()).toBe("27m");
  expect(new Elapsed(2 * 60000).compact()).toBe("2m");
  expect(new Elapsed(12450).compact()).toBe("12s");
  expect(new Elapsed(12450).exact()).toBe("12.45s");
});
