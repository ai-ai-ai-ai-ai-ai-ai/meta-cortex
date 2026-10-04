import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import type { StateMeaning } from "./contracts";
import StateMeanings from "./StateMeanings.svelte";
import { Fixture } from "./dashboard-fixture";

type Props = ComponentProps<typeof StateMeanings>;
type TextQueryOptions = NonNullable<Parameters<typeof screen.getByText>[1]>;
type RoleQueryOptions = NonNullable<Parameters<typeof screen.getByRole>[1]>;
afterEach(cleanup);
it("keeps state help collapsed and consumes supplied descriptor prose in order", () => {
  const meanings = new Fixture().workflow().state_meanings;
  const supplied: StateMeaning = {
    ...meanings[0],
    meaning: "Supplied meaning from the workbench",
    qualification: "Supplied qualification",
    evidence: "Supplied evidence",
    next_step: "Supplied next step",
  };
  const props: Props = { meanings: [supplied, ...meanings.slice(1)] };
  const result = render(StateMeanings, props);
  const disclosure = result.container.querySelector("details");
  expect(disclosure?.open).toBe(false);
  const summaryQuery: TextQueryOptions = { selector: "summary" };
  expect(screen.getByText("State meanings", summaryQuery).tagName).toBe(
    "SUMMARY",
  );
  disclosure?.setAttribute("open", "");
  const tableQuery: RoleQueryOptions = { name: "State meanings" };
  const table = screen.getByRole("table", tableQuery);
  expect(within(table).getByText(supplied.meaning).textContent).toContain(
    supplied.meaning,
  );
  expect(within(table).getByText(supplied.qualification).textContent).toBe(
    supplied.qualification,
  );
  expect(within(table).getByText(supplied.evidence).textContent).toBe(
    supplied.evidence,
  );
  expect(within(table).getByText(supplied.next_step).textContent).toBe(
    supplied.next_step,
  );
  expect(within(table).getAllByRole("row")).toHaveLength(meanings.length + 1);
});
