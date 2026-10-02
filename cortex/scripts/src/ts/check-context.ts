import { Effect } from "effect";
import { ContextCheck } from "./context-check.ts";

await Effect.runPromise(ContextCheck.command(process.argv.slice(2))).catch(
  (failure: Error) => {
    console.error(failure.message);
    process.exitCode = 1;
  },
);
